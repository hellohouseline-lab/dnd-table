-- The DM asks for a roll, players answer it, the server judges it against a DC players never see.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- A DM, two players and an outsider who all signed in with email.
insert into auth.users (id, email) values
  ('dddddddd-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('dddddddd-0000-4000-8000-000000000002', 'player1@example.invalid'),
  ('dddddddd-0000-4000-8000-000000000003', 'player2@example.invalid'),
  ('dddddddd-0000-4000-8000-000000000004', 'outsider@example.invalid');

set local role authenticated;

-- The DM starts a campaign, both players join and make characters.
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Request test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name)
  values (current_setting('test.campaign')::uuid, 'dddddddd-0000-4000-8000-000000000003', 'Elf Wizard');
select set_config('test.wizard', (select id::text from public.characters where name = 'Elf Wizard'), true);
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name)
  values (current_setting('test.campaign')::uuid, 'dddddddd-0000-4000-8000-000000000002', 'Dwarf Fighter');
select set_config('test.fighter', (select id::text from public.characters where name = 'Dwarf Fighter'), true);

-- ---------------------------------------------------------------------------------------------
-- Asking
-- ---------------------------------------------------------------------------------------------

select throws_ok(
  $$ select public.ask_for_roll(current_setting('test.campaign')::uuid,
       jsonb_build_object('character_ids', jsonb_build_array(current_setting('test.fighter')))
       || '{"kind": "save", "ability": "constitution", "label": "Constitution saving throw", "dc": 15}'::jsonb) $$,
  '42501', null,
  'A player cannot ask for a roll'
);

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';

-- An easy one everybody passes (DC 1) and, later, an impossible one (DC 40).
select lives_ok(
  $$ select set_config('test.easy', (public.ask_for_roll(current_setting('test.campaign')::uuid,
       jsonb_build_object('character_ids', jsonb_build_array(current_setting('test.fighter'), current_setting('test.wizard')))
       || '{"kind": "save", "ability": "constitution", "label": "Easy save", "plain": "Hold on.", "dc": 1}'::jsonb)).id::text, true) $$,
  'The DM asks two characters to roll'
);
select is((select shown_dc from public.roll_requests where label = 'Easy save'), null::smallint, 'A secret DC is not on the request');
select is((select dc from public.roll_request_secrets), 1::smallint, 'The DM can read the DC');
select throws_ok(
  $$ select public.ask_for_roll(current_setting('test.campaign')::uuid,
       '{"kind": "save", "ability": "wisdom", "label": "Nobody", "dc": 10, "character_ids": []}'::jsonb) $$,
  '22023', null,
  'Somebody has to be asked'
);
select throws_ok(
  $$ select public.ask_for_roll(current_setting('test.campaign')::uuid,
       '{"kind": "save", "ability": "wisdom", "label": "Stranger", "dc": 10, "character_ids": ["00000000-0000-4000-8000-000000000000"]}'::jsonb) $$,
  '22023', null,
  'Only characters at this table can be asked'
);
select throws_ok(
  $$ select public.ask_for_roll(current_setting('test.campaign')::uuid,
       jsonb_build_object('character_ids', jsonb_build_array(current_setting('test.fighter')))
       || '{"kind": "save", "ability": "wisdom", "label": "Too hard", "dc": 45}'::jsonb) $$,
  '22023', null,
  'The DC stays between 1 and 40'
);
select throws_ok(
  $$ insert into public.roll_requests (campaign_id, kind, ability, label, character_ids)
     values (current_setting('test.campaign')::uuid, 'save', 'wisdom', 'Direct', '{}') $$,
  '42501', null,
  'Requests are only made through ask_for_roll'
);

-- ---------------------------------------------------------------------------------------------
-- Player 1 answers
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';

select is((select count(*)::int from public.roll_requests where status = 'open'), 1, 'A player sees the open request');
select is((select count(*)::int from public.roll_request_secrets), 0, 'A player cannot see the DC');
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('request_id', current_setting('test.easy'), 'character_id', current_setting('test.wizard'))
       || '{"kind": "save", "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  '42501', null,
  'A player cannot answer for someone else''s character'
);
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('request_id', current_setting('test.easy'), 'character_id', current_setting('test.fighter'))
       || '{"kind": "save", "dice": [{"sides": 6, "count": 2}]}'::jsonb) $$,
  '22023', null,
  'An answer is a single d20'
);
select lives_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('request_id', current_setting('test.easy'), 'character_id', current_setting('test.fighter'))
       || '{"kind": "save", "label": "Anything", "secret": true, "mode": "advantage", "modifier": 2, "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  'A player answers for their own character, with advantage'
);
select ok(
  (select passed is null and passed_by_dice is null from public.rolls where request_id = current_setting('test.easy')::uuid),
  'The answer waits for the DM''s ruling: no verdict reaches the player'
);
select ok(
  (select label = 'Easy save' and not secret and kind = 'save' from public.rolls where request_id = current_setting('test.easy')::uuid),
  'An answer takes the request''s name and is never secret'
);
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('request_id', current_setting('test.easy'), 'character_id', current_setting('test.fighter'))
       || '{"kind": "save", "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  '23505', null,
  'Each character answers once'
);
select throws_ok(
  $$ select public.override_roll((select id from public.rolls where request_id = current_setting('test.easy')::uuid), false) $$,
  '42501', null,
  'A player cannot change a result'
);
select throws_ok(
  $$ select public.close_roll_request(current_setting('test.easy')::uuid) $$,
  '42501', null,
  'A player cannot close the request'
);

-- ---------------------------------------------------------------------------------------------
-- The outsider
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000004", "role": "authenticated"}';
select is((select count(*)::int from public.roll_requests), 0, 'An outsider cannot see the requests');

-- ---------------------------------------------------------------------------------------------
-- The DM overrides, then asks again
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';

select public.override_roll((select id from public.rolls where request_id = current_setting('test.easy')::uuid), false);
select ok(
  (select not passed and passed_by_dice from public.rolls where request_id = current_setting('test.easy')::uuid),
  'The DM rules it a fail, and what the dice said (a pass against DC 1) is kept'
);
select throws_ok(
  $$ select public.override_roll((select id from public.rolls where label = 'Nothing asked' limit 1), true) $$,
  '42501', null,
  'There must be a roll to change'
);

select set_config('test.hard', (public.ask_for_roll(current_setting('test.campaign')::uuid,
  jsonb_build_object('character_ids', jsonb_build_array(current_setting('test.wizard')))
  || '{"kind": "skill", "ability": "intelligence", "skill": "arcana", "label": "Arcana check", "dc": 40, "dc_shown": true}'::jsonb)).id::text, true);
select is((select status from public.roll_requests where label = 'Easy save'), 'closed', 'Asking again closes the last request');
select is((select shown_dc from public.roll_requests where label = 'Arcana check'), 40::smallint, 'A DC the DM shows is on the request');
select lives_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('request_id', current_setting('test.hard'), 'character_id', current_setting('test.wizard'))
       || '{"kind": "check", "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  'The DM can roll for a character who was asked'
);
select is(
  (select count(*)::int from public.accept_dice(current_setting('test.hard')::uuid)), 1,
  'The DM goes with the dice for everyone not yet ruled on'
);
select ok(
  (select not passed and not passed_by_dice from public.rolls where request_id = current_setting('test.hard')::uuid),
  'Nothing passes DC 40 without a bonus, natural 20 or not'
);

-- ---------------------------------------------------------------------------------------------
-- Player 1 again: not asked, and then too late
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('request_id', current_setting('test.hard'), 'character_id', current_setting('test.fighter'))
       || '{"kind": "check", "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  '42501', null,
  'A character who wasn''t asked cannot answer'
);
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('request_id', current_setting('test.easy'), 'character_id', current_setting('test.fighter'))
       || '{"kind": "save", "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  '22023', null,
  'A closed request takes no more answers'
);
select is((select count(*)::int from public.rolls where request_id is not null), 2, 'Players see everyone''s answers');

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.close_roll_request(current_setting('test.hard')::uuid) $$, 'The DM closes the request');
select is((select count(*)::int from public.roll_requests where status = 'open'), 0, 'Nothing is left open');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.roll_requests $$, '42501', null, 'Signed-out visitors cannot read requests');

reset role;
select * from finish();
rollback;
