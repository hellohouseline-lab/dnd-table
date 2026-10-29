-- P1c, Play as the monsters: a monster's ability with a saving throw (a dragon's Acid Breath, its
-- Frightful Presence, anything in its stat block with a DC). The DM picks who it
-- catches; the server rolls the damage once, behind the screen, then each target's save against the
-- DC, and takes off the full damage, half or none. The DC stays behind the screen: the feed says who
-- made or failed the save and what they took, never the number.

create function public.monster_ability(
  p_combatant_id uuid,
  p_ability jsonb,
  p_target_ids uuid[],
  p_roll jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_monster public.combatants;
  v_spent public.combatants;
  v_name text := left(btrim(coalesce(p_ability ->> 'name', '')), 60);
  v_cost text := coalesce(p_ability ->> 'cost', 'action');
  v_save text := p_ability ->> 'save';
  v_dc integer := (p_ability ->> 'dc')::integer;
  v_success text := coalesce(p_ability ->> 'dcSuccess', 'none');
  v_type text := lower(left(coalesce(p_ability ->> 'damageType', ''), 30));
  v_record jsonb;
  v_targets public.combatants[];
  v_target public.combatants;
  v_effect public.rolls;
  v_total integer := 0;
  v_d20 integer;
  v_passed boolean;
  v_result jsonb;
  v_event public.combat_events;
  v_events jsonb := '[]';
  v_first boolean := true;
begin
  select c.* into v_monster
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id and c.kind = 'monster';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not private.is_campaign_dm(v_monster.campaign_id) then
    raise exception 'Only the DM plays the monsters' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Name the ability' using errcode = '22023';
  end if;
  if v_cost not in ('action', 'bonus', 'reaction', 'legendary') then
    raise exception 'Unknown cost' using errcode = '22023';
  end if;
  if v_save not in ('strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma') then
    raise exception 'Which saving throw does it ask for?' using errcode = '22023';
  end if;
  if v_dc is null or v_dc not between 1 and 30 then
    raise exception 'The DC must be between 1 and 30' using errcode = '22023';
  end if;
  if v_success not in ('half', 'none') then
    raise exception 'Unknown result of a save' using errcode = '22023';
  end if;

  select coalesce(array_agg(c order by array_position(p_target_ids, c.id)), '{}') into v_targets
  from public.combatants c
  where c.encounter_id = v_monster.encounter_id and c.id = any (coalesce(p_target_ids, '{}'));
  if cardinality(v_targets) = 0 then
    raise exception 'Pick who it catches' using errcode = '22023';
  end if;

  -- What Undo puts back: the turn as it was. A legendary action costs nothing of its own turn.
  v_record := private.turn_record(v_monster);
  update public.combatants
  set action_used = action_used or v_cost = 'action',
      bonus_used = bonus_used or v_cost = 'bonus',
      reaction_used = reaction_used or v_cost = 'reaction'
  where id = v_monster.id
  returning * into v_spent;

  -- The damage, thrown once and behind the screen, as a monster's attacks are.
  if jsonb_typeof(p_roll -> 'dice') = 'array' and jsonb_array_length(p_roll -> 'dice') > 0 then
    v_effect := public.throw_dice(
      v_monster.campaign_id,
      jsonb_build_object(
        'label', v_name || ' damage', 'kind', 'free',
        'dice', p_roll -> 'dice', 'modifier', coalesce((p_roll ->> 'modifier')::integer, 0),
        'parts', '[]'::jsonb, 'mode', 'normal', 'secret', true
      )
    );
    v_total := greatest(0, v_effect.total);
  end if;

  foreach v_target in array v_targets loop
    v_result := null;
    v_d20 := private.random_die(20);
    v_passed := v_d20 + private.save_bonus(v_target, v_save) >= v_dc;
    if v_total > 0 then
      v_result := private.apply_damage(
        v_target,
        case when not v_passed then v_total when v_success = 'half' then v_total / 2 else 0 end,
        v_type, false, false
      );
    end if;
    v_event := private.add_event(
      v_spent,
      v_target.id,
      'spell',
      v_effect.id,
      jsonb_build_object(
        'spell', v_name,
        'monster', true,
        'save', case when v_passed then 'passed' else 'failed' end,
        'saveAbility', v_save,
        -- A character's own total is theirs to see; a monster's only passes or fails.
        'saveTotal', case when v_target.kind = 'character' then v_d20 + private.save_bonus(v_target, v_save) end,
        'damage', (v_result ->> 'damage')::integer,
        'damageType', case when v_result is not null then v_type end,
        'adjust', v_result ->> 'adjust',
        'down', coalesce((v_result ->> 'down')::boolean, false)
      ),
      v_result -> 'before',
      -- Only the first event gives the turn back on Undo.
      case when v_first then v_record end,
      null
    );
    v_first := false;
    v_events := v_events || to_jsonb(v_event);
  end loop;

  return jsonb_build_object('roll', to_jsonb(v_effect), 'events', v_events);
end
$$;

revoke execute on function public.monster_ability(uuid, jsonb, uuid[], jsonb) from public, anon;
grant execute on function public.monster_ability(uuid, jsonb, uuid[], jsonb) to authenticated;
