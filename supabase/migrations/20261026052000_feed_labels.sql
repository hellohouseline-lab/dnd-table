-- The feed must never carry a monster's real name. Its attack roll is labelled "Goblin A: Scimitar"
-- for the DM's roll log, so the feed now keeps only the action's name for monsters.

create or replace function public.resolve_attack(p_attacker_id uuid, p_target_id uuid, p_roll jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_attacker public.combatants;
  v_target public.combatants;
  v_dm boolean;
  v_allowed integer := 1;
  v_roll public.rolls;
  v_ac integer;
  v_hit boolean;
  v_damage integer := 0;
  v_temp integer;
  v_hp integer;
  v_max integer;
  v_target_before jsonb;
  v_event public.combat_events;
begin
  select c.* into v_attacker
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_attacker_id;
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
  v_dm := private.is_campaign_dm(v_attacker.campaign_id);

  if v_attacker.kind = 'character' then
    select private.attacks_per_action(ch.class, ch.level) into v_allowed
    from public.characters ch where ch.id = v_attacker.character_id;
  end if;
  if not v_dm then
    if v_attacker.attacks_made = 0 and v_attacker.action_used then
      raise exception 'You have used your action this turn' using errcode = '22023';
    end if;
    if v_attacker.attacks_made >= v_allowed then
      raise exception 'You have made all your attacks this turn' using errcode = '22023';
    end if;
  end if;

  -- throw_dice checks the caller may roll for this character; a monster's attack is behind the screen.
  v_roll := public.throw_dice(
    v_attacker.campaign_id,
    p_roll - 'request_id'
      || jsonb_build_object(
        'kind', 'attack',
        'character_id', v_attacker.character_id,
        'secret', v_attacker.kind = 'monster'
      )
  );

  if v_target.kind = 'character' then
    select ch.armour_class into v_ac from public.characters ch where ch.id = v_target.character_id;
  else
    select s.ac into v_ac from public.combatant_secrets s where s.combatant_id = v_target.id;
  end if;
  v_hit := v_roll.natural_d20 = 20 or (v_roll.natural_d20 <> 1 and v_roll.total >= coalesce(v_ac, 10));
  if v_hit then
    v_damage := greatest(0, coalesce((v_roll.damage ->> 'total')::integer, 0));
  end if;

  if v_target.kind = 'character' then
    select jsonb_build_object('current_hp', ch.current_hp, 'temp_hp', ch.temp_hp, 'conditions', to_jsonb(ch.conditions)),
           least(ch.temp_hp, v_damage), ch.current_hp
      into v_target_before, v_temp, v_hp
    from public.characters ch where ch.id = v_target.character_id;
    v_hp := greatest(0, v_hp - (v_damage - v_temp));
    update public.characters ch
    set temp_hp = ch.temp_hp - v_temp,
        current_hp = v_hp,
        conditions = case
          when v_hp = 0 and not ('unconscious' = any (ch.conditions)) then array_append(ch.conditions, 'unconscious')
          else ch.conditions
        end
    where ch.id = v_target.character_id;
  else
    select jsonb_build_object('hp', s.hp, 'health', v_target.health), s.hp, s.max_hp
      into v_target_before, v_hp, v_max
    from public.combatant_secrets s where s.combatant_id = v_target.id;
    if v_hp is not null then
      v_hp := greatest(0, v_hp - v_damage);
      update public.combatant_secrets set hp = v_hp where combatant_id = v_target.id;
      update public.combatants set health = private.health_word(v_hp, v_max) where id = v_target.id;
    end if;
  end if;

  update public.combatants
  set action_used = true, attacks_made = least(10, attacks_made + 1)
  where id = v_attacker.id;

  -- The roll log shows hit or miss.
  update public.rolls set passed = v_hit, passed_by_dice = v_hit where id = v_roll.id returning * into v_roll;

  v_event := private.add_event(
    v_attacker,
    v_target.id,
    'attack',
    v_roll.id,
    jsonb_build_object(
      -- A monster's attack is labelled with its real name for the DM ("Goblin A: Scimitar"); the feed
      -- keeps just the action, so an unrevealed monster stays unknown.
      'label', case
        when v_attacker.kind = 'monster' then coalesce(nullif(split_part(v_roll.label, ': ', 2), ''), 'an attack')
        else v_roll.label
      end,
      'hit', v_hit,
      'critical', v_hit and v_roll.natural_d20 = 20,
      'damage', v_damage,
      'damageType', coalesce(v_roll.damage ->> 'type', ''),
      -- A player's own total is theirs to see; a monster's dice stay behind the screen.
      'total', case when v_attacker.kind = 'character' then v_roll.total end,
      'down', v_hit and coalesce(v_hp, 1) = 0
    ),
    v_target_before,
    private.turn_record(v_attacker),
    v_ac
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event));
end
$$;
