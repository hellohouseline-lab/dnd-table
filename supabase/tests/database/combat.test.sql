-- Fights, hidden monsters, initiative, battle maps and tokens: who can see and change what.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('ffffffff-0000-4000-8000-000000000002', 'player@example.invalid'),
  ('ffffffff-0000-4000-8000-000000000003', 'outsider@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Fight test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, dexterity)
  values (current_setting('test.campaign')::uuid, 'ffffffff-0000-4000-8000-000000000002', 'Dwarf Fighter', 14);
select set_config('test.fighter', (select id::text from public.characters), true);

-- ---------------------------------------------------------------------------------------------
-- The DM sets up a fight with two goblins
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.encounters (campaign_id) values (current_setting('test.campaign')::uuid) $$,
  'The DM starts a fight'
);
select set_config('test.encounter', (select id::text from public.encounters), true);
select throws_ok(
  $$ insert into public.encounters (campaign_id) values (current_setting('test.campaign')::uuid) $$,
  '23505', null,
  'One fight at a time'
);
insert into public.combatants (encounter_id, campaign_id, kind, character_id, shown_name, revealed)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'character',
    current_setting('test.fighter')::uuid, 'Dwarf Fighter', true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, tiebreak) values
  (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Unknown creature 1', 14),
  (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Unknown creature 2', 14);
select set_config('test.goblin', (select id::text from public.combatants where shown_name = 'Unknown creature 1'), true);
select set_config('test.goblin2', (select id::text from public.combatants where shown_name = 'Unknown creature 2'), true);
select lives_ok(
  $$ insert into public.combatant_secrets (combatant_id, campaign_id, name, monster, hp, max_hp, ac) values
       (current_setting('test.goblin')::uuid, current_setting('test.campaign')::uuid, 'Goblin A', 'goblin', 7, 7, 15),
       (current_setting('test.goblin2')::uuid, current_setting('test.campaign')::uuid, 'Goblin B', 'goblin', 7, 7, 15) $$,
  'The DM keeps the goblins'' real names and numbers secret'
);
select lives_ok(
  $$ select public.roll_initiative(current_setting('test.goblin')::uuid,
       '{"dice": [{"sides": 20, "count": 1}], "modifier": 2}') $$,
  'The DM rolls a monster''s initiative'
);
select ok(
  (select initiative between 3 and 22 from public.combatants where id = current_setting('test.goblin')::uuid),
  'The monster''s initiative goes into the turn order'
);
select ok(
  (select secret from public.rolls where kind = 'initiative' order by created_at desc limit 1),
  'A monster''s initiative is rolled behind the screen'
);

-- ---------------------------------------------------------------------------------------------
-- The player
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';

select is((select count(*)::int from public.combatants), 3, 'A player sees the turn order');
select is((select count(*)::int from public.combatant_secrets), 0, 'A player cannot see the monsters'' secrets');
select is(
  (select shown_name from public.combatants where id = current_setting('test.goblin')::uuid),
  'Unknown creature 1',
  'A player sees an unknown creature, not a goblin'
);
select is((select count(*)::int from public.rolls where kind = 'initiative'), 0, 'A player cannot see the monster''s roll');
select throws_ok(
  $$ select public.roll_initiative(current_setting('test.goblin2')::uuid, '{"dice": [{"sides": 20, "count": 1}]}') $$,
  '42501', null,
  'A player cannot roll for a monster'
);
select throws_ok(
  $$ select public.roll_initiative((select id from public.combatants where kind = 'character'),
       '{"dice": [{"sides": 20, "count": 2}]}') $$,
  '22023', null,
  'Initiative is a single d20'
);
select lives_ok(
  $$ select public.roll_initiative((select id from public.combatants where kind = 'character'),
       '{"dice": [{"sides": 20, "count": 1}], "modifier": 2, "mode": "advantage"}') $$,
  'A player rolls their own initiative'
);
select ok(
  (select initiative between 3 and 22 and tiebreak = 14 from public.combatants where kind = 'character'),
  'Their initiative and Dexterity go into the turn order'
);
select throws_ok(
  $$ select public.roll_initiative((select id from public.combatants where kind = 'character'), '{"dice": [{"sides": 20, "count": 1}]}') $$,
  '23505', null,
  'A player rolls initiative once'
);
select throws_ok(
  $$ insert into public.combatants (encounter_id, campaign_id, kind, shown_name)
     values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Fake') $$,
  '42501', null,
  'A player cannot add to the fight'
);
update public.combatants set health = 'down' where id = current_setting('test.goblin')::uuid;
update public.encounters set round = 9;
select ok(
  (select health = 'healthy' from public.combatants where id = current_setting('test.goblin')::uuid)
  and (select round = 1 from public.encounters),
  'A player cannot change the fight'
);

-- ---------------------------------------------------------------------------------------------
-- The DM reveals one goblin and wounds it
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.combatants set shown_name = 'Goblin A', revealed = true, health = 'bloodied'
  where id = current_setting('test.goblin')::uuid;
update public.combatant_secrets set hp = 3 where combatant_id = current_setting('test.goblin')::uuid;

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select is(
  (select shown_name || ' ' || health from public.combatants where id = current_setting('test.goblin')::uuid),
  'Goblin A bloodied',
  'Once revealed, players see its name and how hurt it looks, but not its hit points'
);

-- ---------------------------------------------------------------------------------------------
-- A battle map with tokens
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
insert into public.assets (campaign_id, kind, category, name, path)
  values (current_setting('test.campaign')::uuid, 'art', 'maps', 'Tavern map', current_setting('test.campaign') || '/map.webp');
select set_config('test.map', (select id::text from public.assets where name = 'Tavern map'), true);
insert into public.stage (campaign_id, map_id, mode) values (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, 'scene');
select lives_ok(
  $$ insert into public.tokens (campaign_id, map_id, character_id, x, y) values
       (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.fighter')::uuid, 3, 3);
     insert into public.tokens (campaign_id, map_id, combatant_id, x, y, hidden) values
       (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.goblin')::uuid, 8, 3, false),
       (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.goblin2')::uuid, 9, 9, true) $$,
  'The DM places tokens, one of them hidden'
);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.tokens), 0, 'Players see no tokens while the map is not on stage');
select ok(not private.can_see_art(current_setting('test.campaign') || '/map.webp'), '...nor the map itself');

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.stage set mode = 'map' where campaign_id = current_setting('test.campaign')::uuid;

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.tokens), 2, 'With the map on stage, players see the tokens that aren''t hidden');
select ok(private.can_see_art(current_setting('test.campaign') || '/map.webp'), 'Players can open the map on stage');
select is((select name from public.assets where kind = 'art'), 'Tavern map', 'Players see the map''s details, for its grid');
update public.tokens set x = 5 where character_id = current_setting('test.fighter')::uuid;
select is((select x from public.tokens where character_id is not null), 5::smallint, 'A player moves their own token');
update public.tokens set x = 1 where combatant_id = current_setting('test.goblin')::uuid;
select is(
  (select x from public.tokens where combatant_id = current_setting('test.goblin')::uuid),
  8::smallint,
  'A player cannot move a monster'
);
select throws_ok(
  $$ update public.tokens set hidden = true where character_id = current_setting('test.fighter')::uuid $$,
  '42501', null,
  'A player cannot hide their token'
);

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.stage set players_move_tokens = false where campaign_id = current_setting('test.campaign')::uuid;
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000002", "role": "authenticated"}';
update public.tokens set x = 6 where character_id = current_setting('test.fighter')::uuid;
select is((select x from public.tokens where character_id is not null), 5::smallint, 'Players can''t move tokens when the DM says not to');

-- ---------------------------------------------------------------------------------------------
-- Someone not at the table, and the end of the fight
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.encounters), 0, 'An outsider cannot see the fight');
select is((select count(*)::int from public.tokens), 0, 'An outsider cannot see the tokens');

set local request.jwt.claims = '{"sub": "ffffffff-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ update public.encounters set status = 'ended', ended_at = now() where id = current_setting('test.encounter')::uuid $$,
  'The DM ends the fight'
);
select throws_ok(
  $$ select public.roll_initiative(current_setting('test.goblin2')::uuid, '{"dice": [{"sides": 20, "count": 1}]}') $$,
  '22023', null,
  'Nobody rolls initiative for a fight that is over'
);
select lives_ok(
  $$ insert into public.encounters (campaign_id) values (current_setting('test.campaign')::uuid) $$,
  'A new fight can start once the last has ended'
);

reset role;
select * from finish();
rollback;
