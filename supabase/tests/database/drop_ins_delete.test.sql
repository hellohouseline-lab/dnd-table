-- Drop-in players and deleting a table: a character made after the party levelled up may level up to
-- the party's level; only the DM adds people to a running fight or deletes a table, and deleting it
-- takes everything with it.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('d1000000-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('d1000000-0000-4000-8000-000000000002', 'regular@example.invalid'),
  ('d1000000-0000-4000-8000-000000000003', 'dropin@example.invalid');

set local request.jwt.claims = '{"sub": "d1000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Drop-in test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns where id = current_setting('test.campaign')::uuid), true);

set local request.jwt.claims = '{"sub": "d1000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'd1000000-0000-4000-8000-000000000002', 'Thorin', 'Fighter', 3, 28, 28, 16);

set local request.jwt.claims = '{"sub": "d1000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid,
  array(select id from public.characters where campaign_id = current_setting('test.campaign')::uuid), null)), true);

-- A drop-in joins mid-fight.
set local request.jwt.claims = '{"sub": "d1000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'd1000000-0000-4000-8000-000000000003', 'Pip', 'Rogue', 1, 9, 9, 14);
select set_config('test.pip', (select id::text from public.characters where name = 'Pip'), true);

set local role authenticated;
select is((select level_up_to from public.characters where name = 'Pip'), 3::smallint,
  'A drop-in''s character may level up to the party''s level');

select throws_ok(
  format('select public.join_fight(%L, array[%L]::uuid[])', current_setting('test.encounter'), current_setting('test.pip')),
  '42501', 'Only the DM adds people to a fight', 'A player can''t add people to a fight'
);
select throws_ok(
  format('select public.delete_campaign(%L)', current_setting('test.campaign')),
  '42501', 'Only the DM can delete a table', 'A player can''t delete a table'
);

set local request.jwt.claims = '{"sub": "d1000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(
  public.join_fight(current_setting('test.encounter')::uuid, array[current_setting('test.pip')::uuid]),
  1, 'The DM adds the drop-in to the fight'
);
select is(
  public.join_fight(current_setting('test.encounter')::uuid, array[current_setting('test.pip')::uuid]),
  0, '...once'
);
select ok(
  (select initiative is null from public.combatants where character_id = current_setting('test.pip')::uuid),
  '...and they roll initiative like everyone else'
);

select lives_ok(
  format('select public.delete_campaign(%L)', current_setting('test.campaign')),
  'The DM deletes the table'
);
select is((select count(*)::int from public.campaigns where id = current_setting('test.campaign')::uuid), 0, '...it''s gone');
select is(
  (select count(*)::int from public.characters where campaign_id = current_setting('test.campaign')::uuid)
  + (select count(*)::int from public.combatants where campaign_id = current_setting('test.campaign')::uuid),
  0, '...with its characters and fight'
);

select * from finish();
rollback;
