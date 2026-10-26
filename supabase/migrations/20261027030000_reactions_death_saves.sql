-- C1b: opportunity attacks and death saves (docs/COMBAT_PLAN.md, and Fable's spec of 27 October).
--
-- Opportunity attacks. When the creature whose turn it is moves its miniature out of a hostile
-- creature's reach (5 feet, or 10 with a reach weapon) without having Disengaged, and that creature
-- can still react, the move goes ahead at once and a prompt opens for the creature that could swing:
-- its player (for a character) or the DM (for a monster). Attacking spends the reaction, not the
-- action; letting it go closes the prompt. Prompts still open at the end of the mover's turn close.
--
-- Death saves. A character at 0 hit points rolls a death save on their turn: 10 or more is a
-- success, a natural 20 brings them back with 1 hit point, a natural 1 counts as two failures; three
-- successes make them stable, three failures dead (the DM can undo). Being hit at 0 is a failure, or
-- two for a critical hit. Healing above 0 clears it all.

-- ---------------------------------------------------------------------------------------------
-- Reach, stable and dead
-- ---------------------------------------------------------------------------------------------

alter table public.combatants add column reach_ft smallint not null default 5 check (reach_ft between 5 and 30);
grant update (reach_ft) on public.combatants to authenticated;

alter table public.characters
  add column stable boolean not null default false,
  add column dead boolean not null default false;
grant update (stable, dead) on public.characters to authenticated;

alter table public.combat_events drop constraint combat_events_kind_check;
alter table public.combat_events add constraint combat_events_kind_check check (kind in ('attack', 'action', 'death_save'));

-- Dropping to 0 hit points knocks a character unconscious; coming back above 0 clears the death saves.
create function private.on_hit_points()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_hp = 0 and old.current_hp > 0 and not ('unconscious' = any (new.conditions)) then
    new.conditions := array_append(new.conditions, 'unconscious');
  elsif new.current_hp > 0 and old.current_hp = 0 then
    new.death_save_successes := 0;
    new.death_save_failures := 0;
    new.stable := false;
    new.dead := false;
    new.conditions := array_remove(new.conditions, 'unconscious');
  end if;
  return new;
end
$$;

create trigger characters_hit_points
  before update of current_hp on public.characters
  for each row execute function private.on_hit_points();

-- ---------------------------------------------------------------------------------------------
-- Reaction prompts
-- ---------------------------------------------------------------------------------------------

create table public.reaction_prompts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  -- Who may react, and who provoked it.
  combatant_id uuid not null references public.combatants (id) on delete cascade,
  provoker_id uuid not null references public.combatants (id) on delete cascade,
  kind text not null default 'opportunity' check (kind in ('opportunity')),
  status text not null default 'open' check (status in ('open', 'taken', 'passed')),
  created_at timestamptz not null default now()
);

create index reaction_prompts_encounter_idx on public.reaction_prompts (encounter_id, status);

alter table public.reaction_prompts enable row level security;
revoke all on public.reaction_prompts from anon, authenticated;
grant select on public.reaction_prompts to authenticated;

-- Players see the chances their side gets; a monster's chances are the DM's alone, so a hidden
-- creature doesn't give itself away.
create policy "Players see their side's chances; the DM sees all"
  on public.reaction_prompts for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or (
      private.is_campaign_member(campaign_id)
      and exists (select 1 from public.combatants c where c.id = combatant_id and c.kind = 'character')
    )
  );

alter publication supabase_realtime add table public.reaction_prompts;

-- ---------------------------------------------------------------------------------------------
-- Settling an attack: shared by attacks on your turn and opportunity attacks
-- ---------------------------------------------------------------------------------------------

-- Throws the attack, checks it against armour class, adjusts the damage for the target's defences,
-- takes it off (a character already at 0 gets a death save failure, two for a critical), spends
-- the attack (or, for a reaction, the reaction) and posts it to the feed.
create function private.settle_attack(
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
  v_damage integer := 0;
  v_temp integer;
  v_hp integer;
  v_max integer;
  v_target_before jsonb;
  v_event public.combat_events;
  v_type text;
  v_adjust text;
  v_magical boolean := coalesce((p_roll ->> 'magical')::boolean, false);
  v_was_down boolean := false;
  v_failures integer;
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
  if v_hit then
    v_damage := greatest(0, coalesce((v_roll.damage ->> 'total')::integer, 0));
  end if;

  -- Resistance halves the damage, vulnerability doubles it, immunity stops it.
  v_type := lower(coalesce(v_roll.damage ->> 'type', ''));
  if v_damage > 0 and v_type <> '' then
    if p_target.kind = 'character' then
      select private.damage_adjustment(v_type, v_magical, ch.resistances, ch.vulnerabilities, ch.immunities)
        into v_adjust
      from public.characters ch where ch.id = p_target.character_id;
    else
      select private.damage_adjustment(v_type, v_magical, s.resistances, s.vulnerabilities, s.immunities)
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
             'stable', ch.stable, 'dead', ch.dead
           ),
           least(ch.temp_hp, v_damage), ch.current_hp, ch.current_hp = 0, ch.death_save_failures
      into v_target_before, v_temp, v_hp, v_was_down, v_failures
    from public.characters ch where ch.id = p_target.character_id;
    v_hp := greatest(0, v_hp - (v_damage - v_temp));
    update public.characters ch
    set temp_hp = ch.temp_hp - v_temp,
        current_hp = v_hp,
        -- Hit while down: a death save failure, or two for a critical hit.
        death_save_failures = case
          when v_was_down and v_damage > 0 then least(3, v_failures + case when v_roll.natural_d20 = 20 then 2 else 1 end)
          else ch.death_save_failures
        end,
        stable = case when v_was_down and v_damage > 0 then false else ch.stable end,
        dead = ch.dead or (v_was_down and v_damage > 0
          and v_failures + case when v_roll.natural_d20 = 20 then 2 else 1 end >= 3)
    where ch.id = p_target.character_id;
  else
    select jsonb_build_object('hp', s.hp, 'health', p_target.health), s.hp, s.max_hp
      into v_target_before, v_hp, v_max
    from public.combatant_secrets s where s.combatant_id = p_target.id;
    if v_hp is not null then
      v_hp := greatest(0, v_hp - v_damage);
      update public.combatant_secrets set hp = v_hp where combatant_id = p_target.id;
      update public.combatants set health = private.health_word(v_hp, v_max) where id = p_target.id;
    end if;
  end if;

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
      'damage', v_damage,
      'damageType', coalesce(v_roll.damage ->> 'type', ''),
      -- 'resisted', 'vulnerable' or 'immune', once it has happened.
      'adjust', v_adjust,
      -- A player's own total is theirs to see; a monster's dice stay behind the screen.
      'total', case when p_attacker.kind = 'character' then v_roll.total end,
      'down', v_hit and coalesce(v_hp, 1) = 0,
      'reaction', p_reaction
    ),
    v_target_before,
    private.turn_record(p_attacker),
    v_ac
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event));
end
$$;

revoke execute on function private.settle_attack(public.combatants, public.combatants, jsonb, boolean) from public;

-- An attack on your turn, from your action (Extra Attack allowing). The DM can attack for anyone.
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
  v_allowed integer := 1;
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

  if v_attacker.kind = 'character' then
    select private.attacks_per_action(ch.class, ch.level) into v_allowed
    from public.characters ch where ch.id = v_attacker.character_id;
  end if;
  if not private.is_campaign_dm(v_attacker.campaign_id) then
    if v_attacker.attacks_made = 0 and v_attacker.action_used then
      raise exception 'You have used your action this turn' using errcode = '22023';
    end if;
    if v_attacker.attacks_made >= v_allowed then
      raise exception 'You have made all your attacks this turn' using errcode = '22023';
    end if;
  end if;
  return private.settle_attack(v_attacker, v_target, p_roll, false);
end
$$;

-- Takes an opportunity attack: the reaction, against the creature that moved away.
create function public.opportunity_attack(p_prompt_id uuid, p_roll jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_prompt public.reaction_prompts;
  v_reactor public.combatants;
  v_provoker public.combatants;
begin
  select * into v_prompt from public.reaction_prompts p where p.id = p_prompt_id;
  if not found or v_prompt.status <> 'open' then
    raise exception 'That chance has passed' using errcode = '22023';
  end if;
  select * into v_reactor from public.combatants c where c.id = v_prompt.combatant_id;
  select * into v_provoker from public.combatants c where c.id = v_prompt.provoker_id;
  if not private.acts_for(v_reactor, true) then
    raise exception 'That isn''t yours to take' using errcode = '42501';
  end if;
  if v_reactor.reaction_used and not private.is_campaign_dm(v_reactor.campaign_id) then
    raise exception 'You have used your reaction' using errcode = '22023';
  end if;
  if (p_roll -> 'dice') is distinct from '[{"sides": 20, "count": 1}]'::jsonb then
    raise exception 'An attack is a single d20' using errcode = '22023';
  end if;
  update public.reaction_prompts set status = 'taken' where id = p_prompt_id;
  return private.settle_attack(v_reactor, v_provoker, p_roll, true);
end
$$;

-- Lets the chance go.
create function public.pass_reaction(p_prompt_id uuid)
returns public.reaction_prompts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_prompt public.reaction_prompts;
  v_reactor public.combatants;
begin
  select * into v_prompt from public.reaction_prompts p where p.id = p_prompt_id;
  if not found then
    raise exception 'That chance has passed' using errcode = '22023';
  end if;
  select * into v_reactor from public.combatants c where c.id = v_prompt.combatant_id;
  if not private.acts_for(v_reactor, true) then
    raise exception 'That isn''t yours to decide' using errcode = '42501';
  end if;
  update public.reaction_prompts set status = 'passed' where id = p_prompt_id and status = 'open'
  returning * into v_prompt;
  return v_prompt;
end
$$;

revoke execute on function public.opportunity_attack(uuid, jsonb) from public, anon;
revoke execute on function public.pass_reaction(uuid) from public, anon;
grant execute on function public.opportunity_attack(uuid, jsonb) to authenticated;
grant execute on function public.pass_reaction(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Death saves
-- ---------------------------------------------------------------------------------------------

create function public.death_save(p_combatant_id uuid)
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

  v_event := private.add_event(
    v_combatant, v_combatant.id, 'death_save', v_roll.id,
    jsonb_build_object(
      'result', v_result, 'rolled', v_roll.natural_d20,
      'successes', v_character.death_save_successes, 'failures', v_character.death_save_failures
    ),
    v_before, null, null
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event));
end
$$;

revoke execute on function public.death_save(uuid) from public, anon;
grant execute on function public.death_save(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Starting a fight: a character with a reach weapon threatens 10 feet
-- ---------------------------------------------------------------------------------------------

create or replace function public.start_fight(p_campaign_id uuid, p_character_ids uuid[], p_map_id uuid)
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

  insert into public.combatants (
    encounter_id, campaign_id, kind, character_id, shown_name, revealed, tiebreak, speed, reach_ft
  )
  select v_encounter.id, p_campaign_id, 'character', ch.id, left(ch.name, 60), true, ch.dexterity, ch.speed,
         case when lower(ch.attacks::text) ~ '(glaive|halberd|lance|pike|whip)' then 10 else 5 end
  from public.characters ch
  where ch.campaign_id = p_campaign_id and ch.id = any (coalesce(p_character_ids, '{}'));

  if p_map_id is not null then
    insert into public.stage (campaign_id, map_id, mode) values (p_campaign_id, p_map_id, 'map')
    on conflict (campaign_id) do update set map_id = excluded.map_id, mode = 'map';
  end if;
  return v_encounter;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Moving: leaving a hostile creature's reach opens an opportunity attack prompt
-- ---------------------------------------------------------------------------------------------

-- Who could take an opportunity attack on this move: creatures of the other side on the same map,
-- awake and able to act, with their reaction unused, that had the mover within reach before the
-- move and don't after. Disengaging prevents it. Distances count squares, 5 feet each, diagonals too.
create function private.open_opportunities(
  p_mover public.combatants,
  p_token public.tokens,
  p_x integer,
  p_y integer
)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.reaction_prompts (campaign_id, encounter_id, combatant_id, provoker_id)
  select p_mover.campaign_id, p_mover.encounter_id, c.id, p_mover.id
  from public.combatants c
  join public.tokens t
    on t.map_id = p_token.map_id
   and ((c.character_id is not null and t.character_id = c.character_id) or t.combatant_id = c.id)
  left join public.characters ch on ch.id = c.character_id
  where c.encounter_id = p_mover.encounter_id
    and c.kind <> p_mover.kind
    and c.initiative is not null
    and not c.reaction_used
    and not (c.kind = 'monster' and c.health = 'down')
    and coalesce(ch.current_hp, 1) > 0
    and not (coalesce(ch.conditions, c.conditions)
             && array['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'])
    and 5 * greatest(abs(t.x - p_token.x), abs(t.y - p_token.y)) <= c.reach_ft
    and 5 * greatest(abs(t.x - p_x), abs(t.y - p_y)) > c.reach_ft
    and not exists (
      select 1 from public.reaction_prompts p
      where p.combatant_id = c.id and p.provoker_id = p_mover.id and p.status = 'open'
    )
$$;

revoke execute on function private.open_opportunities(public.combatants, public.tokens, integer, integer) from public;

create or replace function public.move_token(p_token_id uuid, p_x integer, p_y integer)
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

  -- The fighter this miniature stands for, in the fight going on now, and whose turn it is
  -- (none yet while everyone is still rolling initiative).
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
    -- In a fight that has begun: only on your turn, and only as far as your movement left.
    if v_combatant.id is not null and v_current is not null then
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
    -- Walking away from someone without Disengaging gives them a chance to strike.
    if not v_combatant.disengaged then
      perform private.open_opportunities(v_combatant, v_token, p_x, p_y);
    end if;
  end if;
  update public.tokens set x = p_x, y = p_y where id = p_token_id returning * into v_token;
  return v_token;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Ending a turn: chances nobody took are gone
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

  update public.reaction_prompts set status = 'passed'
  where encounter_id = p_encounter_id and status = 'open';

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
-- Undo: death saves, stable and dead come back too
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
      -- Separately, so the hit points rule (coming back above 0 clears the saves) doesn't undo it.
      if v_before ? 'death_save_failures' then
        update public.characters ch
        set death_save_successes = (v_before ->> 'death_save_successes')::integer,
            death_save_failures = (v_before ->> 'death_save_failures')::integer,
            stable = (v_before ->> 'stable')::boolean,
            dead = (v_before ->> 'dead')::boolean
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
    where id = v_event.actor_id;
  end if;

  update public.combat_events set undone = true where id = p_event_id returning * into v_event;
  return v_event;
end
$$;

-- The DM's quick fixes for someone dying: Stabilise (no more saves) and back up with 1 hit point
-- are ordinary sheet changes (stable, current_hp), allowed by the grants above.
