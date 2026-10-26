-- Ending a fight, in one step on the server (Matt's C1b test): the fight's miniatures leave the
-- map, chances to strike close, and the battle map stays on stage as an ordinary picture, so
-- picking another picture (or putting the map up again) works as usual for everyone.

create function public.end_fight(p_encounter_id uuid)
returns public.encounters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
  v_map uuid;
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

  update public.stage set mode = 'scene', image_id = map_id
  where campaign_id = v_encounter.campaign_id and mode = 'map' and map_id is not null;

  update public.encounters set status = 'ended', ended_at = now(), current_id = null
  where id = p_encounter_id
  returning * into v_encounter;
  return v_encounter;
end
$$;

revoke execute on function public.end_fight(uuid) from public, anon;
grant execute on function public.end_fight(uuid) to authenticated;
