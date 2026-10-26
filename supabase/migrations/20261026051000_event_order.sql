-- The feed's order. Events made in the same moment (or the same transaction) share a timestamp,
-- so each gets a running number, and Undo goes newest first by that number.

alter table public.combat_events add column seq bigint generated always as identity;
create index combat_events_seq_idx on public.combat_events (encounter_id, seq);

create or replace function public.undo_event(p_event_id uuid)
returns public.combat_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.combat_events;
  v_secret public.combat_event_secrets;
  v_target public.combatants;
  v_before jsonb;
  v_record jsonb;
begin
  select * into v_event from public.combat_events ev where ev.id = p_event_id;
  if not found or not private.is_campaign_dm(v_event.campaign_id) then
    raise exception 'Only the DM can undo' using errcode = '42501';
  end if;
  if v_event.undone then
    raise exception 'That has already been undone' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.combat_events ev
    where ev.encounter_id = v_event.encounter_id and not ev.undone and ev.seq > v_event.seq
  ) then
    raise exception 'Undo the newer things first' using errcode = '22023';
  end if;
  select * into v_secret from public.combat_event_secrets s where s.event_id = p_event_id;

  v_before := v_secret.target_before;
  if v_before is not null and v_event.target_id is not null then
    select * into v_target from public.combatants c where c.id = v_event.target_id;
    if v_target.kind = 'character' then
      update public.characters ch
      set current_hp = (v_before ->> 'current_hp')::integer,
          temp_hp = (v_before ->> 'temp_hp')::integer,
          conditions = array(select jsonb_array_elements_text(v_before -> 'conditions'))
      where ch.id = v_target.character_id;
    elsif v_target.id is not null then
      update public.combatant_secrets set hp = (v_before ->> 'hp')::integer where combatant_id = v_target.id;
      update public.combatants set health = v_before ->> 'health' where id = v_target.id;
    end if;
  end if;

  -- The actor's turn record as it was, but not the feet already walked: moves aren't undone.
  v_record := v_secret.actor_before;
  if v_record is not null and v_event.actor_id is not null then
    update public.combatants
    set action_used = (v_record ->> 'action_used')::boolean,
        attacks_made = (v_record ->> 'attacks_made')::integer,
        bonus_used = (v_record ->> 'bonus_used')::boolean,
        reaction_used = (v_record ->> 'reaction_used')::boolean,
        extra_feet = (v_record ->> 'extra_feet')::integer,
        disengaged = (v_record ->> 'disengaged')::boolean,
        dodging = (v_record ->> 'dodging')::boolean
    where id = v_event.actor_id;
  end if;

  update public.combat_events set undone = true where id = p_event_id returning * into v_event;
  return v_event;
end
$$;
