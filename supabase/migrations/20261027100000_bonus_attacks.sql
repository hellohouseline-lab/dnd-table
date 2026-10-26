-- Attacks made with the bonus action, checked here so the rules hold for everyone:
--   offhand      two-weapon fighting, after attacking this turn;
--   martialArts  a monk's unarmed strike, after attacking this turn;
--   flurry       a monk's Flurry of Blows, after attacking: two strikes for the one bonus action;
--   frenzy       a raging berserker's extra melee attack, on a turn after the rage began.
-- Each spends the bonus action (Flurry of Blows on its first strike), never the action.

create function public.bonus_attack(p_attacker_id uuid, p_target_id uuid, p_roll jsonb, p_kind text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_attacker public.combatants;
  v_target public.combatants;
  v_character public.characters;
  v_encounter public.encounters;
  v_result jsonb;
  v_event public.combat_events;
  v_flurries integer;
begin
  if p_kind not in ('offhand', 'martialArts', 'flurry', 'frenzy') then
    raise exception 'Unknown bonus attack' using errcode = '22023';
  end if;
  select c.* into v_attacker
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_attacker_id and c.kind = 'character';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  select * into v_encounter from public.encounters e where e.id = v_attacker.encounter_id;
  select * into v_character from public.characters ch where ch.id = v_attacker.character_id;
  select c.* into v_target from public.combatants c where c.id = p_target_id and c.encounter_id = v_attacker.encounter_id;
  if not found then
    raise exception 'That target isn''t in this fight' using errcode = '22023';
  end if;
  if not private.acts_for(v_attacker, false) then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  if (p_roll -> 'dice') is distinct from '[{"sides": 20, "count": 1}]'::jsonb then
    raise exception 'An attack is a single d20' using errcode = '22023';
  end if;

  -- Flurry of Blows' second strike: the bonus action already went on the first.
  v_flurries := (
    select count(*) from public.combat_events ev
    where ev.encounter_id = v_attacker.encounter_id and ev.actor_id = v_attacker.id
      and ev.round = v_encounter.round and not ev.undone and ev.shown ->> 'bonusAttack' = 'flurry'
  );

  if not private.is_campaign_dm(v_attacker.campaign_id) then
    if p_kind in ('martialArts', 'flurry') and v_character.class not ilike '%monk%' then
      raise exception 'Only a monk can do that' using errcode = '22023';
    end if;
    if p_kind = 'flurry' and v_character.level < 2 then
      raise exception 'Flurry of Blows comes at monk level 2' using errcode = '22023';
    end if;
    if p_kind = 'frenzy' and not exists (
      select 1 from jsonb_array_elements(v_character.effects) e where e ->> 'key' = 'rage'
    ) then
      raise exception 'You need to be raging to attack in a frenzy' using errcode = '22023';
    end if;
    if p_kind <> 'frenzy' and v_attacker.attacks_made = 0 then
      raise exception 'Attack with your action first' using errcode = '22023';
    end if;
    if p_kind = 'flurry' and v_flurries >= 2 then
      raise exception 'Flurry of Blows is two strikes' using errcode = '22023';
    end if;
    if v_attacker.bonus_used and not (p_kind = 'flurry' and v_flurries = 1) then
      raise exception 'You have used your bonus action this turn' using errcode = '22023';
    end if;
  end if;

  v_result := private.settle_attack(v_attacker, v_target, p_roll, false);
  -- The attack spent the bonus action, not the action.
  update public.combatants
  set action_used = v_attacker.action_used, attacks_made = v_attacker.attacks_made, bonus_used = true
  where id = v_attacker.id;
  update public.combat_events
  set shown = shown || jsonb_build_object('bonusAttack', p_kind) || case when p_kind = 'offhand'
    then '{"offhand": true}'::jsonb else '{}'::jsonb end
  where id = (v_result -> 'event' ->> 'id')::uuid
  returning * into v_event;
  return jsonb_build_object('roll', v_result -> 'roll', 'event', to_jsonb(v_event));
end
$$;

revoke execute on function public.bonus_attack(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.bonus_attack(uuid, uuid, jsonb, text) to authenticated;
