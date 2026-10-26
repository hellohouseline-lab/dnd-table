-- The table's starting level and gold: a character made at level 1 at a level 3 table may level up
-- to 3 straight away; the DM sets the starting gold.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('5a5a5a5a-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('5a5a5a5a-0000-4000-8000-000000000002', 'player@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "5a5a5a5a-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Start test', 'Matt', 4, 3)::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
select lives_ok(
  $$ update public.campaigns set starting_gold = 50 where id = current_setting('test.campaign')::uuid $$,
  'The DM sets the starting gold'
);

set local request.jwt.claims = '{"sub": "5a5a5a5a-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
update public.campaigns set starting_gold = 999 where id = current_setting('test.campaign')::uuid;
select is(
  (select starting_gold from public.campaigns where id = current_setting('test.campaign')::uuid), 50,
  '...and players can''t change it'
);
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '5a5a5a5a-0000-4000-8000-000000000002', 'Kai', 'Monk', 1, 9, 9, 15);
select is((select level_up_to::int from public.characters where name = 'Kai'), 3, 'A new level 1 character may go to the table''s level 3');
select lives_ok($$ update public.characters set level = 2 where name = 'Kai' $$, '...one level at a time');

reset role;
select * from finish();
rollback;
