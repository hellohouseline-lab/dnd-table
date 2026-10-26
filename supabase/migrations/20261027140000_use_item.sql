-- C2c: using something from your pack in a fight. It takes your action, as the 2014 rules say
-- (decision 36), and it comes out of the inventory (or a use off a healer's kit):
--   * a potion of healing heals you, or someone you give it to, by its dice (thrown here);
--   * a healer's kit steadies a friend at 0 hit points;
--   * alchemist's fire, acid and holy water are thrown: an attack roll, settled like any other;
--   * antitoxin gives an hour of advantage on saves against poison;
--   * caltrops and ball bearings are scattered (the DM places them).
-- The feed says what happened. Players use their own character's items on their turn; the DM can
-- for anyone.

create function public.use_item(p_combatant_id uuid, p_item_id text, p_target_id uuid, p_roll jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_character public.characters;
  v_dm boolean;
  v_item jsonb;
  v_index text;
  v_name text;
  v_target public.combatants;
  v_target_character public.characters;
  v_dice integer;
  v_sides integer := 4;
  v_bonus integer;
  v_roll public.rolls;
  v_result jsonb;
  v_event public.combat_events;
  v_shown jsonb;
  v_record jsonb;
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
  v_dm := private.is_campaign_dm(v_combatant.campaign_id);
  if not v_dm and (v_combatant.action_used or v_combatant.attacks_made > 0) then
    raise exception 'You have used your action this turn' using errcode = '22023';
  end if;

  select * into v_character from public.characters ch where ch.id = v_combatant.character_id;
  select e into v_item from jsonb_array_elements(v_character.inventory) e where e ->> 'id' = p_item_id;
  if v_item is null then
    raise exception 'You don''t have that' using errcode = '22023';
  end if;
  if coalesce((v_item ->> 'quantity')::integer, 0) <= 0 or coalesce((v_item ->> 'uses')::integer, 1) <= 0 then
    raise exception 'There''s none left' using errcode = '22023';
  end if;
  v_index := v_item ->> 'item';
  v_name := left(coalesce(v_item ->> 'name', v_index, 'an item'), 60);
  v_record := private.turn_record(v_combatant);

  if p_target_id is not null then
    select c.* into v_target from public.combatants c where c.id = p_target_id and c.encounter_id = v_combatant.encounter_id;
    if not found then
      raise exception 'That target isn''t in this fight' using errcode = '22023';
    end if;
    select * into v_target_character from public.characters ch where ch.id = v_target.character_id;
  else
    v_target := v_combatant;
    v_target_character := v_character;
  end if;

  if v_index like 'potion-of-healing-%' then
    if v_target_character.id is null then
      raise exception 'Potions are for people in the party' using errcode = '22023';
    end if;
    select dice, bonus into v_dice, v_bonus from (values
      ('potion-of-healing-common', 2, 2), ('potion-of-healing-greater', 4, 4),
      ('potion-of-healing-superior', 8, 8), ('potion-of-healing-supreme', 10, 20)
    ) as p (item, dice, bonus) where p.item = v_index;
    if v_dice is null then
      raise exception 'Unknown potion' using errcode = '22023';
    end if;
    v_roll := public.throw_dice(v_combatant.campaign_id, jsonb_build_object(
      'label', v_name, 'kind', 'free', 'character_id', v_character.id,
      'dice', jsonb_build_array(jsonb_build_object('sides', v_sides, 'count', v_dice)),
      'modifier', v_bonus, 'parts', '[]'::jsonb, 'mode', 'normal', 'secret', false
    ));
    update public.characters
    set current_hp = least(max_hp, current_hp + v_roll.total)
    where id = v_target_character.id;
    v_shown := jsonb_build_object('what', 'item', 'item', v_name, 'heal', v_roll.total);

  elsif v_index = 'healers-kit' then
    if v_target_character.id is null or v_target_character.current_hp > 0 or v_target_character.dead then
      raise exception 'A healer''s kit steadies someone at 0 hit points' using errcode = '22023';
    end if;
    update public.characters set stable = true where id = v_target_character.id;
    v_shown := jsonb_build_object('what', 'item', 'item', v_name, 'stabilised', true);

  elsif v_index in ('alchemists-fire-flask', 'acid-vial', 'holy-water-flask') then
    if p_target_id is null or v_target.id = v_combatant.id then
      raise exception 'Pick who to throw it at' using errcode = '22023';
    end if;
    if (p_roll -> 'dice') is distinct from '[{"sides": 20, "count": 1}]'::jsonb then
      raise exception 'A throw is a single d20' using errcode = '22023';
    end if;
    v_result := private.settle_attack(v_combatant, v_target, p_roll || jsonb_build_object('label', v_name), false);
    update public.combat_events set shown = shown || jsonb_build_object('item', v_name)
    where id = (v_result -> 'event' ->> 'id')::uuid
    returning * into v_event;

  elsif v_index = 'antitoxin-vial' then
    update public.characters
    set effects = coalesce((select jsonb_agg(e) from jsonb_array_elements(effects) e where e ->> 'key' <> 'antitoxin'), '[]'::jsonb)
      || '[{"key": "antitoxin", "name": "Antitoxin", "roundsLeft": 600}]'::jsonb
    where id = v_character.id;
    v_shown := jsonb_build_object('what', 'item', 'item', v_name);

  elsif v_index in ('caltrops', 'ball-bearings-bag-of-1000') then
    v_shown := jsonb_build_object('what', 'item', 'item', v_name, 'scattered', true);

  else
    raise exception 'The table doesn''t know how to use that yet' using errcode = '22023';
  end if;

  -- One fewer, or one use fewer off a kit; gone when none are left.
  update public.characters ch
  set inventory = coalesce((
    select jsonb_agg(
      case
        when e ->> 'id' <> p_item_id then e
        when e ? 'uses' and jsonb_typeof(e -> 'uses') = 'number' then jsonb_set(e, '{uses}', to_jsonb((e ->> 'uses')::integer - 1))
        else jsonb_set(e, '{quantity}', to_jsonb((e ->> 'quantity')::integer - 1))
      end
    )
    from jsonb_array_elements(ch.inventory) e
    where not (e ->> 'id' = p_item_id and coalesce((e ->> 'quantity')::integer, 1) <= 1
               and not (e ? 'uses' and jsonb_typeof(e -> 'uses') = 'number' and (e ->> 'uses')::integer > 1))
  ), '[]'::jsonb)
  where ch.id = v_character.id;

  -- It took the action (a throw too, which isn't the Attack action, so no extra attacks).
  update public.combatants
  set action_used = true, attacks_made = v_combatant.attacks_made
  where id = v_combatant.id;

  if v_event.id is null then
    v_event := private.add_event(
      v_combatant, case when v_target.id = v_combatant.id then null else v_target.id end, 'action', v_roll.id,
      v_shown, null, v_record, null
    );
  end if;
  return jsonb_build_object('event', to_jsonb(v_event), 'roll', case when v_roll.id is null then v_result -> 'roll' else to_jsonb(v_roll) end);
end
$$;

revoke execute on function public.use_item(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.use_item(uuid, text, uuid, jsonb) to authenticated;
