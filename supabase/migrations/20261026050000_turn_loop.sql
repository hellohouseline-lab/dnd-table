-- C1, the turn loop (docs/COMBAT_PLAN.md): a turn record for every fighter kept by the server, a
-- fight started in one go with its map, the first turn starting by itself once everyone has
-- initiative, movement limited on your turn, attacks settled on the server against armour class
-- with the damage taken off, and a feed of what happened that the DM can undo.
--
-- Rules enforced here, not just in the screens:
-- * The turn record (action, bonus action, reaction, movement) changes only through these functions.
-- * Players act only for their own character and only on its turn; the DM can act for anyone.
-- * A player moves their own miniature through move_token: in a fight, only on their turn and only
--   as far as their movement left. The table rule for direct moves is now the DM's alone.
-- * A monster's armour class and hit points never reach players. The feed says hit or miss and the
--   damage dealt; what Undo puts back lives in a table only the DM can read.

-- ---------------------------------------------------------------------------------------------
-- The turn record
-- ---------------------------------------------------------------------------------------------

alter table public.combatants
  -- Walking speed in feet: a monster's from the SRD. A character's comes from their sheet instead.
  add column speed smallint not null default 30 check (speed between 0 and 200),
  add column action_used boolean not null default false,
  -- Attacks made with this turn's Attack action (Extra Attack allows more than one).
  add column attacks_made smallint not null default 0 check (attacks_made between 0 and 10),
  add column bonus_used boolean not null default false,
  add column reaction_used boolean not null default false,
  add column feet_moved smallint not null default 0 check (feet_moved between 0 and 2000),
  -- Extra movement this turn, from Dash.
  add column extra_feet smallint not null default 0 check (extra_feet between 0 and 2000),
  add column disengaged boolean not null default false,
  add column dodging boolean not null default false;

-- How many attacks one Attack action gives: Extra Attack, by class and level (2014 rules).
create function private.attacks_per_action(p_class text, p_level integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(p_class) = 'fighter' then
      case when p_level >= 20 then 4 when p_level >= 11 then 3 when p_level >= 5 then 2 else 1 end
    when lower(p_class) in ('barbarian', 'monk', 'paladin', 'ranger') and p_level >= 5 then 2
    else 1
  end
$$;

-- A monster's health in words, as players see it: the same as healthState in src/rules/combat.ts.
create function private.health_word(p_hp integer, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_hp <= 0 then 'down'
    when p_hp * 4 <= p_max then 'near-death'
    when p_hp * 2 <= p_max then 'bloodied'
    else 'healthy'
  end
$$;

-- A creature starts its turn with everything back: action, bonus action, reaction (which returns at
-- the start of your own turn) and movement. Dodge lasts until then too.
create function private.fresh_turn(p_combatant_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.combatants
  set action_used = false, attacks_made = 0, bonus_used = false, reaction_used = false,
      feet_moved = 0, extra_feet = 0, disengaged = false, dodging = false
  where id = p_combatant_id
$$;

-- A combatant's speed: from the character's sheet, or the monster's own.
create function private.speed_of(p_combatant public.combatants)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce((select ch.speed from public.characters ch where ch.id = p_combatant.character_id), p_combatant.speed)
$$;

-- The turn record as it stands, for Undo.
create function private.turn_record(p_combatant public.combatants)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'action_used', p_combatant.action_used, 'attacks_made', p_combatant.attacks_made,
    'bonus_used', p_combatant.bonus_used, 'reaction_used', p_combatant.reaction_used,
    'feet_moved', p_combatant.feet_moved, 'extra_feet', p_combatant.extra_feet,
    'disengaged', p_combatant.disengaged, 'dodging', p_combatant.dodging
  )
$$;

-- Does the caller act for this combatant? The DM always; a player for their own character, on its
-- turn (or at any time, for a reaction).
create function private.acts_for(p_combatant public.combatants, p_any_time boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_campaign_dm(p_combatant.campaign_id) or (
    private.is_real_user()
    and exists (select 1 from public.characters ch where ch.id = p_combatant.character_id and ch.owner_id = auth.uid())
    and (p_any_time or exists (
      select 1 from public.encounters e
      where e.id = p_combatant.encounter_id and e.status = 'active' and e.current_id = p_combatant.id
    ))
  )
$$;

revoke execute on function private.attacks_per_action(text, integer) from public;
revoke execute on function private.health_word(integer, integer) from public;
revoke execute on function private.fresh_turn(uuid) from public;
revoke execute on function private.speed_of(public.combatants) from public;
revoke execute on function private.turn_record(public.combatants) from public;
revoke execute on function private.acts_for(public.combatants, boolean) from public;

-- ---------------------------------------------------------------------------------------------
-- Turns: the next creature starts fresh, and the first turn starts by itself
-- ---------------------------------------------------------------------------------------------

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

  create temporary table if not exists pg_temp.turn_order (id uuid, out boolean, n bigint) on commit drop;
  delete from pg_temp.turn_order;
  insert into pg_temp.turn_order
  select c.id, (c.kind = 'monster' and c.health = 'down'),
         row_number() over (order by c.initiative desc, c.tiebreak desc, c.created_at, c.id)
  from public.combatants c
  where c.encounter_id = p_encounter_id and c.initiative is not null;

  v_at := (select t.n from pg_temp.turn_order t where t.id = v_encounter.current_id);
  v_next := (select t.id from pg_temp.turn_order t where not t.out and t.n > coalesce(v_at, 0) order by t.n limit 1);
  v_round := v_encounter.round;
  if v_next is null then
    v_next := (select t.id from pg_temp.turn_order t where not t.out order by t.n limit 1);
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

-- As in milestone 6, plus: once everyone in the fight has initiative, the first turn starts.
create or replace function public.roll_initiative(p_combatant_id uuid, p_roll jsonb)
returns public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_dm boolean;
  v_roll public.rolls;
  v_dexterity integer;
  v_first uuid;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over, or it isn''t at this table' using errcode = '22023';
  end if;
  v_dm := private.is_campaign_dm(v_combatant.campaign_id);

  if v_combatant.kind = 'monster' and not v_dm then
    raise exception 'Only the DM rolls for monsters' using errcode = '42501';
  end if;
  if v_combatant.initiative is not null and not v_dm then
    raise exception 'You have already rolled initiative' using errcode = '23505';
  end if;
  if (p_roll -> 'dice') is distinct from '[{"sides": 20, "count": 1}]'::jsonb then
    raise exception 'Initiative is a single d20' using errcode = '22023';
  end if;

  -- throw_dice checks that the caller may roll for this character.
  v_roll := public.throw_dice(
    v_combatant.campaign_id,
    p_roll
      - 'damage' - 'request_id'
      || jsonb_build_object(
        'kind', 'initiative',
        'label', 'Initiative',
        'character_id', v_combatant.character_id,
        'secret', v_combatant.kind = 'monster'
      )
  );

  if v_combatant.kind = 'character' then
    select c.dexterity into v_dexterity from public.characters c where c.id = v_combatant.character_id;
  end if;

  update public.combatants
  set initiative = v_roll.total, tiebreak = coalesce(v_dexterity, tiebreak)
  where id = p_combatant_id;

  if not exists (
    select 1 from public.combatants c where c.encounter_id = v_combatant.encounter_id and c.initiative is null
  ) and (select e.current_id from public.encounters e where e.id = v_combatant.encounter_id) is null then
    v_first := (
      select c.id from public.combatants c
      where c.encounter_id = v_combatant.encounter_id and not (c.kind = 'monster' and c.health = 'down')
      order by c.initiative desc, c.tiebreak desc, c.created_at, c.id
      limit 1
    );
    perform private.fresh_turn(v_first);
    update public.encounters set current_id = v_first, round = 1 where id = v_combatant.encounter_id;
  end if;
  return v_roll;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Starting a fight in one go
-- ---------------------------------------------------------------------------------------------

-- The DM starts a fight with these characters, and puts this battle map on stage (or leaves the
-- stage as it is, with no map). One transaction, so every screen loads the whole thing at once.
-- Monsters are added after, as before, and miniatures are placed by the DM's screen.
create function public.start_fight(p_campaign_id uuid, p_character_ids uuid[], p_map_id uuid)
returns public.encounters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
begin
  if not (private.is_real_user() and private.is_campaign_dm(p_campaign_id)) then
    raise exception 'Only the DM starts a fight' using errcode = '42501';
  end if;
  if exists (select 1 from public.encounters e where e.campaign_id = p_campaign_id and e.status = 'active') then
    raise exception 'A fight is already going on' using errcode = '23505';
  end if;
  if p_map_id is not null and not exists (
    select 1 from public.assets a where a.id = p_map_id and a.campaign_id = p_campaign_id and a.kind = 'art'
  ) then
    raise exception 'That map isn''t in this table''s library' using errcode = '22023';
  end if;

  insert into public.encounters (campaign_id) values (p_campaign_id) returning * into v_encounter;

  insert into public.combatants (encounter_id, campaign_id, kind, character_id, shown_name, revealed, tiebreak, speed)
  select v_encounter.id, p_campaign_id, 'character', ch.id, left(ch.name, 60), true, ch.dexterity, ch.speed
  from public.characters ch
  where ch.campaign_id = p_campaign_id and ch.id = any (coalesce(p_character_ids, '{}'));

  if p_map_id is not null then
    insert into public.stage (campaign_id, map_id, mode) values (p_campaign_id, p_map_id, 'map')
    on conflict (campaign_id) do update set map_id = excluded.map_id, mode = 'map';
  end if;
  return v_encounter;
end
$$;

revoke execute on function public.start_fight(uuid, uuid[], uuid) from public, anon;
grant execute on function public.start_fight(uuid, uuid[], uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- What happened: the feed, and what Undo needs
-- ---------------------------------------------------------------------------------------------

create table public.combat_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  round smallint not null,
  actor_id uuid references public.combatants (id) on delete set null,
  target_id uuid references public.combatants (id) on delete set null,
  kind text not null check (kind in ('attack', 'action')),
  roll_id uuid references public.rolls (id) on delete set null,
  -- What everyone may see: the attack's name, hit or miss, the damage dealt, or the action taken.
  -- Names are looked up on each screen from the combatants, so a monster's real name never goes here.
  shown jsonb not null default '{}' check (jsonb_typeof(shown) = 'object' and pg_column_size(shown) <= 4000),
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

create index combat_events_encounter_idx on public.combat_events (encounter_id, created_at);
create index combat_events_campaign_idx on public.combat_events (campaign_id);

-- What Undo puts back: the target's hit points and conditions, and the actor's turn record. A
-- monster's hit points are secret, so this is the DM's alone.
create table public.combat_event_secrets (
  event_id uuid primary key references public.combat_events (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  target_before jsonb,
  actor_before jsonb,
  -- The armour class the attack was against.
  ac smallint
);

alter table public.combat_events enable row level security;
alter table public.combat_event_secrets enable row level security;
revoke all on public.combat_events, public.combat_event_secrets from anon, authenticated;
grant select on public.combat_events, public.combat_event_secrets to authenticated;

create policy "Everyone at the table sees what happened in the fight"
  on public.combat_events for select to authenticated
  using (private.is_campaign_member(campaign_id));

create policy "Only the DM sees what Undo would put back"
  on public.combat_event_secrets for select to authenticated
  using (private.is_campaign_dm(campaign_id));

alter publication supabase_realtime add table public.combat_events;

create function private.add_event(
  p_actor public.combatants,
  p_target_id uuid,
  p_kind text,
  p_roll_id uuid,
  p_shown jsonb,
  p_target_before jsonb,
  p_actor_before jsonb,
  p_ac integer
)
returns public.combat_events
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_event public.combat_events;
begin
  insert into public.combat_events (campaign_id, encounter_id, round, actor_id, target_id, kind, roll_id, shown)
  select p_actor.campaign_id, p_actor.encounter_id, e.round, p_actor.id, p_target_id, p_kind, p_roll_id, p_shown
  from public.encounters e where e.id = p_actor.encounter_id
  returning * into v_event;
  insert into public.combat_event_secrets (event_id, campaign_id, target_before, actor_before, ac)
  values (v_event.id, p_actor.campaign_id, p_target_before, p_actor_before, p_ac);
  return v_event;
end
$$;

revoke execute on function private.add_event(public.combatants, uuid, text, uuid, jsonb, jsonb, jsonb, integer) from public;

-- ---------------------------------------------------------------------------------------------
-- Actions that aren't attacks
-- ---------------------------------------------------------------------------------------------

-- Spends part of a turn: Dash (your speed again in movement), Disengage, Dodge, or the action,
-- bonus action or reaction for something the app doesn't know (a spell, a feature). Players on
-- their own turn (a reaction at any time); the DM for anyone, any time.
create function public.use_action(p_combatant_id uuid, p_what text)
returns public.combat_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_dm boolean;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if p_what not in ('action', 'dash', 'disengage', 'dodge', 'bonus', 'reaction') then
    raise exception 'Unknown action' using errcode = '22023';
  end if;
  if not private.acts_for(v_combatant, p_what = 'reaction') then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  v_dm := private.is_campaign_dm(v_combatant.campaign_id);

  if not v_dm then
    if p_what in ('action', 'dash', 'disengage', 'dodge') and (v_combatant.action_used or v_combatant.attacks_made > 0) then
      raise exception 'You have used your action this turn' using errcode = '22023';
    end if;
    if p_what = 'bonus' and v_combatant.bonus_used then
      raise exception 'You have used your bonus action this turn' using errcode = '22023';
    end if;
    if p_what = 'reaction' and v_combatant.reaction_used then
      raise exception 'You have used your reaction' using errcode = '22023';
    end if;
  end if;

  update public.combatants c
  set action_used = c.action_used or p_what in ('action', 'dash', 'disengage', 'dodge'),
      bonus_used = c.bonus_used or p_what = 'bonus',
      reaction_used = c.reaction_used or p_what = 'reaction',
      extra_feet = c.extra_feet + case when p_what = 'dash' then private.speed_of(c) else 0 end,
      disengaged = c.disengaged or p_what = 'disengage',
      dodging = c.dodging or p_what = 'dodge'
  where c.id = p_combatant_id;

  return private.add_event(
    v_combatant, null, 'action', null, jsonb_build_object('what', p_what), null, private.turn_record(v_combatant), null
  );
end
$$;

revoke execute on function public.use_action(uuid, text) from public, anon;
grant execute on function public.use_action(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Moving miniatures
-- ---------------------------------------------------------------------------------------------

-- Direct changes to a token's place are now the DM's alone; players move through move_token.
create or replace function private.can_move_token(p_campaign_id uuid, p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_campaign_dm(p_campaign_id)
$$;

-- Moves a miniature. The DM moves anything. A player moves their own while the DM allows it; in a
-- fight, only on their own turn and only as far as their movement left (squares, diagonals 5 ft).
-- Moving the creature whose turn it is counts against its movement, whoever drags it.
create function public.move_token(p_token_id uuid, p_x integer, p_y integer)
returns public.tokens
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token public.tokens;
  v_dm boolean;
  v_combatant public.combatants;
  v_current uuid;
  v_feet integer;
  v_left integer;
begin
  select * into v_token from public.tokens t where t.id = p_token_id;
  if not found or not private.is_campaign_member(v_token.campaign_id) then
    raise exception 'That miniature isn''t at this table' using errcode = '42501';
  end if;
  if p_x not between 0 and 500 or p_y not between 0 and 500 then
    raise exception 'That square is off the map' using errcode = '22023';
  end if;
  v_dm := private.is_campaign_dm(v_token.campaign_id);

  -- The fighter this miniature stands for, in the fight going on now, and whose turn it is.
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where (v_token.character_id is not null and c.character_id = v_token.character_id)
     or (v_token.combatant_id is not null and c.id = v_token.combatant_id)
  limit 1;
  if found then
    select e.current_id into v_current from public.encounters e where e.id = v_combatant.encounter_id;
  end if;
  v_feet := 5 * greatest(abs(p_x - v_token.x), abs(p_y - v_token.y));

  if not v_dm then
    if not private.is_real_user() or v_token.character_id is null or not exists (
      select 1 from public.characters ch where ch.id = v_token.character_id and ch.owner_id = auth.uid()
    ) then
      raise exception 'You can only move your own miniature' using errcode = '42501';
    end if;
    if v_token.hidden or v_token.map_id is distinct from private.on_stage_map(v_token.campaign_id) then
      raise exception 'That map isn''t on stage' using errcode = '42501';
    end if;
    if not coalesce((select s.players_move_tokens from public.stage s where s.campaign_id = v_token.campaign_id), true) then
      raise exception 'The DM is moving the miniatures for now' using errcode = '42501';
    end if;
    if v_combatant.id is not null then
      if v_current is distinct from v_combatant.id then
        raise exception 'Wait for your turn to move' using errcode = '42501';
      end if;
      v_left := private.speed_of(v_combatant) + v_combatant.extra_feet - v_combatant.feet_moved;
      if v_feet > v_left then
        raise exception 'You can move % more feet this turn', greatest(v_left, 0) using errcode = '22023';
      end if;
    end if;
  end if;

  if v_combatant.id is not null and v_current = v_combatant.id then
    update public.combatants set feet_moved = least(2000, feet_moved + v_feet) where id = v_combatant.id;
  end if;
  update public.tokens set x = p_x, y = p_y where id = p_token_id returning * into v_token;
  return v_token;
end
$$;

revoke execute on function public.move_token(uuid, integer, integer) from public, anon;
grant execute on function public.move_token(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Attacks
-- ---------------------------------------------------------------------------------------------

-- Settles one attack: throws it (to hit and damage together, through throw_dice, so nobody picks a
-- result), checks the total against the target's armour class (a natural 20 always hits, a natural
-- 1 always misses), takes the damage off (temporary hit points first; a character at 0 falls
-- unconscious; a monster's health word follows its secret hit points), spends the attack from the
-- Attack action, and posts it to the feed. p_roll is the attack roll the screens already build.
-- Players attack on their own turn while their Attack action has attacks left; the DM any time.
create function public.resolve_attack(p_attacker_id uuid, p_target_id uuid, p_roll jsonb)
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
      'label', v_roll.label,
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

revoke execute on function public.resolve_attack(uuid, uuid, jsonb) from public, anon;
grant execute on function public.resolve_attack(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Undo
-- ---------------------------------------------------------------------------------------------

-- The DM takes back the last thing that happened in the fight: the target's hit points and
-- conditions as they were, and the actor's turn record (but not the feet already walked, since
-- moves themselves aren't undone). One step at a time, newest first.
create function public.undo_event(p_event_id uuid)
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
  v_before jsonb;
  v_record jsonb;
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
    where ev.encounter_id = v_event.encounter_id and not ev.undone and ev.created_at > v_event.created_at
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
    elsif v_target.id is not null then
      update public.combatant_secrets set hp = (v_before ->> 'hp')::integer where combatant_id = v_target.id;
      update public.combatants set health = v_before ->> 'health' where id = v_target.id;
    end if;
  end if;

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
    where id = v_event.actor_id;
  end if;

  update public.combat_events set undone = true where id = p_event_id returning * into v_event;
  return v_event;
end
$$;

revoke execute on function public.undo_event(uuid) from public, anon;
grant execute on function public.undo_event(uuid) to authenticated;
