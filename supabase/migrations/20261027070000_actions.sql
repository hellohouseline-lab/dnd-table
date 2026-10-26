-- Every action in a turn (2014 rules, Matt's T1 notes): Dash, Disengage, Dodge, Hide, Help, Search,
-- Ready and Use an Object each take the action. A rogue from level 2 (Cunning Action) can Dash,
-- Disengage or Hide as a bonus action instead; a monk from level 2 can Dash or Disengage (Step of
-- the Wind) or Dodge (Patient Defense) as a bonus action (their ki isn't counted yet). An off-hand
-- attack with a light weapon (two-weapon fighting) takes the bonus action after attacking.

create or replace function public.use_action(p_combatant_id uuid, p_what text)
returns public.combat_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_dm boolean;
  v_move text := regexp_replace(p_what, '^bonus_', '');
  v_bonus boolean := p_what = 'bonus' or p_what like 'bonus\_%';
  v_class text;
  v_level integer;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if p_what not in (
    'action', 'dash', 'disengage', 'dodge', 'hide', 'help', 'search', 'ready', 'object', 'bonus', 'reaction',
    'bonus_dash', 'bonus_disengage', 'bonus_hide', 'bonus_dodge'
  ) then
    raise exception 'Unknown action' using errcode = '22023';
  end if;
  if not private.acts_for(v_combatant, p_what = 'reaction') then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  v_dm := private.is_campaign_dm(v_combatant.campaign_id);
  select lower(ch.class), ch.level into v_class, v_level from public.characters ch where ch.id = v_combatant.character_id;

  if not v_dm then
    if not v_bonus and p_what <> 'reaction' and (v_combatant.action_used or v_combatant.attacks_made > 0) then
      raise exception 'You have used your action this turn' using errcode = '22023';
    end if;
    if v_bonus and v_combatant.bonus_used then
      raise exception 'You have used your bonus action this turn' using errcode = '22023';
    end if;
    if p_what = 'reaction' and v_combatant.reaction_used then
      raise exception 'You have used your reaction' using errcode = '22023';
    end if;
    if p_what in ('bonus_dash', 'bonus_disengage', 'bonus_hide', 'bonus_dodge') and not (
      (coalesce(v_class, '') like '%rogue%' and v_level >= 2 and v_move in ('dash', 'disengage', 'hide'))
      or (coalesce(v_class, '') like '%monk%' and v_level >= 2 and v_move in ('dash', 'disengage', 'dodge'))
    ) then
      raise exception 'Only a rogue (Cunning Action) or a monk can do that as a bonus action' using errcode = '22023';
    end if;
  end if;

  update public.combatants c
  set action_used = c.action_used or (not v_bonus and p_what <> 'reaction'),
      bonus_used = c.bonus_used or v_bonus,
      reaction_used = c.reaction_used or p_what = 'reaction',
      extra_feet = c.extra_feet + case when v_move = 'dash' then private.speed_of(c) else 0 end,
      disengaged = c.disengaged or v_move = 'disengage',
      dodging = c.dodging or v_move = 'dodge'
  where c.id = p_combatant_id;

  return private.add_event(
    v_combatant, null, 'action', null, jsonb_build_object('what', p_what), null, private.turn_record(v_combatant), null
  );
end
$$;

-- Two-weapon fighting: after attacking with a light melee weapon, a second attack with another light
-- weapon for the bonus action. The damage leaves out the ability bonus (the roll says so).
create function public.offhand_attack(p_attacker_id uuid, p_target_id uuid, p_roll jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_attacker public.combatants;
  v_target public.combatants;
  v_result jsonb;
  v_event public.combat_events;
begin
  select c.* into v_attacker
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_attacker_id and c.kind = 'character';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
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
  if not private.is_campaign_dm(v_attacker.campaign_id) then
    if v_attacker.attacks_made = 0 then
      raise exception 'Attack with your main weapon first' using errcode = '22023';
    end if;
    if v_attacker.bonus_used then
      raise exception 'You have used your bonus action this turn' using errcode = '22023';
    end if;
  end if;

  v_result := private.settle_attack(v_attacker, v_target, p_roll, false);
  -- The attack spent the bonus action, not the action.
  update public.combatants
  set action_used = v_attacker.action_used, attacks_made = v_attacker.attacks_made, bonus_used = true
  where id = v_attacker.id;
  update public.combat_events set shown = shown || '{"offhand": true}'::jsonb
  where id = (v_result -> 'event' ->> 'id')::uuid
  returning * into v_event;
  return jsonb_build_object('roll', v_result -> 'roll', 'event', to_jsonb(v_event));
end
$$;

revoke execute on function public.offhand_attack(uuid, uuid, jsonb) from public, anon;
grant execute on function public.offhand_attack(uuid, uuid, jsonb) to authenticated;
