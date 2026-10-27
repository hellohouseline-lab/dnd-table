-- A monster's ready-made portrait: the DM sets its key when adding it, players can read it, and only
-- a plain key is allowed.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('a7700000-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('a7700000-0000-4000-8000-000000000002', 'player@example.invalid');

set local request.jwt.claims = '{"sub": "a7700000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Art test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns where id = current_setting('test.campaign')::uuid), true);
set local request.jwt.claims = '{"sub": "a7700000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
set local request.jwt.claims = '{"sub": "a7700000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[]::uuid[], null)), true);

set local role authenticated;
select lives_ok(
  format($$insert into public.combatants (encounter_id, campaign_id, kind, shown_name, art)
           values (%L, %L, 'monster', 'Unknown creature 1', 'goblin')$$,
         current_setting('test.encounter'), current_setting('test.campaign')),
  'The DM adds a goblin with its portrait'
);
select throws_ok(
  format($$insert into public.combatants (encounter_id, campaign_id, kind, shown_name, art)
           values (%L, %L, 'monster', 'Unknown creature 2', 'https://example.com/x.png')$$,
         current_setting('test.encounter'), current_setting('test.campaign')),
  '23514', null, 'Only a plain key, never an address'
);
set local request.jwt.claims = '{"sub": "a7700000-0000-4000-8000-000000000002", "role": "authenticated"}';
select is(
  (select art from public.combatants where encounter_id = current_setting('test.encounter')::uuid),
  'goblin', 'Players see which portrait the miniature shows'
);

select * from finish();
rollback;
