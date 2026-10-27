-- C3b: talk cards and parley (docs/C3_PLAN.md section 2, decisions 80 to 82).
--
-- * On their turn a player can spend their action to Persuade, Intimidate or Deceive one creature, or
--   everyone on the other side, with a line of what they say. The server throws the check (talk) and
--   posts it to the feed as a 'talk' event; the DM's card is that event until it's answered.
-- * The DM answers it (answer_talk): It works, Partly or It doesn't. It works can make the creatures
--   surrender (out of the turn order), run (they leave as their next turn comes round), or call a
--   parley; or it's just the words.
-- * The DM can also set a monster's stance by hand (set_stance) and call or end a parley (set_parley).
-- * A parley pauses the fight: Next turn waits until Back to the fight.
-- Undo puts stances and the parley back. The morale nudge is worked out on the DM's screen from the
-- monster's hit points, which only the DM can read.

alter table public.combatants
  add column stance text not null default 'fighting'
    check (stance in ('fighting', 'surrendered', 'running', 'fled'));

alter table public.encounters
  add column parley boolean not null default false;

alter table public.combat_events drop constraint combat_events_kind_check;
alter table public.combat_events add constraint combat_events_kind_check
  check (kind in ('attack', 'action', 'death_save', 'spell', 'concentration', 'condition', 'talk'));

-- ---------------------------------------------------------------------------------------------
-- Turns: surrendered and fled monsters are passed over, running ones leave, a parley pauses
-- ---------------------------------------------------------------------------------------------

create or replace function private.turn_order(p_encounter_id uuid)
returns table (id uuid, is_out boolean, n bigint)
language sql
stable
set search_path = ''
as $$
  select c.id, (c.kind = 'monster' and (c.health = 'down' or c.stance in ('surrendered', 'fled'))),
         row_number() over (order by c.initiative desc, c.tiebreak desc, c.created_at, c.id)
  from public.combatants c
  where c.encounter_id = p_encounter_id and c.initiative is not null
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
  v_fleer public.combatants;
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
  if v_encounter.parley then
    raise exception 'The fight is paused for a parley. Press Back to the fight first.' using errcode = '22023';
  end if;

  update public.reaction_prompts set status = 'passed'
  where encounter_id = p_encounter_id and status = 'open';

  -- Conditions that end with this turn, and saves at the end of it (C3a).
  if v_encounter.current_id is not null then
    perform private.tick_conditions(v_encounter.current_id, 'end');
  end if;

  v_at := (select t.n from private.turn_order(p_encounter_id) t where t.id = v_encounter.current_id);
  v_round := v_encounter.round;
  -- A monster that's running leaves the fight as its turn comes round (C3b), and the turn passes on.
  for i in 1..100 loop
    v_next := (
      select t.id from private.turn_order(p_encounter_id) t
      where not t.is_out and t.n > coalesce(v_at, 0)
      order by t.n limit 1
    );
    if v_next is null then
      v_next := (select t.id from private.turn_order(p_encounter_id) t where not t.is_out order by t.n limit 1);
      if v_at is not null and v_next is not null then
        v_round := v_round + 1;
      end if;
    end if;
    exit when v_next is null;
    select * into v_fleer from public.combatants c where c.id = v_next;
    exit when v_fleer.stance <> 'running';
    update public.combatants set stance = 'fled' where id = v_next;
    perform private.add_event(
      v_fleer, v_fleer.id, 'talk', null, '{"stance": "fled"}'::jsonb,
      jsonb_build_object('stances', jsonb_build_object(v_next::text, 'running')), null, null
    );
    v_at := (select t.n from private.turn_order(p_encounter_id) t where t.id = v_next);
  end loop;

  if v_next is not null then
    perform private.fresh_turn(v_next);
  end if;
  update public.encounters set current_id = v_next, round = v_round
  where id = p_encounter_id
  returning * into v_encounter;
  return v_encounter;
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

  -- Talk (C3b): who had surrendered or was running, and whether there was a parley.
  if v_before ? 'stances' then
    update public.combatants c set stance = v_before -> 'stances' ->> c.id::text
    where c.encounter_id = v_event.encounter_id and v_before -> 'stances' ? c.id::text;
  end if;
  if v_before ? 'parley' then
    update public.encounters set parley = (v_before ->> 'parley')::boolean where id = v_event.encounter_id;
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

-- ---------------------------------------------------------------------------------------------
-- Talk
-- ---------------------------------------------------------------------------------------------

-- Who is still in the fight to be talked to: monsters that are up and haven't surrendered or fled.
create function private.can_hear(p_combatant public.combatants)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_combatant.kind = 'monster' and p_combatant.health <> 'down'
         and p_combatant.stance in ('fighting', 'running')
$$;

revoke execute on function private.can_hear(public.combatants) from public;

-- A player's action: Persuade, Intimidate or Deceive. `p_roll` is the skill check as built for the
-- sheet (one d20, with advantage or not); the server throws it.
create function public.talk(
  p_combatant_id uuid,
  p_skill text,
  p_target_ids uuid[],
  p_words text,
  p_roll jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_targets uuid[];
  v_words text := nullif(left(btrim(coalesce(p_words, '')), 200), '');
  v_roll public.rolls;
  v_record jsonb;
  v_event public.combat_events;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id and c.kind = 'character';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if p_skill is null or p_skill not in ('persuasion', 'intimidation', 'deception') then
    raise exception 'Pick Persuade, Intimidate or Deceive' using errcode = '22023';
  end if;
  if not private.acts_for(v_combatant, false) then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;
  if not private.is_campaign_dm(v_combatant.campaign_id) and (v_combatant.action_used or v_combatant.attacks_made > 0) then
    raise exception 'You have used your action this turn' using errcode = '22023';
  end if;
  if cardinality(p_target_ids) > 30 then
    raise exception 'Pick who you''re talking to' using errcode = '22023';
  end if;
  v_targets := array(
    select c.id from public.combatants c
    where c.id = any (p_target_ids) and c.encounter_id = v_combatant.encounter_id and private.can_hear(c)
    order by c.created_at, c.id
  );
  if cardinality(v_targets) = 0 then
    raise exception 'Pick who you''re talking to' using errcode = '22023';
  end if;
  if (p_roll -> 'dice') is distinct from '[{"sides": 20, "count": 1}]'::jsonb then
    raise exception 'A check is a single d20' using errcode = '22023';
  end if;

  -- throw_dice checks the caller may roll for this character.
  v_roll := public.throw_dice(
    v_combatant.campaign_id,
    p_roll - 'request_id'
      || jsonb_build_object('kind', 'check', 'character_id', v_combatant.character_id, 'secret', false)
  );
  v_record := private.turn_record(v_combatant);
  update public.combatants set action_used = true where id = p_combatant_id;
  v_event := private.add_event(
    v_combatant,
    case when cardinality(v_targets) = 1 then v_targets[1] end,
    'talk',
    v_roll.id,
    jsonb_build_object('talk', p_skill, 'targets', to_jsonb(v_targets), 'words', v_words, 'total', v_roll.total),
    null,
    v_record,
    null
  );
  return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event));
end
$$;

revoke execute on function public.talk(uuid, text, uuid[], text, jsonb) from public, anon;
grant execute on function public.talk(uuid, text, uuid[], text, jsonb) to authenticated;

-- The DM's answer to a talk card. It works: surrender, run, parley, or just the words.
create function public.answer_talk(p_event_id uuid, p_answer text, p_outcome text)
returns public.combat_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_talk public.combat_events;
  v_encounter public.encounters;
  v_actor public.combatants;
  v_outcome text;
  v_targets uuid[];
  v_stances jsonb;
begin
  select * into v_talk from public.combat_events ev where ev.id = p_event_id and ev.kind = 'talk' and ev.shown ? 'talk';
  if not found or not private.is_campaign_dm(v_talk.campaign_id) then
    raise exception 'Only the DM can answer that' using errcode = '42501';
  end if;
  select * into v_encounter from public.encounters e where e.id = v_talk.encounter_id and e.status = 'active';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if v_talk.undone then
    raise exception 'That has been undone' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.combat_events ev
    where ev.encounter_id = v_talk.encounter_id and not ev.undone and ev.shown ->> 'answerTo' = p_event_id::text
  ) then
    raise exception 'That has been answered' using errcode = '22023';
  end if;
  if p_answer is null or p_answer not in ('works', 'partly', 'fails') then
    raise exception 'Pick It works, Partly or It doesn''t' using errcode = '22023';
  end if;
  v_outcome := case when p_answer = 'works' then coalesce(p_outcome, 'words') end;
  if v_outcome is not null and v_outcome not in ('surrender', 'run', 'parley', 'words') then
    raise exception 'Pick surrender, run, parley or just the words' using errcode = '22023';
  end if;

  v_targets := array(
    select c.id from public.combatants c
    where c.encounter_id = v_talk.encounter_id
      and c.id in (select (jsonb_array_elements_text(v_talk.shown -> 'targets'))::uuid)
      and private.can_hear(c)
    order by c.created_at, c.id
  );
  select coalesce(jsonb_object_agg(c.id::text, c.stance), '{}'::jsonb) into v_stances
  from public.combatants c where c.id = any (v_targets);

  if v_outcome = 'surrender' then
    update public.combatants set stance = 'surrendered' where id = any (v_targets);
  elsif v_outcome = 'run' then
    update public.combatants set stance = 'running' where id = any (v_targets) and stance = 'fighting';
  elsif v_outcome = 'parley' then
    update public.encounters set parley = true where id = v_encounter.id;
  end if;

  select * into v_actor from public.combatants c where c.id = v_talk.actor_id;
  return private.add_event(
    v_actor, null, 'talk', null,
    jsonb_build_object('answerTo', p_event_id, 'answer', p_answer, 'outcome', v_outcome, 'targets', to_jsonb(v_targets)),
    jsonb_build_object('stances', v_stances, 'parley', v_encounter.parley),
    null, null
  );
end
$$;

revoke execute on function public.answer_talk(uuid, text, text) from public, anon;
grant execute on function public.answer_talk(uuid, text, text) to authenticated;

-- The DM sets a monster's stance by hand: it surrenders, runs, or fights on.
create function public.set_stance(p_combatant_id uuid, p_stance text)
returns public.combat_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not private.is_campaign_dm(v_combatant.campaign_id) then
    raise exception 'Only the DM can do that' using errcode = '42501';
  end if;
  if v_combatant.kind <> 'monster' then
    raise exception 'Only monsters surrender or run here' using errcode = '22023';
  end if;
  if p_stance is null or p_stance not in ('fighting', 'surrendered', 'running', 'fled') then
    raise exception 'Unknown stance' using errcode = '22023';
  end if;
  if p_stance = v_combatant.stance then
    raise exception 'It already is' using errcode = '22023';
  end if;
  update public.combatants set stance = p_stance where id = p_combatant_id;
  return private.add_event(
    v_combatant, v_combatant.id, 'talk', null, jsonb_build_object('stance', p_stance),
    jsonb_build_object('stances', jsonb_build_object(v_combatant.id::text, v_combatant.stance)), null, null
  );
end
$$;

revoke execute on function public.set_stance(uuid, text) from public, anon;
grant execute on function public.set_stance(uuid, text) to authenticated;

-- A parley: the fight pauses to talk (on), or carries on from the same turn (off).
create function public.set_parley(p_encounter_id uuid, p_on boolean)
returns public.combat_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
  v_event public.combat_events;
begin
  select * into v_encounter from public.encounters e where e.id = p_encounter_id and e.status = 'active';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not private.is_campaign_dm(v_encounter.campaign_id) then
    raise exception 'Only the DM can do that' using errcode = '42501';
  end if;
  if v_encounter.parley = coalesce(p_on, false) then
    raise exception 'It already is' using errcode = '22023';
  end if;
  update public.encounters set parley = coalesce(p_on, false) where id = p_encounter_id;
  -- No one acts in it, so it goes in directly.
  insert into public.combat_events (campaign_id, encounter_id, round, actor_id, target_id, kind, roll_id, shown)
  values (
    v_encounter.campaign_id, v_encounter.id, v_encounter.round, null, null, 'talk', null,
    jsonb_build_object('parley', coalesce(p_on, false))
  )
  returning * into v_event;
  insert into public.combat_event_secrets (event_id, campaign_id, target_before, actor_before, ac)
  values (v_event.id, v_encounter.campaign_id, jsonb_build_object('parley', v_encounter.parley), null, null);
  return v_event;
end
$$;

revoke execute on function public.set_parley(uuid, boolean) from public, anon;
grant execute on function public.set_parley(uuid, boolean) to authenticated;
