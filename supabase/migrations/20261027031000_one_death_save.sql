-- One death save a turn. Rolling it uses the turn's action (someone unconscious can't act anyway),
-- so the button can't be pressed twice; Undo gives it back.

create or replace function public.death_save(p_combatant_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_character public.characters;
  v_roll public.rolls;
  v_result text;
  v_event public.combat_events;
  v_before jsonb;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id and c.kind = 'character';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not private.acts_for(v_combatant, false) then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  select * into v_character from public.characters ch where ch.id = v_combatant.character_id;
  if v_character.current_hp > 0 or v_character.stable or v_character.dead then
    raise exception 'Only someone dying makes death saves' using errcode = '22023';
  end if;
  if v_combatant.action_used then
    raise exception 'One death save a turn' using errcode = '22023';
  end if;
  v_before := jsonb_build_object(
    'current_hp', v_character.current_hp, 'temp_hp', v_character.temp_hp, 'conditions', to_jsonb(v_character.conditions),
    'death_save_successes', v_character.death_save_successes, 'death_save_failures', v_character.death_save_failures,
    'stable', v_character.stable, 'dead', v_character.dead
  );

  v_roll := public.throw_dice(
    v_combatant.campaign_id,
    jsonb_build_object(
      'label', 'Death saving throw', 'kind', 'save', 'character_id', v_character.id,
      'dice', '[{"sides": 20, "count": 1}]'::jsonb, 'modifier', 0, 'parts', '[]'::jsonb,
      'mode', 'normal', 'secret', false
    )
  );

  if v_roll.natural_d20 = 20 then
    -- Back on their feet with 1 hit point (the trigger clears the saves and Unconscious).
    update public.characters set current_hp = 1 where id = v_character.id returning * into v_character;
    v_result := 'awake';
  else
    update public.characters ch
    set death_save_successes = least(3, ch.death_save_successes + case when v_roll.total >= 10 then 1 else 0 end),
        death_save_failures = least(3, ch.death_save_failures
          + case when v_roll.natural_d20 = 1 then 2 when v_roll.total < 10 then 1 else 0 end)
    where ch.id = v_character.id
    returning * into v_character;
    update public.characters ch
    set stable = ch.death_save_successes >= 3,
        dead = ch.death_save_failures >= 3
    where ch.id = v_character.id
    returning * into v_character;
    v_result := case
      when v_character.dead then 'dead'
      when v_character.stable then 'stable'
      when v_roll.total >= 10 then 'success'
      else 'failure'
    end;
  end if;

  update public.rolls set passed = v_roll.total >= 10, passed_by_dice = v_roll.total >= 10
  where id = v_roll.id returning * into v_roll;
  -- The save takes the turn (someone unconscious can't act anyway); Undo gives it back.
  update public.combatants set action_used = true where id = v_combatant.id;

  v_event := private.add_event(
    v_combatant, v_combatant.id, 'death_save', v_roll.id,
    jsonb_build_object(
      'result', v_result, 'rolled', v_roll.natural_d20,
      'successes', v_character.death_save_successes, 'failures', v_character.death_save_failures
    ),
    v_before, private.turn_record(v_combatant), null
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event));
end
$$;

