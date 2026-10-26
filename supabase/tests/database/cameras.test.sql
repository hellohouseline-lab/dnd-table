-- Who can see and change the camera addresses and the table's camera password.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('cccccccc-0000-4000-8000-000000000002', 'player@example.invalid'),
  ('cccccccc-0000-4000-8000-000000000003', 'outsider@example.invalid'),
  ('cccccccc-0000-4000-8000-000000000004', null);

-- The DM starts a campaign and a player joins it
set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('The Sunless Citadel', 'Matt', 4, 1)::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
select set_config('test.key', (select camera_key from public.campaigns), true);

set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');

-- ---------------------------------------------------------------------------------------------
-- What the player sees
-- ---------------------------------------------------------------------------------------------
select matches(current_setting('test.key'), '^[a-f0-9]{24}$', 'A new table gets a random camera password');
select is(
  (select camera_key from public.campaigns), current_setting('test.key'),
  'A player can read the table''s camera password'
);
select is(
  (select count(distinct camera_id)::int from public.campaign_members), 2,
  'Everyone at the table has their own camera address, and the player can read both'
);
select ok(
  (select bool_and(camera_id ~ '^dnd[a-f0-9]{18}$') from public.campaign_members),
  'Camera addresses are made at random'
);
select set_config('test.mine', (select camera_id from public.campaign_members where user_id = auth.uid()), true);
select set_config('test.dms', (select camera_id from public.campaign_members where role = 'dm'), true);

-- What the player can't do
select throws_ok(
  $$ update public.campaign_members set camera_id = current_setting('test.dms') where user_id = auth.uid() $$,
  '42501', null,
  'A player cannot take someone else''s camera address'
);
select throws_ok(
  $$ update public.campaign_members set camera_id = 'dnd0123456789abcdef01' where user_id = auth.uid() $$,
  '42501', null,
  'A player cannot choose their own camera address'
);
select throws_ok(
  $$ update public.campaigns set camera_key = '0123456789abcdef01234567' $$, '42501', null,
  'A player cannot change the camera password'
);
select throws_ok(
  $$ select public.renew_camera_key(current_setting('test.campaign')::uuid) $$, '42501', null,
  'A player cannot make new camera links'
);
select is(
  (select camera_key from public.campaigns), current_setting('test.key'),
  'The camera password is unchanged'
);

-- ---------------------------------------------------------------------------------------------
-- Someone who isn't at the table, and an anonymous guest
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.campaigns), 0, 'An outsider cannot see the camera password');
select is((select count(*)::int from public.campaign_members), 0, 'An outsider cannot see the camera addresses');
select throws_ok(
  $$ select public.renew_camera_key(current_setting('test.campaign')::uuid) $$, '42501', null,
  'An outsider cannot make new camera links'
);

set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000004", "role": "authenticated", "is_anonymous": true}';
select is((select count(*)::int from public.campaigns), 0, 'An anonymous guest cannot see the camera password');
select is((select count(*)::int from public.campaign_members), 0, 'An anonymous guest cannot see the camera addresses');

-- ---------------------------------------------------------------------------------------------
-- The DM
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ update public.campaign_members set camera_id = 'dnd0123456789abcdef01' where role = 'player' $$,
  '42501', null,
  'Even the DM cannot type a camera address'
);
select lives_ok(
  $$ select public.renew_camera_key(current_setting('test.campaign')::uuid) $$,
  'The DM can make new camera links'
);
select isnt(
  (select camera_key from public.campaigns), current_setting('test.key'),
  'Making new camera links changes the camera password'
);
select matches(
  (select camera_key from public.campaigns), '^[a-f0-9]{24}$',
  'The new camera password is random too'
);
select is(
  (select camera_id from public.campaign_members where role = 'player'), current_setting('test.mine'),
  'Camera addresses stay the same, so nobody has to set anything up again'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.renew_camera_key('00000000-0000-4000-8000-000000000000') $$, '42501', null,
  'Signed-out visitors cannot make new camera links'
);

reset role;
select * from finish();
rollback;
