-- Who can see and change campaigns and the people in them.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npx supabase test db --linked

begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Four people: a DM, a player and an outsider who all signed in with email, plus an anonymous guest.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'player@example.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'outsider@example.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000004', null);

-- ---------------------------------------------------------------------------------------------
-- The DM starts a campaign
-- ---------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

select set_config('test.campaign', public.create_campaign('The Sunless Citadel', 'Matt', 4, 1)::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

select is((select count(*)::int from public.campaigns), 1, 'The DM sees the new campaign');
select is(
  (select role from public.campaign_members where user_id = auth.uid()), 'dm',
  'The DM is at the table as the DM'
);
select matches(current_setting('test.code'), '^[A-HJ-NP-Z2-9]{6}$', 'The join code is six easy-to-read characters');
select throws_ok(
  $$ select public.create_campaign('', 'Matt') $$, '23514', null,
  'A campaign needs a name'
);

-- ---------------------------------------------------------------------------------------------
-- Someone who isn't at the table
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';

select is((select count(*)::int from public.campaigns), 0, 'An outsider cannot see the campaign');
select is((select count(*)::int from public.campaign_members), 0, 'An outsider cannot see who is at the table');
select is(
  (select name from public.peek_campaign(current_setting('test.code'))), 'The Sunless Citadel',
  'Someone with the code can see which table it opens'
);
select is(
  (select dm_name from public.peek_campaign(lower(current_setting('test.code')))), 'Matt',
  'Codes work in lower case too'
);
select is(
  (select campaign_id from public.peek_campaign(current_setting('test.code'))), null,
  'Peeking does not reveal the campaign''s id to someone not at the table'
);
select is((select count(*)::int from public.peek_campaign('nope')), 0, 'A wrong code shows nothing');
select throws_ok(
  $$ select public.join_campaign('nope', 'Sam') $$, 'P0002', 'That code doesn''t match a table',
  'Joining with a wrong code fails'
);
select throws_ok(
  $$ insert into public.campaigns (name, dm_id, join_code)
     values ('Mine', 'aaaaaaaa-0000-4000-8000-000000000003', 'ABCDEF') $$, '42501', null,
  'Nobody can add a campaign directly'
);
select throws_ok(
  $$ insert into public.campaign_members (campaign_id, user_id, role, display_name)
     values (current_setting('test.campaign')::uuid, auth.uid(), 'dm', 'Sneaky') $$, '42501', null,
  'Nobody can add themselves to a table directly'
);
select ok(
  not private.can_use_campaign_topic('campaign:' || current_setting('test.campaign')),
  'An outsider cannot use the table''s live channel'
);

-- ---------------------------------------------------------------------------------------------
-- A player joins with the code
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  public.join_campaign(' ' || current_setting('test.code') || ' ', 'Sam'), current_setting('test.campaign')::uuid,
  'A player joins with the code'
);
select is(
  public.join_campaign(current_setting('test.code'), 'Sam again'), current_setting('test.campaign')::uuid,
  'Joining twice is harmless'
);
select is((select count(*)::int from public.campaign_members), 2, 'The player sees both people at the table');
select is(
  (select display_name from public.campaign_members where user_id = auth.uid()), 'Sam',
  'Joining twice keeps the first name'
);
select is(
  (select role from public.campaign_members where user_id = auth.uid()), 'player',
  'They joined as a player'
);
select is(
  (select campaign_id from public.peek_campaign(current_setting('test.code'))), current_setting('test.campaign')::uuid,
  'Someone already at the table can open it again from the code'
);
select ok(
  private.can_use_campaign_topic('campaign:' || current_setting('test.campaign')),
  'A player can use the table''s live channel'
);
select ok(
  not private.can_use_campaign_topic('campaign:' || current_setting('test.campaign') || ':dm'),
  'Other channels are refused until a rule allows them'
);

-- What a player can't do
update public.campaigns set name = 'Renamed by a player';
update public.campaign_members set display_name = 'Not Matt' where role = 'dm';
delete from public.campaign_members where role = 'dm';
select is((select name from public.campaigns), 'The Sunless Citadel', 'A player cannot rename the campaign');
select is(
  (select display_name from public.campaign_members where role = 'dm'), 'Matt',
  'A player cannot rename the DM'
);
select is(
  (select count(*)::int from public.campaign_members where role = 'dm'), 1,
  'A player cannot remove the DM'
);
select throws_ok(
  $$ update public.campaign_members set role = 'dm' where user_id = auth.uid() $$, '42501', null,
  'A player cannot make themselves the DM'
);
select throws_ok(
  $$ select public.renew_join_code(current_setting('test.campaign')::uuid) $$, '42501', null,
  'A player cannot change the join code'
);

-- What a player can do
update public.campaign_members set display_name = 'Samwise' where user_id = auth.uid();
select is(
  (select display_name from public.campaign_members where user_id = auth.uid()), 'Samwise',
  'A player can rename themselves'
);

-- ---------------------------------------------------------------------------------------------
-- An anonymous guest (how OBS overlays will log in later)
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000004", "role": "authenticated", "is_anonymous": true}';

select throws_ok(
  $$ select public.create_campaign('Guest game', 'Guest') $$, '42501', null,
  'An anonymous guest cannot start a campaign'
);
select throws_ok(
  $$ select public.join_campaign(current_setting('test.code'), 'Guest') $$, '42501', null,
  'An anonymous guest cannot join with the code'
);
select is(
  (select count(*)::int from public.peek_campaign(current_setting('test.code'))), 0,
  'An anonymous guest cannot peek with the code'
);

-- ---------------------------------------------------------------------------------------------
-- The DM runs the table
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

select set_config('test.new_code', public.renew_join_code(current_setting('test.campaign')::uuid), true);
select isnt(current_setting('test.new_code'), current_setting('test.code'), 'The DM can get a new join code');

update public.campaign_members set here_tonight = false where user_id = 'aaaaaaaa-0000-4000-8000-000000000002';
select is(
  (select here_tonight from public.campaign_members where user_id = 'aaaaaaaa-0000-4000-8000-000000000002'), false,
  'The DM can mark a player as not here tonight'
);

delete from public.campaign_members where user_id = 'aaaaaaaa-0000-4000-8000-000000000002';
delete from public.campaign_members where role = 'dm';
select is((select count(*)::int from public.campaign_members), 1, 'The DM can remove a player but not themselves');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$ select public.join_campaign(current_setting('test.code'), 'Late') $$, 'P0002', null,
  'The old code stops working'
);

-- ---------------------------------------------------------------------------------------------
-- Someone who isn't signed in at all
-- ---------------------------------------------------------------------------------------------
reset role;
set local role anon;

select throws_ok($$ select count(*) from public.campaigns $$, '42501', null, 'Signed-out visitors cannot read campaigns');
select throws_ok(
  $$ select count(*) from public.campaign_members $$, '42501', null,
  'Signed-out visitors cannot read who is at a table'
);
select throws_ok($$ select public.peek_campaign('ABCDEF') $$, '42501', null, 'Signed-out visitors cannot use join codes');

reset role;
select * from finish();
rollback;
