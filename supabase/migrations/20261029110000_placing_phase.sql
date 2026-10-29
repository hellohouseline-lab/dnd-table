-- Placing miniatures before a fight (decided with Matt, 29 October): a new fight opens in a placing
-- phase. Players drag their miniature to where they're standing and roll initiative at the same
-- time, then press I'm in place, which the DM sees as a tick. The first turn waits, even once
-- everyone has rolled, until the DM presses Start the battle.
--
-- * encounters.placing_phase: true for a new fight (fights already going on are left as they are).
-- * combatants.placed: the player's (or the DM's) I'm in place.
-- * While placing, nothing starts the first turn: a trigger holds it back, so a last initiative
--   roll (or Next turn) can't start the fight early.
-- * begin_battle: the DM ends the placing phase. If everyone has initiative the first turn starts
--   now; otherwise it starts by itself with the last roll, as before.

alter table public.encounters add column placing_phase boolean not null default false;
alter table public.encounters alter column placing_phase set default true;

alter table public.combatants add column placed boolean not null default false;

create function private.hold_first_turn()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.placing_phase and old.current_id is null and new.current_id is not null then
    new.current_id := null;
  end if;
  return new;
end
$$;

create trigger encounters_hold_first_turn
  before update on public.encounters
  for each row execute function private.hold_first_turn();

-- I'm in place (or not yet): a player for their own character, the DM for anyone.
create function public.set_placed(p_combatant_id uuid, p_placed boolean)
returns public.combatants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not (
    private.is_campaign_dm(v_combatant.campaign_id)
    or (
      private.is_real_user() and exists (
        select 1 from public.characters ch where ch.id = v_combatant.character_id and ch.owner_id = auth.uid()
      )
    )
  ) then
    raise exception 'That isn''t your miniature' using errcode = '42501';
  end if;
  update public.combatants set placed = coalesce(p_placed, true) where id = p_combatant_id
  returning * into v_combatant;
  return v_combatant;
end
$$;

revoke execute on function public.set_placed(uuid, boolean) from public, anon;
grant execute on function public.set_placed(uuid, boolean) to authenticated;

-- Start the battle: the DM ends the placing phase, and the first turn starts if everyone has rolled.
create function public.begin_battle(p_encounter_id uuid)
returns public.encounters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
begin
  select * into v_encounter from public.encounters e where e.id = p_encounter_id and e.status = 'active';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not private.is_campaign_dm(v_encounter.campaign_id) then
    raise exception 'Only the DM can start the battle' using errcode = '42501';
  end if;
  update public.encounters set placing_phase = false where id = p_encounter_id returning * into v_encounter;
  if v_encounter.current_id is null and not exists (
    select 1 from public.combatants c where c.encounter_id = p_encounter_id and c.initiative is null
  ) and exists (select 1 from public.combatants c where c.encounter_id = p_encounter_id) then
    v_encounter := public.end_turn(p_encounter_id);
  end if;
  return v_encounter;
end
$$;

revoke execute on function public.begin_battle(uuid) from public, anon;
grant execute on function public.begin_battle(uuid) to authenticated;
