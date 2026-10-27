-- Tell players the outcome, off: the DM's ruling goes to a DM-only table and the roll itself keeps
-- no verdict, so players never see pass or fail. On, it works as before.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('4a4a4a4a-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('4a4a4a4a-0000-4000-8000-000000000002', 'wren@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Outcome test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Jo');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '4a4a4a4a-0000-4000-8000-000000000002', 'Wren', 'Bard', 2, 14, 14, 13);
select set_config('test.wren', (select id::text from public.characters where name = 'Wren'), true);

-- A secret Insight check, outcome hidden.
set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.request', (select id::text from public.ask_for_roll(current_setting('test.campaign')::uuid,
  jsonb_build_object('kind', 'skill', 'ability', 'wisdom', 'skill', 'insight', 'label', 'Insight check',
    'character_ids', jsonb_build_array(current_setting('test.wren')), 'dc', 15, 'dc_shown', false, 'outcome_shown', false))), true);

set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select outcome_shown from public.roll_requests), false, 'Players know the outcome is kept from them');
select set_config('test.roll', (select id::text from public.throw_dice(current_setting('test.campaign')::uuid, jsonb_build_object(
  'label', 'Insight check', 'kind', 'check', 'character_id', current_setting('test.wren'),
  'request_id', current_setting('test.request'),
  'dice', jsonb_build_array(jsonb_build_object('sides', 20, 'count', 1)),
  'modifier', 2, 'parts', '[]'::jsonb, 'mode', 'normal', 'secret', false))), true);

set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.override_roll(current_setting('test.roll')::uuid, true);
select is((select passed from public.rolls where id = current_setting('test.roll')::uuid), null, 'The roll itself keeps no verdict');
select is((select passed from public.roll_verdicts where roll_id = current_setting('test.roll')::uuid), true, 'The DM sees their ruling');

set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.roll_verdicts), 0, 'Players never see the verdict');
select is((select passed from public.rolls where id = current_setting('test.roll')::uuid), null, '...nor on their roll');

-- Go with the dice also keeps it hidden.
set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.accept_dice(current_setting('test.request')::uuid);
select is((select count(*)::int from public.roll_verdicts), 1, 'Go with the dice keeps the ruling already made, in secret');
select is((select passed from public.rolls where id = current_setting('test.roll')::uuid), null, '...and the roll stays without a verdict');

-- Shown, as before.
select set_config('test.request2', (select id::text from public.ask_for_roll(current_setting('test.campaign')::uuid,
  jsonb_build_object('kind', 'skill', 'ability', 'wisdom', 'skill', 'perception', 'label', 'Perception check',
    'character_ids', jsonb_build_array(current_setting('test.wren')), 'dc', 1, 'dc_shown', true))), true);
set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000002", "role": "authenticated"}';
select set_config('test.roll2', (select id::text from public.throw_dice(current_setting('test.campaign')::uuid, jsonb_build_object(
  'label', 'Perception check', 'kind', 'check', 'character_id', current_setting('test.wren'),
  'request_id', current_setting('test.request2'),
  'dice', jsonb_build_array(jsonb_build_object('sides', 20, 'count', 1)),
  'modifier', 2, 'parts', '[]'::jsonb, 'mode', 'normal', 'secret', false))), true);
set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.accept_dice(current_setting('test.request2')::uuid);
set local request.jwt.claims = '{"sub": "4a4a4a4a-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select passed from public.rolls where id = current_setting('test.roll2')::uuid), true, 'Told, players see they passed');

select * from finish();
rollback;
