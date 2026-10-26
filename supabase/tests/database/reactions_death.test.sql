-- C1b, opportunity attacks and death saves: leaving a hostile creature's reach opens a chance to
-- strike, Disengage prevents it, the reaction is spent; at 0 hit points a character rolls death
-- saves, a hit counts as a failure, healing clears it, and Undo puts it all back.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('ffffffff-0000-4000-8000-000000000002', 'thorin@example.invalid'),
  ('ffffffff-0000-4000-8000-000000000003', 'mira@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Reaction test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
insert into public.assets (campaign_id, kind, category, name, path)
  values (current_setting('test.campaign')::uuid, 'art', 'maps', 'Bridge', current_setting('test.campaign') || '/bridge.webp');
select set_config('test.map', (select id::text from public.assets where name = 'Bridge'), true);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, dexterity, speed, armour_class, max_hp, current_hp, attacks)
  values (current_setting('test.campaign')::uuid, 'ffffffff-0000-4000-8000-000000000002', 'Thorin', 'Fighter', 5, 14, 30, 18, 40, 40,
    '[{"name": "Glaive", "ability": "strength", "proficient": true}]');
select set_config('test.thorin_char', (select id::text from public.characters where name = 'Thorin'), true);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name, class, level, dexterity, speed, armour_class, max_hp, current_hp)
  values (current_setting('test.campaign')::uuid, 'ffffffff-0000-4000-8000-000000000003', 'Mira', 'Wizard', 3, 12, 30, 12, 18, 18);
select set_config('test.mira_char', (select id::text from public.characters where name = 'Mira'), true);

-- The fight: Thorin (initiative 18), a goblin (10), Mira (5).
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid,
  array[current_setting('test.thorin_char')::uuid, current_setting('test.mira_char')::uuid],
  current_setting('test.map')::uuid)), true);
select set_config('test.thorin', (select id::text from public.combatants where character_id = current_setting('test.thorin_char')::uuid), true);
select set_config('test.mira', (select id::text from public.combatants where character_id = current_setting('test.mira_char')::uuid), true);
select is(
  (select reach_ft::int from public.combatants where id = current_setting('test.thorin')::uuid), 10,
  'A character with a glaive threatens 10 feet'
);
select is(
  (select reach_ft::int from public.combatants where id = current_setting('test.mira')::uuid), 5,
  '...and one without a reach weapon 5 feet'
);

insert into public.combatants (encounter_id, campaign_id, kind, shown_name, tiebreak, speed)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A', 14, 30);
select set_config('test.goblin', (select id::text from public.combatants where kind = 'monster'), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, monster, hp, max_hp, ac)
  values (current_setting('test.goblin')::uuid, current_setting('test.campaign')::uuid, 'Goblin A', 'goblin', 7, 7, 1);
insert into public.tokens (campaign_id, map_id, character_id, x, y) values
  (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.thorin_char')::uuid, 2, 2),
  (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.mira_char')::uuid, 9, 9);
insert into public.tokens (campaign_id, map_id, combatant_id, x, y)
  values (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.goblin')::uuid, 3, 2);
select set_config('test.thorin_token', (select id::text from public.tokens where character_id = current_setting('test.thorin_char')::uuid), true);
select set_config('test.goblin_token', (select id::text from public.tokens where combatant_id is not null), true);

update public.combatants set initiative = 18 where id = current_setting('test.thorin')::uuid;
update public.combatants set initiative = 10 where id = current_setting('test.goblin')::uuid;
update public.combatants set initiative = 5 where id = current_setting('test.mira')::uuid;
update public.encounters set current_id = current_setting('test.goblin')::uuid, round = 1;

-- ---------------------------------------------------------------------------------------------
-- Opportunity attacks
-- ---------------------------------------------------------------------------------------------
select public.move_token(current_setting('test.goblin_token')::uuid, 3, 3);
select is((select count(*)::int from public.reaction_prompts), 0, 'Moving about inside someone''s reach doesn''t provoke');

select public.move_token(current_setting('test.goblin_token')::uuid, 5, 3);
select is(
  (select count(*)::int from public.reaction_prompts
   where combatant_id = current_setting('test.thorin')::uuid and provoker_id = current_setting('test.goblin')::uuid and status = 'open'),
  1,
  'Leaving Thorin''s reach gives him the chance of an opportunity attack'
);
select is((select count(*)::int from public.reaction_prompts), 1, '...and nobody far away gets one');
select is(
  (select x::int from public.tokens where id = current_setting('test.goblin_token')::uuid), 5,
  'The move goes ahead without waiting'
);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000003", "role": "authenticated"}';
select set_config('test.prompt', (select id::text from public.reaction_prompts), true);
select is(current_setting('test.prompt') <> '', true, 'The other players see the chance too');
select throws_ok(
  $$ select public.pass_reaction(current_setting('test.prompt')::uuid) $$,
  '42501', null,
  '...but only Thorin''s player (or the DM) decides it'
);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.pass_reaction(current_setting('test.prompt')::uuid);
select is(
  (select status from public.reaction_prompts where id = current_setting('test.prompt')::uuid), 'passed',
  'Letting it go closes the chance'
);
select is(
  (select reaction_used from public.combatants where id = current_setting('test.thorin')::uuid), false,
  '...without spending the reaction'
);

-- The goblin comes back and leaves again: a new chance, and this time Thorin swings.
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.move_token(current_setting('test.goblin_token')::uuid, 3, 3);
select public.move_token(current_setting('test.goblin_token')::uuid, 6, 6);
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select set_config('test.prompt', (select id::text from public.reaction_prompts where status = 'open'), true);
select set_config('test.swing', public.opportunity_attack(current_setting('test.prompt')::uuid,
  '{"label": "Glaive", "dice": [{"sides": 20, "count": 1}], "modifier": 5, "damage": {"dice": [], "modifier": 3, "type": "slashing"}}'
)::text, true);
select is(
  (select status from public.reaction_prompts where id = current_setting('test.prompt')::uuid), 'taken',
  'A player takes the opportunity attack when it isn''t their turn'
);
select is(
  (select reaction_used::text || ' ' || action_used::text from public.combatants where id = current_setting('test.thorin')::uuid),
  'true false',
  '...which spends the reaction, not the action'
);
select is(
  (current_setting('test.swing')::jsonb -> 'event' -> 'shown' ->> 'reaction'), 'true',
  'The feed shows it was a reaction'
);
select throws_ok(
  $$ select public.opportunity_attack(current_setting('test.prompt')::uuid, '{"label": "Glaive", "dice": [{"sides": 20, "count": 1}], "modifier": 5}') $$,
  '22023', 'That chance has passed',
  'A chance is taken once'
);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.move_token(current_setting('test.goblin_token')::uuid, 3, 3);
select public.move_token(current_setting('test.goblin_token')::uuid, 6, 6);
select is(
  (select count(*)::int from public.reaction_prompts where status = 'open'), 0,
  'No second chance once the reaction is spent'
);

-- Leaving Mira's side, then ending the turn: the chance she didn't decide on closes.
select public.move_token(current_setting('test.goblin_token')::uuid, 8, 8);
select public.move_token(current_setting('test.goblin_token')::uuid, 6, 6);
select is(
  (select count(*)::int from public.reaction_prompts where combatant_id = current_setting('test.mira')::uuid and status = 'open'), 1,
  'Mira gets her chance when the goblin leaves her side'
);
select public.end_turn(current_setting('test.encounter')::uuid);
select is(
  (select count(*)::int from public.reaction_prompts where status = 'open'), 0,
  'Chances nobody took close at the end of the turn'
);

-- Disengage: round 2, back to the goblin's turn (reactions come back at the start of each turn).
select public.end_turn(current_setting('test.encounter')::uuid);
select public.end_turn(current_setting('test.encounter')::uuid);
select public.move_token(current_setting('test.goblin_token')::uuid, 3, 3);
select public.use_action(current_setting('test.goblin')::uuid, 'disengage');
select public.move_token(current_setting('test.goblin_token')::uuid, 6, 3);
select is(
  (select count(*)::int from public.reaction_prompts where status = 'open'), 0,
  'Disengaging means no opportunity attacks'
);

-- A monster's chance is the DM's alone.
select public.end_turn(current_setting('test.encounter')::uuid);
select public.end_turn(current_setting('test.encounter')::uuid);
select public.move_token(current_setting('test.goblin_token')::uuid, 3, 2);
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.move_token(current_setting('test.thorin_token')::uuid, 0, 0);
select is(
  (select count(*)::int from public.reaction_prompts where status = 'open'), 0,
  'Players don''t see a monster''s chance to strike'
);
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(
  (select count(*)::int from public.reaction_prompts where combatant_id = current_setting('test.goblin')::uuid and status = 'open'), 1,
  '...but the DM does'
);

-- ---------------------------------------------------------------------------------------------
-- Death saves
-- ---------------------------------------------------------------------------------------------
update public.characters set current_hp = 0 where id = current_setting('test.mira_char')::uuid;
select ok(
  (select 'unconscious' = any (conditions) from public.characters where id = current_setting('test.mira_char')::uuid),
  'Dropping to 0 hit points knocks a character unconscious'
);

select is(
  public.opportunity_attack(
    (select id from public.reaction_prompts where status = 'open'),
    '{"label": "Goblin A: Scimitar", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 5, "type": "slashing"}}'
  ) -> 'event' ->> 'kind',
  'attack',
  'The DM takes the goblin''s opportunity attack on Thorin'
);

update public.characters set death_save_failures = 2 where id = current_setting('test.mira_char')::uuid;
update public.encounters set current_id = current_setting('test.goblin')::uuid;
select set_config('test.hit', public.resolve_attack(current_setting('test.goblin')::uuid, current_setting('test.mira')::uuid,
  '{"label": "Goblin A: Scimitar", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 5, "type": "slashing"}}'
)::text, true);
select is(
  (select dead from public.characters where id = current_setting('test.mira_char')::uuid),
  (current_setting('test.hit')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean,
  'A hit on someone at 0 hit points is a death save failure (the third one here)'
);
select is(
  (select current_hp::int from public.characters where id = current_setting('test.mira_char')::uuid), 0,
  '...and hit points don''t go below 0'
);
select public.undo_event((current_setting('test.hit')::jsonb -> 'event' ->> 'id')::uuid);
select is(
  (select death_save_failures::text || ' ' || dead::text from public.characters where id = current_setting('test.mira_char')::uuid),
  '2 false',
  'Undo takes the failure back'
);

-- Mira's turn: she rolls.
update public.encounters set current_id = current_setting('test.mira')::uuid;
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.death_save(current_setting('test.mira')::uuid) $$,
  '42501', null,
  'Only Mira''s player (or the DM) rolls her death saves'
);
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set death_save_successes = 2, death_save_failures = 0 where id = current_setting('test.mira_char')::uuid;
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000003", "role": "authenticated"}';
select set_config('test.save', public.death_save(current_setting('test.mira')::uuid)::text, true);
select ok(
  (select case current_setting('test.save')::jsonb -> 'event' -> 'shown' ->> 'result'
     when 'stable' then ch.stable and ch.death_save_successes = 3
     when 'failure' then ch.death_save_failures between 1 and 2 and not ch.stable
     when 'awake' then ch.current_hp = 1 and not ('unconscious' = any (ch.conditions))
     else false end
   from public.characters ch where ch.id = current_setting('test.mira_char')::uuid),
  'A death save: the third success makes her stable, a failure counts, a natural 20 wakes her'
);
select is(
  (select kind from public.combat_events where id = (current_setting('test.save')::jsonb -> 'event' ->> 'id')::uuid), 'death_save',
  'Everyone sees the death save in the feed'
);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set current_hp = 0, stable = true where id = current_setting('test.mira_char')::uuid;
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$ select public.death_save(current_setting('test.mira')::uuid) $$,
  '22023', 'Only someone dying makes death saves',
  'Once stable, no more death saves'
);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set death_save_failures = 2, current_hp = 4 where id = current_setting('test.mira_char')::uuid;
select is(
  (select death_save_successes::text || ' ' || death_save_failures::text || ' ' || stable::text || ' '
     || ('unconscious' = any (conditions))::text
   from public.characters where id = current_setting('test.mira_char')::uuid),
  '0 0 false false',
  'Healing above 0 clears the death saves and wakes her'
);
select throws_ok(
  $$ select public.death_save(current_setting('test.mira')::uuid) $$,
  '22023', 'Only someone dying makes death saves',
  'Nobody on their feet rolls death saves'
);

reset role;
select * from finish();
rollback;
