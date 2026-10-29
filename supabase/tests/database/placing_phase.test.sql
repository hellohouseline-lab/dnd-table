-- Placing miniatures before a fight: a new fight opens placing; a player moves their miniature
-- freely and says I'm in place; the first turn waits until the DM starts the battle, even once
-- everyone has rolled initiative.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('d1ace000-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('d1ace000-0000-4000-8000-000000000002', 'player@example.invalid'),
  ('d1ace000-0000-4000-8000-000000000003', 'other@example.invalid');

set local request.jwt.claims = '{"sub": "d1ace000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Placing test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns where id = current_setting('test.campaign')::uuid), true);

set local request.jwt.claims = '{"sub": "d1ace000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'd1ace000-0000-4000-8000-000000000002', 'Elowen', 'Bard', 3, 20, 20, 12);
select set_config('test.elowen_char', (select id::text from public.characters where name = 'Elowen'), true);
set local request.jwt.claims = '{"sub": "d1ace000-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');

set local request.jwt.claims = '{"sub": "d1ace000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.elowen_char')::uuid], null)), true);
select set_config('test.elowen', (select id::text from public.combatants where kind = 'character' and encounter_id = current_setting('test.encounter')::uuid), true);
select set_config('test.d20', '{"label": "Initiative", "kind": "initiative", "dice": [{"sides": 20, "count": 1}], "modifier": 2}', true);

set local role authenticated;

select ok((select placing_phase from public.encounters where id = current_setting('test.encounter')::uuid), 'A new fight opens placing');

-- Elowen says she's in place; nobody else can say it for her except the DM.
set local request.jwt.claims = '{"sub": "d1ace000-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  format('select public.set_placed(%L, true)', current_setting('test.elowen')),
  '42501', 'That isn''t your miniature', 'Another player can''t say she''s in place'
);
set local request.jwt.claims = '{"sub": "d1ace000-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(format('select public.set_placed(%L, true)', current_setting('test.elowen')), 'Elowen is in place');
select ok((select placed from public.combatants where id = current_setting('test.elowen')::uuid), '...and it shows');
select throws_ok(
  format('select public.begin_battle(%L)', current_setting('test.encounter')),
  '42501', 'Only the DM can start the battle', 'A player can''t start the battle'
);

-- Everyone has rolled, but the first turn waits while placing.
select lives_ok(
  format('select public.roll_initiative(%L, %L)', current_setting('test.elowen'), current_setting('test.d20')),
  'Elowen rolls initiative while placing'
);
set local request.jwt.claims = '{"sub": "d1ace000-0000-4000-8000-000000000001", "role": "authenticated"}';
select ok(
  (select current_id is null from public.encounters where id = current_setting('test.encounter')::uuid),
  'The first turn waits for the DM, even with everyone rolled'
);
select lives_ok(format('select public.end_turn(%L)', current_setting('test.encounter')), 'Next turn while placing...');
select ok(
  (select current_id is null from public.encounters where id = current_setting('test.encounter')::uuid),
  '...doesn''t start it either'
);

select lives_ok(format('select public.begin_battle(%L)', current_setting('test.encounter')), 'The DM starts the battle');
select ok(
  (select not placing_phase and current_id = current_setting('test.elowen')::uuid and round = 1
   from public.encounters where id = current_setting('test.encounter')::uuid),
  'Placing ends and the first turn starts'
);

-- A fight already going when this came in is left alone.
reset role;
select ok(
  not exists (select 1 from public.encounters where placing_phase and id <> current_setting('test.encounter')::uuid
              and started_at < now() - interval '1 minute'),
  'Older fights aren''t put into placing'
);

select * from finish();
rollback;
