-- No two creatures in one square: a player can't end a move on someone, or pass through an enemy's
-- square, but can pass through a friend's; a hidden creature doesn't block; the DM isn't held to it.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('bcbcbcbc-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('bcbcbcbc-0000-4000-8000-000000000002', 'thorin@example.invalid'),
  ('bcbcbcbc-0000-4000-8000-000000000003', 'mira@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "bcbcbcbc-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Square test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
insert into public.assets (campaign_id, kind, category, name, path)
  values (current_setting('test.campaign')::uuid, 'art', 'maps', 'Hall', current_setting('test.campaign') || '/hall.webp');
select set_config('test.map', (select id::text from public.assets where name = 'Hall'), true);

set local request.jwt.claims = '{"sub": "bcbcbcbc-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, speed, max_hp, current_hp)
  values (current_setting('test.campaign')::uuid, 'bcbcbcbc-0000-4000-8000-000000000002', 'Thorin', 60, 20, 20);
set local request.jwt.claims = '{"sub": "bcbcbcbc-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name, speed, max_hp, current_hp)
  values (current_setting('test.campaign')::uuid, 'bcbcbcbc-0000-4000-8000-000000000003', 'Mira', 30, 20, 20);

set local request.jwt.claims = '{"sub": "bcbcbcbc-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, (select array_agg(id) from public.characters), current_setting('test.map')::uuid)), true);
select public.begin_battle(e.id) from public.encounters e where e.placing_phase and e.campaign_id in (select m.campaign_id from public.campaign_members m where m.user_id = auth.uid() and m.role = 'dm');
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A', 5),
         (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Hidden goblin', 4);
-- Thorin at 0,0; Mira at 2,0; a goblin at 0,2; a hidden goblin at 4,4.
insert into public.tokens (campaign_id, map_id, character_id, x, y)
  select current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, id, case when name = 'Thorin' then 0 else 2 end, 0
  from public.characters;
insert into public.tokens (campaign_id, map_id, combatant_id, x, y, hidden)
  select current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, id,
         case when shown_name = 'Goblin A' then 0 else 4 end, case when shown_name = 'Goblin A' then 2 else 4 end,
         shown_name = 'Hidden goblin'
  from public.combatants where kind = 'monster';
update public.combatants set initiative = 20 where character_id = (select id from public.characters where name = 'Thorin');
update public.combatants set initiative = 10 where character_id = (select id from public.characters where name = 'Mira');
update public.encounters set current_id = (select id from public.combatants where initiative = 20);
select set_config('test.token', (select t.id::text from public.tokens t join public.characters c on c.id = t.character_id where c.name = 'Thorin'), true);

set local request.jwt.claims = '{"sub": "bcbcbcbc-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.move_token(current_setting('test.token')::uuid, 0, 2) $$,
  '22023', 'Someone is already in that square',
  'A player can''t end a move on a goblin'
);
select throws_ok(
  $$ select public.move_token(current_setting('test.token')::uuid, 2, 0) $$,
  '22023', 'Someone is already in that square',
  '...or on a friend'
);
select throws_ok(
  $$ select public.move_token(current_setting('test.token')::uuid, 0, 4) $$,
  '22023', 'You can''t move through Goblin A''s square',
  'A player can''t move through an enemy''s square'
);
select lives_ok(
  $$ select public.move_token(current_setting('test.token')::uuid, 4, 0) $$,
  'A player moves through a friend''s square'
);
select lives_ok(
  $$ select public.move_token(current_setting('test.token')::uuid, 4, 4) $$,
  'A hidden creature doesn''t give itself away by blocking'
);

set local request.jwt.claims = '{"sub": "bcbcbcbc-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ select public.move_token((select t.id from public.tokens t join public.combatants c on c.id = t.combatant_id where c.shown_name = 'Goblin A'), 2, 0) $$,
  'The DM isn''t held to it'
);

reset role;
select * from finish();
rollback;
