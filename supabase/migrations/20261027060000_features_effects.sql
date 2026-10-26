-- T1: features that change the sheet, and cards that explain themselves (docs/TABLE_TOOLS_PLAN.md).
--
-- Active effects. A character can have effects running, such as Raging: each has a key, a name,
-- and what it changes. Resistances from an effect (Rage: bludgeoning, piercing and slashing) count
-- when damage is taken. An effect marked endsWhenDown (Rage) goes when the character drops to 0.
--
-- Using a feature in a fight: use_feature spends what it costs (action, bonus action, reaction, or
-- nothing) and posts it to the feed by name ("Thorin uses Rage"). Action Surge gives the action back.
-- A player can undo their own newest action, so a feature used by mistake comes back (with its
-- part of the turn); anything else is still the DM's to undo.

alter table public.characters
  add column effects jsonb not null default '[]'
    check (jsonb_typeof(effects) = 'array' and pg_column_size(effects) <= 4000);
grant update (effects) on public.characters to authenticated;

-- The resistances an effect brings, such as Rage's.
create function private.effect_resistances(p_effects jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(r), '{}')
  from jsonb_array_elements(coalesce(p_effects, '[]')) e,
       jsonb_array_elements_text(coalesce(e -> 'resistances', '[]')) r
$$;

revoke execute on function private.effect_resistances(jsonb) from public;

create or replace function private.on_hit_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lost integer;
begin
  v_lost := (old.current_hp + old.temp_hp) - (new.current_hp + new.temp_hp);
  if new.current_hp = 0 and old.current_hp > 0 and not ('unconscious' = any (new.conditions)) then
    new.conditions := array_append(new.conditions, 'unconscious');
  elsif new.current_hp > 0 and old.current_hp = 0 then
    new.death_save_successes := 0;
    new.death_save_failures := 0;
    new.stable := false;
    new.dead := false;
    new.conditions := array_remove(new.conditions, 'unconscious');
  end if;

  if new.current_hp = 0 then
    new.concentration := null;
    new.effects := coalesce(
      (select jsonb_agg(e) from jsonb_array_elements(new.effects) e where not coalesce((e ->> 'endsWhenDown')::boolean, false)),
      '[]'
    );
  elsif v_lost > 0 and new.concentration is not null and new.concentration is not distinct from old.concentration then
    new.concentration_dc := least(99, greatest(coalesce(new.concentration_dc, 0), 10, v_lost / 2));
  end if;

  if new.concentration is distinct from old.concentration then
    new.concentration_dc := null;
    delete from public.areas a where a.character_id = old.id and a.concentration;
  end if;
  return new;
end
$$;


create or replace function private.apply_damage(
  p_target public.combatants,
  p_amount integer,
  p_type text,
  p_magical boolean,
  p_critical boolean
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_damage integer := greatest(0, coalesce(p_amount, 0));
  v_type text := lower(coalesce(p_type, ''));
  v_adjust text;
  v_before jsonb;
  v_temp integer;
  v_hp integer;
  v_max integer;
  v_was_down boolean;
  v_failures integer;
  v_more integer := case when p_critical then 2 else 1 end;
begin
  if v_damage > 0 and v_type <> '' then
    if p_target.kind = 'character' then
      select private.damage_adjustment(
               v_type, p_magical, ch.resistances || private.effect_resistances(ch.effects), ch.vulnerabilities, ch.immunities
             )
        into v_adjust
      from public.characters ch where ch.id = p_target.character_id;
    else
      select private.damage_adjustment(v_type, p_magical, s.resistances, s.vulnerabilities, s.immunities)
        into v_adjust
      from public.combatant_secrets s where s.combatant_id = p_target.id;
    end if;
    v_damage := case v_adjust
      when 'immune' then 0
      when 'resisted' then v_damage / 2
      when 'vulnerable' then v_damage * 2
      else v_damage
    end;
  end if;

  if p_target.kind = 'character' then
    select jsonb_build_object(
             'current_hp', ch.current_hp, 'temp_hp', ch.temp_hp, 'conditions', to_jsonb(ch.conditions),
             'death_save_successes', ch.death_save_successes, 'death_save_failures', ch.death_save_failures,
             'stable', ch.stable, 'dead', ch.dead,
             'concentration', ch.concentration, 'concentration_dc', ch.concentration_dc
           ),
           least(ch.temp_hp, v_damage), ch.current_hp, ch.current_hp = 0, ch.death_save_failures
      into v_before, v_temp, v_hp, v_was_down, v_failures
    from public.characters ch where ch.id = p_target.character_id;
    v_hp := greatest(0, v_hp - (v_damage - v_temp));
    update public.characters ch
    set temp_hp = ch.temp_hp - v_temp,
        current_hp = v_hp,
        death_save_failures = case
          when v_was_down and v_damage > 0 then least(3, v_failures + v_more)
          else ch.death_save_failures
        end,
        stable = case when v_was_down and v_damage > 0 then false else ch.stable end,
        dead = ch.dead or (v_was_down and v_damage > 0 and v_failures + v_more >= 3)
    where ch.id = p_target.character_id;
  else
    select jsonb_build_object('hp', s.hp, 'health', p_target.health), s.hp, s.max_hp
      into v_before, v_hp, v_max
    from public.combatant_secrets s where s.combatant_id = p_target.id;
    if v_hp is not null then
      v_hp := greatest(0, v_hp - v_damage);
      update public.combatant_secrets set hp = v_hp where combatant_id = p_target.id;
      update public.combatants set health = private.health_word(v_hp, v_max) where id = p_target.id;
    end if;
  end if;

  return jsonb_build_object(
    'damage', v_damage,
    'adjust', v_adjust,
    'down', v_damage > 0 and coalesce(v_hp, 1) = 0,
    'before', v_before
  );
end
$$;


create function public.use_feature(p_combatant_id uuid, p_name text, p_cost text)
returns public.combat_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_dm boolean;
  v_name text := left(btrim(coalesce(p_name, '')), 60);
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if p_cost not in ('action', 'bonus', 'reaction', 'free', 'surge') or v_name = '' then
    raise exception 'Unknown feature' using errcode = '22023';
  end if;
  if not private.acts_for(v_combatant, p_cost in ('reaction', 'free')) then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  v_dm := private.is_campaign_dm(v_combatant.campaign_id);

  if not v_dm then
    if p_cost = 'action' and (v_combatant.action_used or v_combatant.attacks_made > 0) then
      raise exception 'You have used your action this turn' using errcode = '22023';
    end if;
    if p_cost = 'bonus' and v_combatant.bonus_used then
      raise exception 'You have used your bonus action this turn' using errcode = '22023';
    end if;
    if p_cost = 'reaction' and v_combatant.reaction_used then
      raise exception 'You have used your reaction' using errcode = '22023';
    end if;
  end if;

  update public.combatants c
  set action_used = case when p_cost = 'surge' then false else c.action_used or p_cost = 'action' end,
      attacks_made = case when p_cost = 'surge' then 0 else c.attacks_made end,
      bonus_used = c.bonus_used or p_cost = 'bonus',
      reaction_used = c.reaction_used or p_cost = 'reaction'
  where c.id = p_combatant_id;

  return private.add_event(
    v_combatant, null, 'action', null, jsonb_build_object('what', p_cost, 'feature', v_name),
    null, private.turn_record(v_combatant), null
  );
end
$$;

revoke execute on function public.use_feature(uuid, text, text) from public, anon;
grant execute on function public.use_feature(uuid, text, text) to authenticated;

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
  v_actor public.combatants;
  v_before jsonb;
  v_record jsonb;
  v_slot integer;
begin
  select * into v_event from public.combat_events ev where ev.id = p_event_id;
  if not found then
    raise exception 'Only the DM can undo' using errcode = '42501';
  end if;
  if not private.is_campaign_dm(v_event.campaign_id) and not (
    v_event.kind = 'action'
    and private.is_real_user()
    and exists (
      select 1 from public.combatants c join public.characters ch on ch.id = c.character_id
      where c.id = v_event.actor_id and ch.owner_id = auth.uid()
    )
  ) then
    raise exception 'Only the DM can undo that' using errcode = '42501';
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
      -- Separately, so the hit points rules (coming back above 0 clears the saves; damage sets a
      -- concentration save) don't undo it.
      if v_before ? 'death_save_failures' then
        update public.characters ch
        set death_save_successes = (v_before ->> 'death_save_successes')::integer,
            death_save_failures = (v_before ->> 'death_save_failures')::integer,
            stable = (v_before ->> 'stable')::boolean,
            dead = (v_before ->> 'dead')::boolean
        where ch.id = v_target.character_id;
      end if;
      if v_before ? 'concentration' then
        update public.characters ch set concentration = v_before ->> 'concentration'
        where ch.id = v_target.character_id;
        update public.characters ch set concentration_dc = (v_before ->> 'concentration_dc')::smallint
        where ch.id = v_target.character_id;
      end if;
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
    where id = v_event.actor_id
    returning * into v_actor;

    -- A spell: its slot back, and whatever the caster was concentrating on before.
    v_slot := coalesce((v_record ->> 'slot_level')::integer, 0);
    if v_actor.character_id is not null and v_slot between 1 and 9 then
      update public.characters ch
      set spellcasting = jsonb_set(
        ch.spellcasting, array['slotsUsed', (v_slot - 1)::text],
        to_jsonb(greatest(0, coalesce((ch.spellcasting -> 'slotsUsed' ->> (v_slot - 1))::integer, 0) - 1))
      )
      where ch.id = v_actor.character_id;
    end if;
    if v_actor.character_id is not null and v_record ? 'concentration_before' then
      update public.characters ch set concentration = v_record ->> 'concentration_before'
      where ch.id = v_actor.character_id;
    end if;
  end if;

  update public.combat_events set undone = true where id = p_event_id returning * into v_event;
  return v_event;
end
$$;
