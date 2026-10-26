-- C1, the turn loop: starting a fight with its map, the first turn starting by itself, the turn
-- record, movement limits, attacks settled on the server, the feed and Undo, and who can do what.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

insert into auth.users (id, email) values
  ('dddddddd-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('dddddddd-0000-4000-8000-000000000002', 'player@example.invalid'),
  ('dddddddd-0000-4000-8000-000000000003', 'outsider@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Turn test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
insert into public.assets (campaign_id, kind, category, name, path)
  values (current_setting('test.campaign')::uuid, 'art', 'maps', 'Cave', current_setting('test.campaign') || '/cave.webp');
select set_config('test.map', (select id::text from public.assets where name = 'Cave'), true);

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, dexterity, speed, armour_class, max_hp, current_hp)
  values (current_setting('test.campaign')::uuid, 'dddddddd-0000-4000-8000-000000000002', 'Thorin', 'Fighter', 5, 14, 25, 18, 40, 40);
select set_config('test.fighter', (select id::text from public.characters), true);

-- ---------------------------------------------------------------------------------------------
-- Starting a fight
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.start_fight(current_setting('test.campaign')::uuid, array[current_setting('test.fighter')::uuid], null) $$,
  '42501', 'Only the DM starts a fight',
  'Players can''t start a fight'
);

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ select public.start_fight(current_setting('test.campaign')::uuid, array[current_setting('test.fighter')::uuid], gen_random_uuid()) $$,
  '22023', null,
  'Only a map from the table''s own library'
);
select set_config(
  'test.encounter',
  (select id::text from public.start_fight(
    current_setting('test.campaign')::uuid, array[current_setting('test.fighter')::uuid], current_setting('test.map')::uuid)),
  true
);
select set_config('test.thorin', (select id::text from public.combatants where kind = 'character'), true);
select is((select count(*)::int from public.combatants), 1, 'Starting a fight puts the party in the turn order');
select is((select speed from public.combatants), 25::smallint, '...with their speed from the sheet');
select is(
  (select mode || ' ' || (map_id = current_setting('test.map')::uuid)::text from public.stage),
  'map true',
  '...and puts the battle map on stage'
);
select throws_ok(
  $$ select public.start_fight(current_setting('test.campaign')::uuid, '{}', null) $$,
  '23505', null,
  'One fight at a time'
);

-- A goblin, as the DM's screen adds one, and everyone's miniature.
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, tiebreak, speed)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A', 14, 30);
select set_config('test.goblin', (select id::text from public.combatants where kind = 'monster'), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, monster, hp, max_hp, ac)
  values (current_setting('test.goblin')::uuid, current_setting('test.campaign')::uuid, 'Goblin A', 'goblin', 7, 7, 15);
insert into public.tokens (campaign_id, map_id, character_id, x, y)
  values (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.fighter')::uuid, 2, 2);
insert into public.tokens (campaign_id, map_id, combatant_id, x, y)
  values (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.goblin')::uuid, 3, 2);
select set_config('test.thorin_token', (select id::text from public.tokens where character_id is not null), true);
select set_config('test.goblin_token', (select id::text from public.tokens where combatant_id is not null), true);

-- ---------------------------------------------------------------------------------------------
-- Initiative: the first turn starts by itself once everyone has rolled
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.roll_initiative(current_setting('test.thorin')::uuid, '{"dice": [{"sides": 20, "count": 1}], "modifier": 2}');
select is(
  (select current_id from public.encounters), null::uuid,
  'The first turn waits until everyone has initiative'
);
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.roll_initiative(current_setting('test.goblin')::uuid, '{"dice": [{"sides": 20, "count": 1}], "modifier": 2}');
select ok(
  (select current_id is not null and round = 1 from public.encounters),
  'Once everyone has rolled, the first turn starts by itself'
);

-- From here the order is fixed: Thorin 18, the goblin 10, and it's Thorin's turn.
update public.combatants set initiative = 18 where kind = 'character';
update public.combatants set initiative = 10 where kind = 'monster';
update public.encounters set current_id = current_setting('test.thorin')::uuid;

-- ---------------------------------------------------------------------------------------------
-- The player's turn: actions
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$ select public.use_action(current_setting('test.thorin')::uuid, 'dash') $$,
  'A player dashes on their turn'
);
select is(
  (select extra_feet::int from public.combatants where id = current_setting('test.thorin')::uuid), 25,
  'Dash adds their speed to their movement'
);
select throws_ok(
  $$ select public.use_action(current_setting('test.thorin')::uuid, 'dodge') $$,
  '22023', 'You have used your action this turn',
  'One action a turn'
);
select lives_ok(
  $$ select public.use_action(current_setting('test.thorin')::uuid, 'bonus') $$,
  'A player uses their bonus action'
);
select throws_ok(
  $$ select public.use_action(current_setting('test.thorin')::uuid, 'bonus') $$,
  '22023', 'You have used your bonus action this turn',
  'One bonus action a turn'
);
select is(
  (select count(*)::int from public.combat_events where kind = 'action'), 2,
  'Both show in the feed'
);

-- ---------------------------------------------------------------------------------------------
-- Moving
-- ---------------------------------------------------------------------------------------------
update public.tokens set x = 0 where id = current_setting('test.thorin_token')::uuid;
select is(
  (select x from public.tokens where id = current_setting('test.thorin_token')::uuid), 2::smallint,
  'Players don''t change a token directly'
);
select lives_ok(
  $$ select public.move_token(current_setting('test.thorin_token')::uuid, 10, 2) $$,
  'A player moves their miniature within their movement'
);
select is(
  (select feet_moved::int from public.combatants where id = current_setting('test.thorin')::uuid), 40,
  'The feet walked are counted'
);
select throws_ok(
  $$ select public.move_token(current_setting('test.thorin_token')::uuid, 13, 2) $$,
  '22023', 'You can move 10 more feet this turn',
  'Nobody moves further than their movement left'
);
select lives_ok(
  $$ select public.move_token(current_setting('test.thorin_token')::uuid, 12, 4) $$,
  'A diagonal square costs 5 feet, as in the rules'
);
select throws_ok(
  $$ select public.move_token(current_setting('test.goblin_token')::uuid, 5, 5) $$,
  '42501', 'You can only move your own miniature',
  'A player cannot move a monster'
);

-- ---------------------------------------------------------------------------------------------
-- Undo
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.undo_event((select id from public.combat_events order by created_at desc limit 1)) $$,
  '42501', 'Only the DM can undo',
  'Players can''t undo'
);
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ select public.undo_event((select id from public.combat_events where shown ->> 'what' = 'dash')) $$,
  '22023', 'Undo the newer things first',
  'Undo goes newest first'
);
select lives_ok(
  $$ select public.undo_event((select id from public.combat_events where shown ->> 'what' = 'bonus')) $$,
  'The DM undoes the bonus action'
);
select lives_ok(
  $$ select public.undo_event((select id from public.combat_events where shown ->> 'what' = 'dash')) $$,
  '...and then the dash'
);
select is(
  (select (action_used or bonus_used)::text || ' ' || extra_feet || ' ' || feet_moved
   from public.combatants where id = current_setting('test.thorin')::uuid),
  'false 0 50',
  'Undo gives back the action and bonus action, but not the feet already walked'
);

-- ---------------------------------------------------------------------------------------------
-- The player attacks
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';
select set_config('test.attack', public.resolve_attack(
  current_setting('test.thorin')::uuid, current_setting('test.goblin')::uuid,
  '{"label": "Longsword", "dice": [{"sides": 20, "count": 1}], "modifier": 7, "parts": [], "mode": "normal",
    "damage": {"dice": [{"sides": 8, "count": 1}], "modifier": 4, "type": "slashing"}}')::text, true);
select ok(
  (current_setting('test.attack')::jsonb -> 'event' -> 'shown') ? 'hit',
  'The feed says hit or miss'
);
select ok(
  not ((current_setting('test.attack')::jsonb -> 'event' -> 'shown') ? 'ac'),
  '...but never the armour class'
);
select ok(
  (current_setting('test.attack')::jsonb -> 'event' -> 'shown' ->> 'total') is not null,
  'A player sees their own attack total'
);
select is((select count(*)::int from public.combat_event_secrets), 0, 'Players can''t see what Undo would put back');
select lives_ok(
  $$ select public.resolve_attack(
       current_setting('test.thorin')::uuid, current_setting('test.goblin')::uuid,
       '{"label": "Longsword", "dice": [{"sides": 20, "count": 1}], "modifier": 7,
         "damage": {"dice": [{"sides": 8, "count": 1}], "modifier": 4, "type": "slashing"}}') $$,
  'Extra Attack: a level 5 fighter attacks twice'
);
select throws_ok(
  $$ select public.resolve_attack(
       current_setting('test.thorin')::uuid, current_setting('test.goblin')::uuid,
       '{"label": "Longsword", "dice": [{"sides": 20, "count": 1}], "modifier": 7}') $$,
  '22023', 'You have made all your attacks this turn',
  '...but not three times'
);
select throws_ok(
  $$ select public.use_action(current_setting('test.thorin')::uuid, 'dash') $$,
  '22023', 'You have used your action this turn',
  'Attacking spends the action'
);

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(
  (select hp::int from public.combatant_secrets),
  (select greatest(0, 7 - sum((shown ->> 'damage')::int))::int from public.combat_events where kind = 'attack'),
  'The damage comes off the goblin''s hit points'
);
select is(
  (select health from public.combatants where id = current_setting('test.goblin')::uuid),
  (select case when hp <= 0 then 'down' when hp * 4 <= max_hp then 'near-death' when hp * 2 <= max_hp then 'bloodied' else 'healthy' end
   from public.combatant_secrets),
  'Players see how hurt it looks, worked out from its hit points'
);
select is(
  (select bool_and(r.passed = (ev.shown ->> 'hit')::boolean) from public.combat_events ev join public.rolls r on r.id = ev.roll_id),
  true,
  'The roll log says hit or miss too'
);
select is(
  (select min(ac)::int from public.combat_event_secrets), 15,
  'The DM can see the armour class each attack was against'
);

-- ---------------------------------------------------------------------------------------------
-- The goblin's turn
-- ---------------------------------------------------------------------------------------------
update public.encounters set current_id = current_setting('test.goblin')::uuid;
update public.characters set temp_hp = 5 where id = current_setting('test.fighter')::uuid;

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.resolve_attack(
       current_setting('test.thorin')::uuid, current_setting('test.goblin')::uuid,
       '{"label": "Longsword", "dice": [{"sides": 20, "count": 1}], "modifier": 7}') $$,
  '42501', 'It isn''t your turn',
  'Players attack only on their own turn'
);

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.bite', public.resolve_attack(
  current_setting('test.goblin')::uuid, current_setting('test.thorin')::uuid,
  '{"label": "Goblin A: Scimitar", "dice": [{"sides": 20, "count": 1}], "modifier": 50,
    "damage": {"dice": [{"sides": 6, "count": 1}], "modifier": 2, "type": "slashing"}}')::text, true);
select is(
  (select temp_hp || '/' || current_hp from public.characters),
  (select greatest(0, 5 - d) || '/' || (40 - greatest(0, d - 5))
   from (select (current_setting('test.bite')::jsonb -> 'event' -> 'shown' ->> 'damage')::int as d) x),
  'A monster''s hit comes off temporary hit points first, then hit points'
);
select ok(
  (select secret from public.rolls where id = (current_setting('test.bite')::jsonb -> 'roll' ->> 'id')::uuid),
  'A monster''s attack is rolled behind the screen'
);
select ok(
  (current_setting('test.bite')::jsonb -> 'event' -> 'shown' ->> 'total') is null,
  '...and its total stays out of the feed'
);
select is(
  current_setting('test.bite')::jsonb -> 'event' -> 'shown' ->> 'label', 'Scimitar',
  'The feed names the monster''s attack but not the monster'
);
select lives_ok(
  $$ select public.undo_event((current_setting('test.bite')::jsonb -> 'event' ->> 'id')::uuid) $$,
  'The DM undoes the goblin''s attack'
);
select is(
  (select temp_hp || '/' || current_hp from public.characters), '5/40',
  '...and the fighter''s hit points come back'
);

-- At 0 hit points a character falls unconscious.
update public.characters set temp_hp = 0, current_hp = 1 where id = current_setting('test.fighter')::uuid;
select set_config('test.bite2', public.resolve_attack(
  current_setting('test.goblin')::uuid, current_setting('test.thorin')::uuid,
  '{"label": "Goblin A: Scimitar", "dice": [{"sides": 20, "count": 1}], "modifier": 50,
    "damage": {"dice": [{"sides": 6, "count": 1}], "modifier": 2, "type": "slashing"}}')::text, true);
select is(
  (select current_hp = 0 and 'unconscious' = any (conditions) from public.characters),
  (current_setting('test.bite2')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean,
  'A character dropped to 0 hit points falls unconscious'
);
select is(
  (current_setting('test.bite2')::jsonb -> 'event' -> 'shown' ->> 'down')::boolean,
  (current_setting('test.bite2')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean,
  'The feed says when someone goes down'
);

-- The DM moves the goblin: no limit, but its feet are counted on its turn.
select lives_ok(
  $$ select public.move_token(current_setting('test.goblin_token')::uuid, 20, 20) $$,
  'The DM moves a monster as far as they like'
);
select is(
  (select feet_moved::int from public.combatants where id = current_setting('test.goblin')::uuid), 90,
  '...and its feet are counted on its turn'
);

-- ---------------------------------------------------------------------------------------------
-- Ending the turn: the next creature starts fresh
-- ---------------------------------------------------------------------------------------------
select is(
  (select current_id from public.end_turn(current_setting('test.encounter')::uuid)),
  current_setting('test.thorin')::uuid,
  'After the last in the order, the first goes again'
);
select is(
  (select (action_used or bonus_used or reaction_used)::text || ' ' || attacks_made || ' ' || feet_moved || ' ' || extra_feet
   from public.combatants where id = current_setting('test.thorin')::uuid),
  'false 0 0 0',
  'A creature starts its turn with everything back'
);
select is((select round::int from public.encounters), 2, 'A new round begins');

-- ---------------------------------------------------------------------------------------------
-- Outsiders and signed-out visitors
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.combat_events), 0, 'An outsider cannot see the feed');
select throws_ok(
  $$ select public.use_action(current_setting('test.thorin')::uuid, 'dash') $$,
  '42501', null,
  'An outsider cannot act in the fight'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.resolve_attack(gen_random_uuid(), gen_random_uuid(), '{}') $$,
  '42501', null,
  'Signed-out visitors cannot attack'
);

reset role;
select * from finish();
rollback;
