-- Timed effects. An effect can carry roundsLeft (Rage: 10, for its minute). At the start of the
-- character's turn in a fight it goes down by one, and at 0 the effect ends: Rage put on in round 2
-- ends as the barbarian's turn comes round in round 12. A concentration spell's timer is an effect
-- too (key 'concentration', with the spell's name), and when it runs out the concentration ends,
-- which takes the spell's areas off the map. When a fight ends, a minute passes: anything with a
-- minute or less left ends, and longer effects lose 10 rounds.

create or replace function private.fresh_turn(p_combatant_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_character uuid;
begin
  update public.combatants
  set action_used = false, attacks_made = 0, bonus_used = false, reaction_used = false,
      feet_moved = 0, extra_feet = 0, disengaged = false, dodging = false
  where id = p_combatant_id
  returning character_id into v_character;

  if v_character is not null then
    perform private.tick_effects(v_character, 1);
  end if;
end
$$;

-- Takes p_rounds off every timed effect, drops those that run out, and ends the concentration
-- whose timer ran out.
create function private.tick_effects(p_character_id uuid, p_rounds integer)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_effects jsonb;
  v_kept jsonb;
  v_concentration_out boolean;
begin
  select ch.effects into v_effects from public.characters ch where ch.id = p_character_id;
  if v_effects is null or not exists (
    select 1 from jsonb_array_elements(v_effects) e where e ? 'roundsLeft'
  ) then
    return;
  end if;

  v_concentration_out := exists (
    select 1 from jsonb_array_elements(v_effects) e
    where e ->> 'key' = 'concentration' and (e ->> 'roundsLeft')::integer <= p_rounds
  );
  select coalesce(jsonb_agg(
    case when e ? 'roundsLeft'
      then jsonb_set(e, '{roundsLeft}', to_jsonb((e ->> 'roundsLeft')::integer - p_rounds))
      else e end
  ), '[]'::jsonb)
  into v_kept
  from jsonb_array_elements(v_effects) e
  where not (e ? 'roundsLeft') or (e ->> 'roundsLeft')::integer > p_rounds;

  update public.characters ch
  set effects = v_kept,
      concentration = case when v_concentration_out then null else ch.concentration end
  where ch.id = p_character_id;
end
$$;

revoke execute on function private.tick_effects(uuid, integer) from public;

-- A concentration timer goes when the concentration does (another spell, a failed save, 0 hit
-- points). Named to run after characters_hit_points, which can end concentration itself.
create function private.on_concentration_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.concentration is distinct from old.concentration then
    new.effects := coalesce((
      select jsonb_agg(e) from jsonb_array_elements(new.effects) e
      where e ->> 'key' <> 'concentration'
         or (new.concentration is not null and e ->> 'spell' = new.concentration)
    ), '[]'::jsonb);
  end if;
  return new;
end
$$;

create trigger characters_timer
  before update on public.characters
  for each row execute function private.on_concentration_change();

-- Ending a fight: a minute or less left (Rage, Bless) ends now.
create or replace function public.end_fight(p_encounter_id uuid)
returns public.encounters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
  v_map uuid;
  v_character uuid;
begin
  select * into v_encounter from public.encounters e where e.id = p_encounter_id and e.status = 'active';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not (private.is_real_user() and private.is_campaign_dm(v_encounter.campaign_id)) then
    raise exception 'Only the DM ends a fight' using errcode = '42501';
  end if;

  select s.map_id into v_map from public.stage s where s.campaign_id = v_encounter.campaign_id;

  -- Every monster's miniature, and the party's on the battle map.
  delete from public.tokens t
  where t.combatant_id in (select c.id from public.combatants c where c.encounter_id = p_encounter_id)
     or (
       t.map_id = v_map
       and t.character_id in (
         select c.character_id from public.combatants c
         where c.encounter_id = p_encounter_id and c.character_id is not null
       )
     );

  update public.reaction_prompts set status = 'passed'
  where encounter_id = p_encounter_id and status = 'open';

  for v_character in
    select c.character_id from public.combatants c
    where c.encounter_id = p_encounter_id and c.character_id is not null
  loop
    perform private.tick_effects(v_character, 10);
  end loop;

  update public.stage set mode = 'scene', image_id = map_id
  where campaign_id = v_encounter.campaign_id and mode = 'map' and map_id is not null;

  update public.encounters set status = 'ended', ended_at = now(), current_id = null
  where id = p_encounter_id
  returning * into v_encounter;
  return v_encounter;
end
$$;
