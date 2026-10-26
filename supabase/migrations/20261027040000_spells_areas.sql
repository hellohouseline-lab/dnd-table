-- C1b: spells and areas on the map (docs/COMBAT_PLAN.md, and Fable's spec of 27 October).
--
-- Casting a spell in a fight: the spell must be on the caster's sheet; it spends a slot (cantrips
-- none) and the action, bonus action or reaction its casting time asks for. Then, by what the spell
-- does: an attack roll goes through the same path as a weapon attack; a saving throw is rolled on
-- the server for each creature caught (players see a monster's pass or fail, never its numbers) with
-- the damage halved or stopped on a success; Magic Missile style damage just lands; healing heals.
-- Anything else (Bless, Darkness) is posted to the feed. A spell with a lasting area (Darkness,
-- Silence) leaves it on the map.
--
-- Concentration. Casting a concentration spell ends the one before (and its area). Taking damage
-- while concentrating sets a Constitution save to make, DC 10 or half the damage; the caster rolls
-- it on the server, and a failure ends the spell. Dropping to 0 hit points ends it too.
--
-- Areas. Shapes on the battle map: a sphere, cube, cone, line or cylinder, by size and where they
-- start. The DM adds and removes them at any time (a dragon's breath, a fog bank); a caster's come
-- with the spell and go when their concentration does. Players see those on the map on stage,
-- unless the DM hid one.

-- ---------------------------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------------------------

-- A monster's six saving throw bonuses, worked out when it joins the fight: { "dexterity": 2 }.
alter table public.combatant_secrets
  add column saves jsonb not null default '{}' check (jsonb_typeof(saves) = 'object' and pg_column_size(saves) <= 1000);
grant update (saves) on public.combatant_secrets to authenticated;

-- The Constitution save a concentrating caster owes after taking damage (DC 10 or half the damage).
-- Set and cleared by the server only.
alter table public.characters
  add column concentration_dc smallint check (concentration_dc between 10 and 99);

alter table public.combat_events drop constraint combat_events_kind_check;
alter table public.combat_events add constraint combat_events_kind_check
  check (kind in ('attack', 'action', 'death_save', 'spell', 'concentration'));

-- ---------------------------------------------------------------------------------------------
-- Areas on the map
-- ---------------------------------------------------------------------------------------------

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  map_id uuid not null references public.assets (id) on delete cascade,
  shape text not null check (shape in ('sphere', 'cube', 'cone', 'line', 'cylinder')),
  -- A sphere's or cylinder's radius; a cube's side; a cone's or line's length.
  size_ft smallint not null check (size_ft between 5 and 500),
  -- Where it starts, in grid squares from the top left (halves allowed: a corner between squares).
  origin_x numeric(6, 1) not null check (origin_x between -10 and 510),
  origin_y numeric(6, 1) not null check (origin_y between -10 and 510),
  -- Which way a cone, line or cube points, in degrees (0 is right, 90 is down).
  direction smallint not null default 0 check (direction between 0 and 359),
  label text not null default '' check (char_length(label) <= 60),
  -- How it looks: harm (orange), help (blue) or block (grey, such as Darkness).
  tone text not null default 'harm' check (tone in ('harm', 'help', 'block')),
  -- The character who cast it, if one did; it goes when their concentration does.
  character_id uuid references public.characters (id) on delete set null,
  concentration boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index areas_campaign_map_idx on public.areas (campaign_id, map_id);
create index areas_character_idx on public.areas (character_id);

alter table public.areas enable row level security;
revoke all on public.areas from anon, authenticated;
grant select, insert, delete on public.areas to authenticated;
grant update (shape, size_ft, origin_x, origin_y, direction, label, tone, hidden) on public.areas to authenticated;

create policy "The DM sees every area; players those on the map on stage"
  on public.areas for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or (private.is_campaign_member(campaign_id) and not hidden and map_id = private.on_stage_map(campaign_id))
  );

create policy "Only the DM adds, moves and removes areas by hand"
  on public.areas for all to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (
    private.is_real_user() and private.is_campaign_dm(campaign_id)
    and exists (select 1 from public.assets a where a.id = areas.map_id and a.campaign_id = areas.campaign_id)
  );

alter publication supabase_realtime add table public.areas;

-- ---------------------------------------------------------------------------------------------
-- Hit points, death saves and concentration
-- ---------------------------------------------------------------------------------------------

-- Whatever changes a character's hit points (an attack, a spell, the DM's buttons): dropping to 0
-- knocks them unconscious and ends their concentration; coming back above 0 clears the death saves;
-- taking damage while concentrating sets the save to make. Ending concentration (by casting another
-- spell, failing the save or Lost it) takes its area off the map.
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

drop trigger characters_hit_points on public.characters;
create trigger characters_hit_points
  before update on public.characters
  for each row execute function private.on_hit_points();

-- ---------------------------------------------------------------------------------------------
-- Small rules
-- ---------------------------------------------------------------------------------------------

create function private.ability_mod(p_score integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select floor((p_score - 10) / 2.0)::integer
$$;

create function private.proficiency(p_level integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select 2 + (greatest(p_level, 1) - 1) / 4
$$;

create function private.score_of(p_character public.characters, p_ability text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_ability
    when 'strength' then p_character.strength
    when 'dexterity' then p_character.dexterity
    when 'constitution' then p_character.constitution
    when 'intelligence' then p_character.intelligence
    when 'wisdom' then p_character.wisdom
    when 'charisma' then p_character.charisma
    else 10
  end
$$;

-- A creature's saving throw bonus: a character's ability modifier, plus proficiency if they have
-- it; a monster's from its stat block.
create function private.save_bonus(p_target public.combatants, p_ability text)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select private.ability_mod(private.score_of(ch, p_ability))
            + case when p_ability = any (ch.save_proficiencies) then private.proficiency(ch.level) else 0 end
     from public.characters ch where ch.id = p_target.character_id),
    (select (s.saves ->> p_ability)::integer from public.combatant_secrets s where s.combatant_id = p_target.id),
    0
  )
$$;

-- A caster's spell save DC: 8, plus proficiency, plus the spellcasting ability's modifier.
create function private.spell_dc(p_character public.characters)
returns integer
language sql
immutable
set search_path = ''
as $$
  select 8 + private.proficiency(p_character.level)
           + private.ability_mod(private.score_of(p_character, coalesce(p_character.spellcasting ->> 'ability', '')))
$$;

revoke execute on function private.ability_mod(integer) from public;
revoke execute on function private.proficiency(integer) from public;
revoke execute on function private.score_of(public.characters, text) from public;
revoke execute on function private.save_bonus(public.combatants, text) from public;
revoke execute on function private.spell_dc(public.characters) from public;

-- ---------------------------------------------------------------------------------------------
-- Damage: one path for attacks and spells
-- ---------------------------------------------------------------------------------------------

-- Takes damage off a combatant after its defences: temporary hit points first, then hit points; a
-- character already at 0 gets a death save failure (two for a critical hit). Returns what happened
-- and what Undo needs: { damage, adjust, down, before }.
create function private.apply_damage(
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
      select private.damage_adjustment(v_type, p_magical, ch.resistances, ch.vulnerabilities, ch.immunities)
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

revoke execute on function private.apply_damage(public.combatants, integer, text, boolean, boolean) from public;

-- The same attack as before, now taking its damage off through apply_damage.
create or replace function private.settle_attack(
  p_attacker public.combatants,
  p_target public.combatants,
  p_roll jsonb,
  p_reaction boolean
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_roll public.rolls;
  v_ac integer;
  v_hit boolean;
  v_result jsonb;
  v_event public.combat_events;
begin
  -- throw_dice checks the caller may roll for this character; a monster's attack is behind the screen.
  v_roll := public.throw_dice(
    p_attacker.campaign_id,
    p_roll - 'request_id'
      || jsonb_build_object(
        'kind', 'attack',
        'character_id', p_attacker.character_id,
        'secret', p_attacker.kind = 'monster'
      )
  );

  if p_target.kind = 'character' then
    select ch.armour_class into v_ac from public.characters ch where ch.id = p_target.character_id;
  else
    select s.ac into v_ac from public.combatant_secrets s where s.combatant_id = p_target.id;
  end if;
  v_hit := v_roll.natural_d20 = 20 or (v_roll.natural_d20 <> 1 and v_roll.total >= coalesce(v_ac, 10));

  v_result := private.apply_damage(
    p_target,
    case when v_hit then coalesce((v_roll.damage ->> 'total')::integer, 0) else 0 end,
    v_roll.damage ->> 'type',
    coalesce((p_roll ->> 'magical')::boolean, false),
    v_hit and v_roll.natural_d20 = 20
  );

  if p_reaction then
    update public.combatants set reaction_used = true where id = p_attacker.id;
  else
    update public.combatants
    set action_used = true, attacks_made = least(10, attacks_made + 1)
    where id = p_attacker.id;
  end if;

  -- The roll log shows hit or miss.
  update public.rolls set passed = v_hit, passed_by_dice = v_hit where id = v_roll.id returning * into v_roll;

  v_event := private.add_event(
    p_attacker,
    p_target.id,
    'attack',
    v_roll.id,
    jsonb_build_object(
      -- A monster's attack is labelled with its real name for the DM ("Goblin A: Scimitar"); the feed
      -- keeps just the action, so an unrevealed monster stays unknown.
      'label', case
        when p_attacker.kind = 'monster' then coalesce(nullif(split_part(v_roll.label, ': ', 2), ''), 'an attack')
        else v_roll.label
      end,
      'hit', v_hit,
      'critical', v_hit and v_roll.natural_d20 = 20,
      'damage', (v_result ->> 'damage')::integer,
      'damageType', coalesce(v_roll.damage ->> 'type', ''),
      -- 'resisted', 'vulnerable' or 'immune', once it has happened.
      'adjust', v_result ->> 'adjust',
      -- A player's own total is theirs to see; a monster's dice stay behind the screen.
      'total', case when p_attacker.kind = 'character' then v_roll.total end,
      'down', v_hit and (v_result ->> 'down')::boolean,
      'reaction', p_reaction
    ),
    v_result -> 'before',
    private.turn_record(p_attacker),
    v_ac
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event));
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Casting a spell
-- ---------------------------------------------------------------------------------------------

-- p_spell, from the spell's card: { index, name, level, cost ('action', 'bonus' or 'reaction'),
--   concentration, kind ('attack', 'save', 'damage', 'heal' or 'other'), save (the ability),
--   dcSuccess ('half' or 'none'), damageType }.
-- p_roll: for an attack, the attack roll (one d20 and its damage); otherwise the dice of what the
--   spell does ({ dice, modifier }), thrown once for everyone it touches.
-- p_target_ids: who it's aimed at, or who is caught in its area.
-- p_area: a lasting area to leave on the map ({ shape, size_ft, origin_x, origin_y, direction, tone }).
create function public.cast_spell(
  p_combatant_id uuid,
  p_spell jsonb,
  p_slot_level integer,
  p_target_ids uuid[],
  p_roll jsonb,
  p_area jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caster public.combatants;
  v_spent public.combatants;
  v_character public.characters;
  v_dm boolean;
  v_name text := left(btrim(coalesce(p_spell ->> 'name', '')), 60);
  v_level integer := least(9, greatest(0, coalesce((p_spell ->> 'level')::integer, 0)));
  v_slot integer := 0;
  v_cost text := coalesce(p_spell ->> 'cost', 'action');
  v_kind text := coalesce(p_spell ->> 'kind', 'other');
  v_save text := p_spell ->> 'save';
  v_success text := coalesce(p_spell ->> 'dcSuccess', 'none');
  v_type text := lower(left(coalesce(p_spell ->> 'damageType', ''), 30));
  v_concentration boolean := coalesce((p_spell ->> 'concentration')::boolean, false);
  v_record jsonb;
  v_target public.combatants;
  v_targets public.combatants[];
  v_effect public.rolls;
  v_total integer := 0;
  v_dc integer;
  v_d20 integer;
  v_passed boolean;
  v_result jsonb;
  v_events jsonb := '[]';
  v_event public.combat_events;
  v_attack jsonb;
  v_first boolean := true;
  v_map uuid;
  v_heal integer;
  v_before jsonb;
begin
  select c.* into v_caster
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id and c.kind = 'character';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if v_cost not in ('action', 'bonus', 'reaction') then
    raise exception 'That spell takes longer than a turn to cast' using errcode = '22023';
  end if;
  if v_kind not in ('attack', 'save', 'damage', 'heal', 'other') then
    raise exception 'Unknown kind of spell' using errcode = '22023';
  end if;
  if not private.acts_for(v_caster, v_cost = 'reaction') then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  v_dm := private.is_campaign_dm(v_caster.campaign_id);
  select * into v_character from public.characters ch where ch.id = v_caster.character_id;

  if v_name = '' or not exists (
    select 1 from jsonb_array_elements(coalesce(v_character.spellcasting -> 'spells', '[]')) s
    where (s ->> 'index' is not null and s ->> 'index' = p_spell ->> 'index') or lower(s ->> 'name') = lower(v_name)
  ) then
    raise exception 'That spell isn''t on your sheet' using errcode = '22023';
  end if;
  if v_character.current_hp = 0 then
    raise exception 'Nobody casts spells at 0 hit points' using errcode = '22023';
  end if;

  -- The slot: the spell's own level or higher. Cantrips need none.
  if v_level > 0 then
    v_slot := coalesce(p_slot_level, v_level);
    if v_slot < v_level or v_slot > 9 then
      raise exception 'A level % spell needs a slot of level % or higher', v_level, v_level using errcode = '22023';
    end if;
    if coalesce((v_character.spellcasting -> 'slotsUsed' ->> (v_slot - 1))::integer, 0)
       >= coalesce((v_character.spellcasting -> 'slotsMax' ->> (v_slot - 1))::integer, 0) then
      raise exception 'No level % slots left', v_slot using errcode = '22023';
    end if;
  end if;

  -- What it costs this turn.
  if not v_dm then
    if v_cost = 'action' and (v_caster.action_used or v_caster.attacks_made > 0) then
      raise exception 'You have used your action this turn' using errcode = '22023';
    elsif v_cost = 'bonus' and v_caster.bonus_used then
      raise exception 'You have used your bonus action this turn' using errcode = '22023';
    elsif v_cost = 'reaction' and v_caster.reaction_used then
      raise exception 'You have used your reaction' using errcode = '22023';
    end if;
  end if;

  -- What Undo puts back: the turn as it was, the slot, and the concentration before.
  v_record := private.turn_record(v_caster)
    || jsonb_build_object('slot_level', v_slot, 'concentration_before', v_character.concentration);

  update public.combatants
  set action_used = action_used or v_cost = 'action',
      bonus_used = bonus_used or v_cost = 'bonus',
      reaction_used = reaction_used or v_cost = 'reaction'
  where id = v_caster.id
  returning * into v_spent;

  if v_slot > 0 then
    update public.characters ch
    set spellcasting = jsonb_set(
      ch.spellcasting, array['slotsUsed', (v_slot - 1)::text],
      to_jsonb(coalesce((ch.spellcasting -> 'slotsUsed' ->> (v_slot - 1))::integer, 0) + 1)
    )
    where ch.id = v_character.id;
  end if;

  -- A new concentration spell ends the old one (and its area goes with it), even the same spell again.
  if v_concentration then
    update public.characters set concentration = null where id = v_character.id and concentration is not null;
    update public.characters set concentration = v_name where id = v_character.id;
  end if;

  -- A lasting area, on the battle map on stage.
  if p_area is not null and jsonb_typeof(p_area) = 'object' then
    v_map := private.on_stage_map(v_caster.campaign_id);
    if v_map is not null then
      insert into public.areas (
        campaign_id, map_id, shape, size_ft, origin_x, origin_y, direction, label, tone, character_id, concentration
      ) values (
        v_caster.campaign_id, v_map, p_area ->> 'shape', (p_area ->> 'size_ft')::smallint,
        (p_area ->> 'origin_x')::numeric, (p_area ->> 'origin_y')::numeric,
        coalesce((p_area ->> 'direction')::smallint, 0) % 360, v_name,
        coalesce(p_area ->> 'tone', 'harm'), v_character.id, v_concentration
      );
    end if;
  end if;

  select coalesce(array_agg(c order by array_position(p_target_ids, c.id)), '{}') into v_targets
  from public.combatants c
  where c.encounter_id = v_caster.encounter_id and c.id = any (coalesce(p_target_ids, '{}'));
  if v_kind in ('attack', 'damage', 'heal') and cardinality(v_targets) = 0 then
    raise exception 'Pick who the spell is for' using errcode = '22023';
  end if;

  -- An attack roll: the same path as a weapon attack, then the turn put as the spell left it.
  if v_kind = 'attack' then
    if (p_roll -> 'dice') is distinct from '[{"sides": 20, "count": 1}]'::jsonb then
      raise exception 'A spell attack is a single d20' using errcode = '22023';
    end if;
    v_attack := private.settle_attack(v_spent, v_targets[1], p_roll || jsonb_build_object('label', v_name), false);
    update public.combatants
    set action_used = v_spent.action_used, attacks_made = v_spent.attacks_made
    where id = v_caster.id;
    update public.combat_events
    set kind = 'spell', shown = shown || jsonb_build_object('spell', v_name, 'slot', v_slot, 'attack', true)
    where id = (v_attack -> 'event' ->> 'id')::uuid
    returning * into v_event;
    update public.combat_event_secrets set actor_before = v_record where event_id = v_event.id;
    return jsonb_build_object('roll', v_attack -> 'roll', 'events', jsonb_build_array(to_jsonb(v_event)));
  end if;

  -- The dice of what it does, thrown once (in the caster's dice, for everyone to see).
  if v_kind in ('save', 'damage', 'heal') and jsonb_typeof(p_roll -> 'dice') = 'array'
     and jsonb_array_length(p_roll -> 'dice') > 0 then
    v_effect := public.throw_dice(
      v_caster.campaign_id,
      jsonb_build_object(
        'label', v_name || case when v_kind = 'heal' then ' healing' else ' damage' end,
        'kind', 'free', 'character_id', v_character.id,
        'dice', p_roll -> 'dice', 'modifier', coalesce((p_roll ->> 'modifier')::integer, 0),
        'parts', '[]'::jsonb, 'mode', 'normal', 'secret', false
      )
    );
    v_total := greatest(0, v_effect.total);
  end if;

  if v_kind = 'save' then
    v_dc := private.spell_dc(v_character);
    if v_save not in ('strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma') then
      raise exception 'Which saving throw does it ask for?' using errcode = '22023';
    end if;
  end if;

  if cardinality(v_targets) = 0 then
    v_event := private.add_event(
      v_spent, null, 'spell', v_effect.id,
      jsonb_build_object('spell', v_name, 'slot', v_slot, 'dc', v_dc, 'save', null),
      null, v_record, null
    );
    v_events := v_events || to_jsonb(v_event);
  end if;

  foreach v_target in array v_targets loop
    v_result := null;
    v_passed := null;
    v_heal := null;
    v_before := null;
    if v_kind = 'save' then
      -- Rolled here: a character's total is shown; a monster's only passes or fails.
      v_d20 := private.random_die(20);
      v_passed := v_d20 + private.save_bonus(v_target, v_save) >= v_dc;
      if v_total > 0 then
        v_result := private.apply_damage(
          v_target,
          case when not v_passed then v_total when v_success = 'half' then v_total / 2 else 0 end,
          v_type, true, false
        );
      end if;
    elsif v_kind = 'damage' then
      v_result := private.apply_damage(v_target, v_total, v_type, true, false);
    elsif v_kind = 'heal' then
      v_heal := v_total;
      if v_target.kind = 'character' then
        select jsonb_build_object(
                 'current_hp', ch.current_hp, 'temp_hp', ch.temp_hp, 'conditions', to_jsonb(ch.conditions),
                 'death_save_successes', ch.death_save_successes, 'death_save_failures', ch.death_save_failures,
                 'stable', ch.stable, 'dead', ch.dead,
                 'concentration', ch.concentration, 'concentration_dc', ch.concentration_dc
               ) into v_before
        from public.characters ch where ch.id = v_target.character_id;
        update public.characters set current_hp = least(max_hp, current_hp + v_heal)
        where id = v_target.character_id and not dead;
      else
        select jsonb_build_object('hp', s.hp, 'health', v_target.health) into v_before
        from public.combatant_secrets s where s.combatant_id = v_target.id;
        update public.combatant_secrets set hp = least(max_hp, hp + v_heal) where combatant_id = v_target.id;
        update public.combatants c set health = (
          select private.health_word(s.hp, s.max_hp) from public.combatant_secrets s where s.combatant_id = v_target.id
        ) where c.id = v_target.id and exists (select 1 from public.combatant_secrets s where s.combatant_id = v_target.id);
      end if;
    end if;

    v_event := private.add_event(
      v_spent,
      v_target.id,
      'spell',
      v_effect.id,
      jsonb_build_object(
        'spell', v_name,
        'slot', v_slot,
        'save', case when v_passed is null then null when v_passed then 'passed' else 'failed' end,
        'saveAbility', v_save,
        'dc', v_dc,
        'saveTotal', case when v_target.kind = 'character' and v_d20 is not null and v_passed is not null
                          then v_d20 + private.save_bonus(v_target, v_save) end,
        'damage', (v_result ->> 'damage')::integer,
        'damageType', case when v_result is not null then v_type end,
        'adjust', v_result ->> 'adjust',
        'down', coalesce((v_result ->> 'down')::boolean, false),
        'heal', v_heal
      ),
      coalesce(v_result -> 'before', v_before),
      -- Only the first event gives the turn, slot and concentration back on Undo.
      case when v_first then v_record end,
      null
    );
    v_first := false;
    v_events := v_events || to_jsonb(v_event);
  end loop;

  return jsonb_build_object('roll', to_jsonb(v_effect), 'events', v_events);
end
$$;

revoke execute on function public.cast_spell(uuid, jsonb, integer, uuid[], jsonb, jsonb) from public, anon;
grant execute on function public.cast_spell(uuid, jsonb, integer, uuid[], jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Keeping concentration
-- ---------------------------------------------------------------------------------------------

-- The Constitution save after taking damage while concentrating, rolled on the server: a failure
-- ends the spell (and its area). The player rolls it for their own character, or the DM for them.
create function public.concentration_save(p_character_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_character public.characters;
  v_combatant public.combatants;
  v_roll public.rolls;
  v_kept boolean;
  v_event public.combat_events;
begin
  select * into v_character from public.characters ch where ch.id = p_character_id;
  if not found or not (
    private.is_campaign_dm(v_character.campaign_id)
    or (private.is_real_user() and v_character.owner_id = auth.uid())
  ) then
    raise exception 'That isn''t your character' using errcode = '42501';
  end if;
  if v_character.concentration is null or v_character.concentration_dc is null then
    raise exception 'There''s no concentration save to make' using errcode = '22023';
  end if;

  v_roll := public.throw_dice(
    v_character.campaign_id,
    jsonb_build_object(
      'label', 'Constitution save: keep concentrating on ' || v_character.concentration,
      'kind', 'save', 'character_id', v_character.id,
      'dice', '[{"sides": 20, "count": 1}]'::jsonb,
      'modifier', private.ability_mod(v_character.constitution)
        + case when 'constitution' = any (v_character.save_proficiencies) then private.proficiency(v_character.level) else 0 end,
      'parts', '[]'::jsonb, 'mode', 'normal', 'secret', false
    )
  );
  v_kept := v_roll.total >= v_character.concentration_dc;
  update public.rolls set passed = v_kept, passed_by_dice = v_kept where id = v_roll.id returning * into v_roll;

  if v_kept then
    update public.characters set concentration_dc = null where id = v_character.id;
  else
    update public.characters set concentration = null where id = v_character.id;
  end if;

  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.character_id = v_character.id;
  if found then
    v_event := private.add_event(
      v_combatant, v_combatant.id, 'concentration', v_roll.id,
      jsonb_build_object(
        'spell', v_character.concentration, 'dc', v_character.concentration_dc, 'total', v_roll.total, 'kept', v_kept
      ),
      jsonb_build_object(
        'current_hp', v_character.current_hp, 'temp_hp', v_character.temp_hp, 'conditions', to_jsonb(v_character.conditions),
        'concentration', v_character.concentration, 'concentration_dc', v_character.concentration_dc
      ),
      null, null
    );
  end if;
  return jsonb_build_object('roll', to_jsonb(v_roll), 'kept', v_kept, 'event', to_jsonb(v_event));
end
$$;

revoke execute on function public.concentration_save(uuid) from public, anon;
grant execute on function public.concentration_save(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Undo: the slot, concentration and its save come back too
-- ---------------------------------------------------------------------------------------------

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
  if not found or not private.is_campaign_dm(v_event.campaign_id) then
    raise exception 'Only the DM can undo' using errcode = '42501';
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
