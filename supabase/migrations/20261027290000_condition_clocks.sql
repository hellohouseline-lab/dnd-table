-- C3a: conditions that wear off (docs/C3_PLAN.md, decisions 72 to 79).
--
-- A condition in a fight can carry a clock, kept on its creature's row in the fight
-- (combatants.condition_clocks, one per condition):
--   { condition, rounds (left, or null), endOfNextTurn, save: { ability, dc, secret } or null,
--     caster: { characterId, spell } or null, escapeDc (or null), started, owed }
-- * Rounds come off as the creature's turn starts; at 0 the condition ends.
-- * "Until the end of its next turn" ends as that turn ends (once a turn of its own has started).
-- * A save each turn is rolled at the end of the creature's turn: by the server for a monster (the
--   dice go to the DM's roll log only); a player's is owed, and they roll it with condition_save.
-- * A caster's concentration ending ends the conditions tied to it.
-- * When a fight ends, a minute passes: anything timed to a minute or less, or saved off, ends.
-- A secret save DC never sits on the row players read: it lives in clock_secrets, for the DM.
-- Players can Stand up (half their speed) and Break free (their action, Athletics or Acrobatics
-- against the escape DC). Undead Fortitude now happens by itself (decision 79).
-- The same rules are in src/rules/conditionClocks.ts, with unit tests.

alter table public.combatants
  add column condition_clocks jsonb not null default '[]'
    check (jsonb_typeof(condition_clocks) = 'array' and pg_column_size(condition_clocks) <= 8000);

-- Monster traits the server acts on: 'undead-fortitude'.
alter table public.combatant_secrets
  add column traits text[] not null default '{}' check (cardinality(traits) <= 10);

alter table public.combat_events drop constraint combat_events_kind_check;
alter table public.combat_events add constraint combat_events_kind_check
  check (kind in ('attack', 'action', 'death_save', 'spell', 'concentration', 'condition'));

-- A secret DC for a condition's save each turn: the DM's alone.
create table public.clock_secrets (
  combatant_id uuid not null references public.combatants (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  condition text not null,
  dc smallint not null check (dc between 1 and 40),
  primary key (combatant_id, condition)
);
create index clock_secrets_campaign_idx on public.clock_secrets (campaign_id);
alter table public.clock_secrets enable row level security;
grant select on public.clock_secrets to authenticated;
create policy "Only the DM sees a secret DC"
  on public.clock_secrets for select to authenticated
  using (private.is_campaign_dm(campaign_id));

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create function private.valid_condition(p_condition text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_condition = any (array[
    'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed',
    'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'
  ])
$$;

-- The condition's name in British English, for roll labels ("Paralysed").
create function private.condition_word(p_condition text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_condition when 'paralyzed' then 'Paralysed' else initcap(p_condition) end
$$;

-- The conditions on a combatant: a character's live on the character.
create function private.conditions_of(p_combatant public.combatants)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select ch.conditions from public.characters ch where ch.id = p_combatant.character_id),
    p_combatant.conditions
  )
$$;

-- Conditions and clocks as they stand, with what Undo also needs (a character's hit points, a
-- monster's hit points and health word).
create function private.condition_snapshot(p_combatant_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when c.kind = 'character' then (
      select jsonb_build_object(
        'current_hp', ch.current_hp, 'temp_hp', ch.temp_hp, 'conditions', to_jsonb(ch.conditions),
        'clocks', c.condition_clocks
      )
      from public.characters ch where ch.id = c.character_id
    ) else (
      select jsonb_build_object(
        'hp', s.hp, 'health', c.health, 'conditions', to_jsonb(c.conditions), 'clocks', c.condition_clocks
      )
      from public.combatant_secrets s where s.combatant_id = c.id
    ) end
  from public.combatants c where c.id = p_combatant_id
$$;

-- A save the server makes for a monster: in the DM's roll log only.
create function private.dm_secret_roll(
  p_campaign_id uuid, p_label text, p_d20 integer, p_modifier integer, p_dc integer
)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.rolls (
    campaign_id, roller_id, label, kind, dice, modifier, total, natural_d20, secret, passed, passed_by_dice
  )
  select p_campaign_id, c.dm_id, left(p_label, 80), 'save',
         jsonb_build_array(jsonb_build_object('sides', 20, 'value', p_d20, 'dropped', false)),
         p_modifier, p_d20 + p_modifier, p_d20, true, p_d20 + p_modifier >= p_dc, p_d20 + p_modifier >= p_dc
  from public.campaigns c where c.id = p_campaign_id
$$;

-- A clock as the server keeps it, from what the DM sent (anything odd is dropped). A secret DC is
-- kept in clock_secrets and left off the clock.
create function private.clean_clock(p_combatant public.combatants, p_condition text, p_clock jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_save jsonb := null;
  v_caster jsonb := null;
  v_clock jsonb;
  v_dc integer;
  v_secret boolean;
begin
  if p_clock is null or jsonb_typeof(p_clock) <> 'object' then
    return null;
  end if;
  if jsonb_typeof(p_clock -> 'save') = 'object'
     and p_clock -> 'save' ->> 'ability' = any (array['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']) then
    v_dc := least(40, greatest(1, (p_clock -> 'save' ->> 'dc')::integer));
    v_secret := coalesce((p_clock -> 'save' ->> 'secret')::boolean, false);
    v_save := jsonb_build_object(
      'ability', p_clock -> 'save' ->> 'ability',
      'dc', case when v_secret then null else v_dc end,
      'secret', v_secret
    );
    if v_secret then
      insert into public.clock_secrets (combatant_id, campaign_id, condition, dc)
      values (p_combatant.id, p_combatant.campaign_id, p_condition, v_dc)
      on conflict (combatant_id, condition) do update set dc = excluded.dc;
    end if;
  end if;
  if jsonb_typeof(p_clock -> 'caster') = 'object' and exists (
    select 1 from public.characters ch
    where ch.id::text = p_clock -> 'caster' ->> 'characterId' and ch.campaign_id = p_combatant.campaign_id
  ) then
    v_caster := jsonb_build_object(
      'characterId', p_clock -> 'caster' ->> 'characterId',
      'spell', left(coalesce(p_clock -> 'caster' ->> 'spell', ''), 60)
    );
  end if;
  v_clock := jsonb_build_object(
    'condition', p_condition,
    'rounds', case when jsonb_typeof(p_clock -> 'rounds') = 'number'
                   then to_jsonb(least(1000, greatest(1, (p_clock ->> 'rounds')::integer))) else 'null'::jsonb end,
    'endOfNextTurn', coalesce((p_clock ->> 'endOfNextTurn')::boolean, false),
    'save', coalesce(v_save, 'null'::jsonb),
    'caster', coalesce(v_caster, 'null'::jsonb),
    'escapeDc', case when jsonb_typeof(p_clock -> 'escapeDc') = 'number'
                     then to_jsonb(least(40, greatest(1, (p_clock ->> 'escapeDc')::integer))) else 'null'::jsonb end,
    'started', false,
    'owed', false
  );
  -- A clock that changes nothing isn't kept.
  if v_clock -> 'rounds' = 'null'::jsonb and not (v_clock ->> 'endOfNextTurn')::boolean and v_save is null
     and v_caster is null and v_clock -> 'escapeDc' = 'null'::jsonb then
    return null;
  end if;
  return v_clock;
end
$$;

-- Puts a condition on, or takes it off, with its clock (null for none).
create function private.put_condition(p_combatant_id uuid, p_condition text, p_on boolean, p_clock jsonb)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_combatant public.combatants;
begin
  select * into v_combatant from public.combatants c where c.id = p_combatant_id;
  update public.combatants c
  set condition_clocks = coalesce((
        select jsonb_agg(x) from jsonb_array_elements(c.condition_clocks) x where x ->> 'condition' <> p_condition
      ), '[]'::jsonb)
      || case when p_on and p_clock is not null then jsonb_build_array(p_clock) else '[]'::jsonb end
  where c.id = p_combatant_id;
  if v_combatant.kind = 'character' then
    update public.characters ch
    set conditions = case
      when not p_on then array_remove(ch.conditions, p_condition)
      when p_condition = any (ch.conditions) then ch.conditions
      else array_append(ch.conditions, p_condition)
    end
    where ch.id = v_combatant.character_id;
  else
    update public.combatants c
    set conditions = case
      when not p_on then array_remove(c.conditions, p_condition)
      when p_condition = any (c.conditions) then c.conditions
      else array_append(c.conditions, p_condition)
    end
    where c.id = p_combatant_id;
  end if;
end
$$;

-- A line in the feed about a creature's condition, which Undo can put back.
create function private.condition_event(p_combatant_id uuid, p_shown jsonb, p_before jsonb)
returns public.combat_events
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_combatant public.combatants;
begin
  select * into v_combatant from public.combatants c where c.id = p_combatant_id;
  return private.add_event(v_combatant, v_combatant.id, 'condition', null, p_shown, p_before, null, null);
end
$$;

-- A clock's save DC, from the clock or, when secret, from clock_secrets.
create function private.clock_dc(p_combatant_id uuid, p_clock jsonb)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (p_clock -> 'save' ->> 'dc')::integer,
    (select s.dc from public.clock_secrets s where s.combatant_id = p_combatant_id and s.condition = p_clock ->> 'condition'),
    10
  )
$$;

revoke execute on function private.valid_condition(text) from public;
revoke execute on function private.condition_word(text) from public;
revoke execute on function private.conditions_of(public.combatants) from public;
revoke execute on function private.condition_snapshot(uuid) from public;
revoke execute on function private.dm_secret_roll(uuid, text, integer, integer, integer) from public;
revoke execute on function private.clean_clock(public.combatants, text, jsonb) from public;
revoke execute on function private.put_condition(uuid, text, boolean, jsonb) from public;
revoke execute on function private.condition_event(uuid, jsonb, jsonb) from public;
revoke execute on function private.clock_dc(uuid, jsonb) from public;

-- ---------------------------------------------------------------------------------------------
-- Counting down
-- ---------------------------------------------------------------------------------------------

-- As a creature's turn starts ('start') or ends ('end'): its clocks tick, conditions end, and saves
-- each turn are rolled (a monster's) or owed (a player's).
create function private.tick_conditions(p_combatant_id uuid, p_when text)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_clock jsonb;
  v_kept jsonb := '[]'::jsonb;
  v_timed text[] := '{}';
  v_saved text[] := '{}';
  v_still text[] := '{}';
  v_before jsonb;
  v_condition text;
  v_ability text;
  v_d20 integer;
  v_bonus integer;
  v_dc integer;
  v_name text;
begin
  select * into v_combatant from public.combatants c where c.id = p_combatant_id;
  if not found or v_combatant.condition_clocks = '[]'::jsonb then
    return;
  end if;
  v_before := private.condition_snapshot(p_combatant_id);
  select s.name into v_name from public.combatant_secrets s where s.combatant_id = p_combatant_id;

  for v_clock in select x from jsonb_array_elements(v_combatant.condition_clocks) x loop
    v_condition := v_clock ->> 'condition';
    if p_when = 'start' then
      v_clock := jsonb_set(v_clock, '{started}', 'true'::jsonb);
      if jsonb_typeof(v_clock -> 'rounds') = 'number' then
        v_clock := jsonb_set(v_clock, '{rounds}', to_jsonb((v_clock ->> 'rounds')::integer - 1));
        if (v_clock ->> 'rounds')::integer <= 0 then
          v_timed := v_timed || v_condition;
          continue;
        end if;
      end if;
    elsif coalesce((v_clock ->> 'started')::boolean, false) then
      if coalesce((v_clock ->> 'endOfNextTurn')::boolean, false) then
        v_timed := v_timed || v_condition;
        continue;
      end if;
      if jsonb_typeof(v_clock -> 'save') = 'object' then
        if v_combatant.kind = 'monster' then
          v_ability := v_clock -> 'save' ->> 'ability';
          v_dc := private.clock_dc(p_combatant_id, v_clock);
          v_d20 := private.random_die(20);
          v_bonus := private.save_bonus(v_combatant, v_ability);
          perform private.dm_secret_roll(
            v_combatant.campaign_id,
            coalesce(v_name, v_combatant.shown_name) || ': ' || initcap(v_ability) || ' save against '
              || private.condition_word(v_condition),
            v_d20, v_bonus, v_dc
          );
          if v_d20 + v_bonus >= v_dc then
            v_saved := v_saved || v_condition;
            continue;
          end if;
          v_still := v_still || v_condition;
        else
          v_clock := jsonb_set(v_clock, '{owed}', 'true'::jsonb);
        end if;
      end if;
    end if;
    v_kept := v_kept || jsonb_build_array(v_clock);
  end loop;

  update public.combatants set condition_clocks = v_kept where id = p_combatant_id;
  foreach v_condition in array v_timed || v_saved loop
    perform private.put_condition(p_combatant_id, v_condition, false, null);
  end loop;
  foreach v_condition in array v_timed loop
    perform private.condition_event(p_combatant_id, jsonb_build_object('condition', v_condition, 'ended', 'time'), v_before);
  end loop;
  foreach v_condition in array v_saved loop
    perform private.condition_event(p_combatant_id, jsonb_build_object('condition', v_condition, 'ended', 'saved'), v_before);
  end loop;
  foreach v_condition in array v_still loop
    perform private.condition_event(p_combatant_id, jsonb_build_object('condition', v_condition, 'still', true), v_before);
  end loop;
end
$$;

revoke execute on function private.tick_conditions(uuid, text) from public;

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
  -- Conditions count down as the turn starts (C3a).
  perform private.tick_conditions(p_combatant_id, 'start');
end
$$;

create or replace function public.end_turn(p_encounter_id uuid)
returns public.encounters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
  v_at bigint;
  v_next uuid;
  v_round integer;
begin
  select * into v_encounter from public.encounters e where e.id = p_encounter_id and e.status = 'active';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not (
    private.is_campaign_dm(v_encounter.campaign_id)
    or exists (
      select 1 from public.combatants c join public.characters ch on ch.id = c.character_id
      where c.id = v_encounter.current_id and ch.owner_id = auth.uid()
    )
  ) then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;

  update public.reaction_prompts set status = 'passed'
  where encounter_id = p_encounter_id and status = 'open';

  -- Conditions that end with this turn, and saves at the end of it (C3a).
  if v_encounter.current_id is not null then
    perform private.tick_conditions(v_encounter.current_id, 'end');
  end if;

  v_at := (select t.n from private.turn_order(p_encounter_id) t where t.id = v_encounter.current_id);
  v_next := (
    select t.id from private.turn_order(p_encounter_id) t
    where not t.is_out and t.n > coalesce(v_at, 0)
    order by t.n limit 1
  );
  v_round := v_encounter.round;
  if v_next is null then
    v_next := (select t.id from private.turn_order(p_encounter_id) t where not t.is_out order by t.n limit 1);
    if v_at is not null and v_next is not null then
      v_round := v_round + 1;
    end if;
  end if;

  if v_next is not null then
    perform private.fresh_turn(v_next);
  end if;
  update public.encounters set current_id = v_next, round = v_round
  where id = p_encounter_id
  returning * into v_encounter;
  return v_encounter;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Keeping clocks and conditions together
-- ---------------------------------------------------------------------------------------------

-- A monster's condition taken off by hand takes its clock with it.
create function private.prune_clocks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'monster' and new.conditions is distinct from old.conditions then
    new.condition_clocks := coalesce((
      select jsonb_agg(x) from jsonb_array_elements(new.condition_clocks) x where x ->> 'condition' = any (new.conditions)
    ), '[]'::jsonb);
  end if;
  return new;
end
$$;

create trigger combatants_prune_clocks
  before update on public.combatants
  for each row execute function private.prune_clocks();

-- A character's condition taken off (by hand, by healing, by a rest) takes its clock with it; and
-- when a caster stops concentrating, the conditions tied to that spell end (decision 75).
create function private.on_character_conditions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_condition text;
  v_before jsonb;
begin
  if new.conditions is distinct from old.conditions then
    update public.combatants c
    set condition_clocks = coalesce((
          select jsonb_agg(x) from jsonb_array_elements(c.condition_clocks) x where x ->> 'condition' = any (new.conditions)
        ), '[]'::jsonb)
    where c.character_id = new.id and c.condition_clocks <> '[]'::jsonb
      and exists (select 1 from public.encounters en where en.id = c.encounter_id and en.status = 'active');
  end if;

  if old.concentration is not null and new.concentration is distinct from old.concentration then
    for v_combatant in
      select c.* from public.combatants c
      join public.encounters en on en.id = c.encounter_id and en.status = 'active'
      where c.campaign_id = new.campaign_id
        and exists (
          select 1 from jsonb_array_elements(c.condition_clocks) x
          where x -> 'caster' ->> 'characterId' = old.id::text and x -> 'caster' ->> 'spell' = old.concentration
        )
    loop
      v_before := private.condition_snapshot(v_combatant.id);
      for v_condition in
        select x ->> 'condition' from jsonb_array_elements(v_combatant.condition_clocks) x
        where x -> 'caster' ->> 'characterId' = old.id::text and x -> 'caster' ->> 'spell' = old.concentration
      loop
        perform private.put_condition(v_combatant.id, v_condition, false, null);
        perform private.condition_event(
          v_combatant.id,
          jsonb_build_object('condition', v_condition, 'ended', 'concentration', 'spell', old.concentration),
          v_before
        );
      end loop;
    end loop;
  end if;
  return null;
end
$$;

create trigger characters_condition_clocks
  after update on public.characters
  for each row
  when (old.conditions is distinct from new.conditions or old.concentration is distinct from new.concentration)
  execute function private.on_character_conditions();

-- When a fight ends a minute passes (decision 77's "in a fight" half): a character's conditions timed
-- to a minute or less, or saved off each turn, end.
create function private.on_fight_end_conditions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_clock jsonb;
begin
  for v_combatant in
    select c.* from public.combatants c
    where c.encounter_id = new.id and c.kind = 'character' and c.condition_clocks <> '[]'::jsonb
  loop
    for v_clock in select x from jsonb_array_elements(v_combatant.condition_clocks) x loop
      if coalesce((v_clock ->> 'endOfNextTurn')::boolean, false)
         or jsonb_typeof(v_clock -> 'save') = 'object'
         or (jsonb_typeof(v_clock -> 'rounds') = 'number' and (v_clock ->> 'rounds')::integer <= 10) then
        perform private.put_condition(v_combatant.id, v_clock ->> 'condition', false, null);
      end if;
    end loop;
  end loop;
  return null;
end
$$;

create trigger encounters_end_conditions
  after update on public.encounters
  for each row
  when (old.status = 'active' and new.status = 'ended')
  execute function private.on_fight_end_conditions();

-- ---------------------------------------------------------------------------------------------
-- The DM puts a condition on (or takes it off), with how long it lasts
-- ---------------------------------------------------------------------------------------------

-- p_clock: { rounds, endOfNextTurn, save: { ability, dc, secret }, caster: { characterId, spell },
--   escapeDc }, or null for "until I take it off".
-- p_resist: { ability, dc } for a save the creature makes first to avoid it (a wolf's bite), rolled
--   here: a character's in the open, a monster's behind the screen.
create function public.set_condition(
  p_combatant_id uuid, p_condition text, p_on boolean, p_clock jsonb, p_resist jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_before jsonb;
  v_clock jsonb := null;
  v_ability text;
  v_dc integer;
  v_roll public.rolls;
  v_resisted boolean := false;
  v_who text;
  v_event public.combat_events;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters en on en.id = c.encounter_id and en.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not (private.is_real_user() and private.is_campaign_dm(v_combatant.campaign_id)) then
    raise exception 'Only the DM puts conditions on' using errcode = '42501';
  end if;
  if not private.valid_condition(p_condition) then
    raise exception 'Unknown condition' using errcode = '22023';
  end if;
  v_before := private.condition_snapshot(p_combatant_id);

  if p_on and jsonb_typeof(p_resist) = 'object' then
    v_ability := p_resist ->> 'ability';
    v_dc := least(40, greatest(1, coalesce((p_resist ->> 'dc')::integer, 10)));
    if v_ability is null or v_ability <> all (array['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']) then
      raise exception 'Unknown saving throw' using errcode = '22023';
    end if;
    v_who := coalesce(
      (select ch.name from public.characters ch where ch.id = v_combatant.character_id),
      (select s.name from public.combatant_secrets s where s.combatant_id = v_combatant.id),
      v_combatant.shown_name
    );
    v_roll := public.throw_dice(
      v_combatant.campaign_id,
      jsonb_build_object(
        'label', left(v_who || ': ' || initcap(v_ability) || ' save against ' || private.condition_word(p_condition), 80),
        'kind', 'save', 'character_id', v_combatant.character_id,
        'dice', '[{"sides": 20, "count": 1}]'::jsonb,
        'modifier', private.save_bonus(v_combatant, v_ability),
        'parts', '[]'::jsonb, 'mode', 'normal', 'secret', v_combatant.kind = 'monster'
      )
    );
    v_resisted := v_roll.total >= v_dc;
    update public.rolls set passed = v_resisted, passed_by_dice = v_resisted where id = v_roll.id returning * into v_roll;
  end if;

  if not v_resisted then
    if p_on then
      v_clock := private.clean_clock(v_combatant, p_condition, p_clock);
    end if;
    perform private.put_condition(p_combatant_id, p_condition, p_on, v_clock);
  end if;

  v_event := private.condition_event(
    p_combatant_id,
    jsonb_strip_nulls(jsonb_build_object(
      'condition', p_condition,
      'on', p_on,
      'resisted', case when v_roll.id is not null then v_resisted end,
      'saveAbility', v_ability,
      -- A character's own total is theirs to see; a monster's stays behind the screen.
      'total', case when v_roll.id is not null and v_combatant.kind = 'character' then v_roll.total end,
      'rounds', v_clock -> 'rounds',
      'endOfNextTurn', case when (v_clock ->> 'endOfNextTurn')::boolean then true end,
      'saveEachTurn', v_clock -> 'save' ->> 'ability',
      'spell', v_clock -> 'caster' ->> 'spell'
    )),
    v_before
  );
  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'resisted', v_resisted,
    'roll', case when v_roll.id is not null then to_jsonb(v_roll) end
  );
end
$$;

revoke execute on function public.set_condition(uuid, text, boolean, jsonb, jsonb) from public, anon;
grant execute on function public.set_condition(uuid, text, boolean, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- What players do about their conditions
-- ---------------------------------------------------------------------------------------------

-- A player's save each turn, owed at the end of their turn: rolled here against the DC (which may
-- be secret). Passing ends the condition.
create function public.condition_save(p_combatant_id uuid, p_condition text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_clock jsonb;
  v_ability text;
  v_dc integer;
  v_roll public.rolls;
  v_saved boolean;
  v_before jsonb;
  v_event public.combat_events;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters en on en.id = c.encounter_id and en.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if v_combatant.kind <> 'character' or not private.acts_for(v_combatant, true) then
    raise exception 'That isn''t your character' using errcode = '42501';
  end if;
  select x into v_clock from jsonb_array_elements(v_combatant.condition_clocks) x
  where x ->> 'condition' = p_condition and coalesce((x ->> 'owed')::boolean, false)
    and jsonb_typeof(x -> 'save') = 'object'
  limit 1;
  if v_clock is null then
    raise exception 'There''s no save to make' using errcode = '22023';
  end if;
  v_ability := v_clock -> 'save' ->> 'ability';
  v_dc := private.clock_dc(p_combatant_id, v_clock);
  v_before := private.condition_snapshot(p_combatant_id);

  v_roll := public.throw_dice(
    v_combatant.campaign_id,
    jsonb_build_object(
      'label', left(initcap(v_ability) || ' save to shake off ' || private.condition_word(p_condition), 80),
      'kind', 'save', 'character_id', v_combatant.character_id,
      'dice', '[{"sides": 20, "count": 1}]'::jsonb,
      'modifier', private.save_bonus(v_combatant, v_ability),
      'parts', '[]'::jsonb, 'mode', 'normal', 'secret', false
    )
  );
  v_saved := v_roll.total >= v_dc;
  update public.rolls set passed = v_saved, passed_by_dice = v_saved where id = v_roll.id returning * into v_roll;

  if v_saved then
    perform private.put_condition(p_combatant_id, p_condition, false, null);
  else
    update public.combatants c
    set condition_clocks = (
      select jsonb_agg(case when x ->> 'condition' = p_condition then jsonb_set(x, '{owed}', 'false'::jsonb) else x end)
      from jsonb_array_elements(c.condition_clocks) x
    )
    where c.id = p_combatant_id;
  end if;
  v_event := private.condition_event(
    p_combatant_id,
    jsonb_build_object('condition', p_condition, 'saved', v_saved, 'saveAbility', v_ability, 'total', v_roll.total),
    v_before
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'saved', v_saved, 'event', to_jsonb(v_event));
end
$$;

revoke execute on function public.condition_save(uuid, text) from public, anon;
grant execute on function public.condition_save(uuid, text) to authenticated;

-- Standing up from prone costs half your speed (decision 76).
create function public.stand_up(p_combatant_id uuid)
returns public.combat_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_speed integer;
  v_half integer;
  v_before jsonb;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters en on en.id = c.encounter_id and en.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not private.acts_for(v_combatant, false) then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  if not ('prone' = any (private.conditions_of(v_combatant))) then
    raise exception 'You aren''t lying down' using errcode = '22023';
  end if;
  v_speed := private.speed_of(v_combatant);
  v_half := ceil(v_speed / 2.0);
  if not private.is_campaign_dm(v_combatant.campaign_id)
     and v_combatant.feet_moved + v_half > v_speed + v_combatant.extra_feet then
    raise exception 'Standing up takes half your speed, and you haven''t enough movement left' using errcode = '22023';
  end if;
  v_before := private.condition_snapshot(p_combatant_id);
  update public.combatants set feet_moved = least(2000, feet_moved + v_half) where id = p_combatant_id;
  perform private.put_condition(p_combatant_id, 'prone', false, null);
  return private.condition_event(
    p_combatant_id, jsonb_build_object('condition', 'prone', 'stood', true, 'feet', v_half), v_before
  );
end
$$;

revoke execute on function public.stand_up(uuid) from public, anon;
grant execute on function public.stand_up(uuid) to authenticated;

-- Breaking free of a grab or a web: the action, and the better of Athletics and Acrobatics against
-- the escape DC (decision 76). Breaking a grapple also ends being restrained by it.
create function public.break_free(p_combatant_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_character public.characters;
  v_dc integer;
  v_bonus integer;
  v_roll public.rolls;
  v_free boolean;
  v_before jsonb;
  v_record jsonb;
  v_condition text;
  v_event public.combat_events;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters en on en.id = c.encounter_id and en.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not private.acts_for(v_combatant, false) then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  if not private.is_campaign_dm(v_combatant.campaign_id) and (v_combatant.action_used or v_combatant.attacks_made > 0) then
    raise exception 'You have used your action this turn' using errcode = '22023';
  end if;
  select max((x ->> 'escapeDc')::integer) into v_dc
  from jsonb_array_elements(v_combatant.condition_clocks) x
  where x ->> 'condition' in ('grappled', 'restrained') and jsonb_typeof(x -> 'escapeDc') = 'number';
  if v_dc is null then
    raise exception 'There''s nothing to break free from' using errcode = '22023';
  end if;

  if v_combatant.kind = 'character' then
    select * into v_character from public.characters ch where ch.id = v_combatant.character_id;
    v_bonus := greatest(
      private.ability_mod(v_character.strength)
        + case when 'athletics' = any (v_character.skill_proficiencies)
               then private.proficiency(v_character.level) * case when 'athletics' = any (v_character.skill_expertise) then 2 else 1 end
               else 0 end,
      private.ability_mod(v_character.dexterity)
        + case when 'acrobatics' = any (v_character.skill_proficiencies)
               then private.proficiency(v_character.level) * case when 'acrobatics' = any (v_character.skill_expertise) then 2 else 1 end
               else 0 end
    );
  else
    v_bonus := greatest(private.save_bonus(v_combatant, 'strength'), private.save_bonus(v_combatant, 'dexterity'));
  end if;

  v_roll := public.throw_dice(
    v_combatant.campaign_id,
    jsonb_build_object(
      'label', 'Break free (Athletics or Acrobatics)',
      'kind', 'check', 'character_id', v_combatant.character_id,
      'dice', '[{"sides": 20, "count": 1}]'::jsonb,
      'modifier', v_bonus,
      'parts', '[]'::jsonb, 'mode', 'normal', 'secret', v_combatant.kind = 'monster'
    )
  );
  v_free := v_roll.total >= v_dc;
  update public.rolls set passed = v_free, passed_by_dice = v_free where id = v_roll.id returning * into v_roll;

  v_before := private.condition_snapshot(p_combatant_id);
  v_record := private.turn_record(v_combatant);
  update public.combatants set action_used = true where id = p_combatant_id;
  if v_free then
    for v_condition in
      select x ->> 'condition' from jsonb_array_elements(v_combatant.condition_clocks) x
      where x ->> 'condition' in ('grappled', 'restrained') and jsonb_typeof(x -> 'escapeDc') = 'number'
    loop
      perform private.put_condition(p_combatant_id, v_condition, false, null);
    end loop;
  end if;
  select * into v_combatant from public.combatants c where c.id = p_combatant_id;
  v_event := private.add_event(
    v_combatant, v_combatant.id, 'condition', v_roll.id,
    jsonb_build_object(
      'condition', 'grappled', 'brokeFree', v_free,
      'total', case when v_combatant.kind = 'character' then v_roll.total end
    ),
    v_before, v_record, null
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'free', v_free, 'event', to_jsonb(v_event));
end
$$;

revoke execute on function public.break_free(uuid) from public, anon;
grant execute on function public.break_free(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Undead Fortitude (decision 79), and Undo for conditions
-- ---------------------------------------------------------------------------------------------

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
  v_traits text[];
  v_name text;
  v_d20 integer;
  v_bonus integer;
  v_fortitude boolean := false;
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
    select jsonb_build_object('hp', s.hp, 'health', p_target.health), s.hp, s.max_hp, s.traits, s.name
      into v_before, v_hp, v_max, v_traits, v_name
    from public.combatant_secrets s where s.combatant_id = p_target.id;
    if v_hp is not null then
      v_hp := greatest(0, v_hp - v_damage);
      -- Undead Fortitude (C3a): dropped to 0 by damage that isn't radiant or a critical hit, it makes
      -- a Constitution save against 5 + the damage, and stays up with 1 hit point if it passes.
      if v_hp = 0 and v_damage > 0 and 'undead-fortitude' = any (v_traits) and v_type <> 'radiant' and not p_critical then
        v_d20 := private.random_die(20);
        v_bonus := private.save_bonus(p_target, 'constitution');
        v_fortitude := v_d20 + v_bonus >= 5 + v_damage;
        perform private.dm_secret_roll(
          p_target.campaign_id, coalesce(v_name, 'It') || ': Undead Fortitude', v_d20, v_bonus, 5 + v_damage
        );
        if v_fortitude then
          v_hp := 1;
        end if;
      end if;
      update public.combatant_secrets set hp = v_hp where combatant_id = p_target.id;
      update public.combatants set health = private.health_word(v_hp, v_max) where id = p_target.id;
    end if;
  end if;

  return jsonb_build_object(
    'damage', v_damage,
    'adjust', v_adjust,
    'down', v_damage > 0 and coalesce(v_hp, 1) = 0,
    'fortitude', v_fortitude,
    'before', v_before
  );
end
$$;

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
      -- A zombie that refused to fall (Undead Fortitude).
      'fortitude', v_hit and coalesce((v_result ->> 'fortitude')::boolean, false),
      'reaction', p_reaction
    ),
    v_result -> 'before',
    private.turn_record(p_attacker),
    v_ac
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event));
end
$$;

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
      if v_before ? 'hp' then
        update public.combatant_secrets set hp = (v_before ->> 'hp')::integer where combatant_id = v_target.id;
        update public.combatants set health = v_before ->> 'health' where id = v_target.id;
      end if;
      if v_before ? 'conditions' then
        update public.combatants
        set conditions = array(select jsonb_array_elements_text(v_before -> 'conditions'))
        where id = v_target.id;
      end if;
    end if;
    -- Condition clocks come back last, after the conditions they belong to (C3a).
    if v_before ? 'clocks' and v_target.id is not null then
      update public.combatants set condition_clocks = v_before -> 'clocks' where id = v_target.id;
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
