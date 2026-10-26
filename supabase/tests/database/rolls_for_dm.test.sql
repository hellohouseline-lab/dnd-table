-- A roll for the DM: the player throws a plain d20; only the DM says what it was, adding the
-- character's bonus, and may judge it, once.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('f0f0f0f0-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('f0f0f0f0-0000-4000-8000-000000000002', 'player@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "f0f0f0f0-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('DM rolls test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "f0f0f0f0-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'f0f0f0f0-0000-4000-8000-000000000002', 'Ada', 'Rogue', 1, 8, 8, 13);
select set_config('test.ada', (select id::text from public.characters), true);

select set_config('test.roll', (public.roll_for_dm(current_setting('test.campaign')::uuid, current_setting('test.ada')::uuid, 'advantage')).id::text, true);
select ok(
  (select for_dm and label = 'A roll for the DM' and modifier = 0 and mode = 'advantage' and jsonb_array_length(dice) = 2
   from public.rolls where id = current_setting('test.roll')::uuid),
  'A player rolls a plain d20 for the DM, with advantage'
);
select ok(
  (select not for_dm from public.throw_dice(current_setting('test.campaign')::uuid,
     '{"label": "Anything", "kind": "free", "dice": [{"sides": 20, "count": 1}]}'::jsonb)),
  'An ordinary roll is not for the DM'
);
select throws_ok(
  $$ select public.name_roll(current_setting('test.roll')::uuid, 'Perception check', 'check', 5, '[]', 10, true) $$,
  '42501', null,
  'Only the DM says what a roll was'
);

set local request.jwt.claims = '{"sub": "f0f0f0f0-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.natural', (select natural_d20::text from public.rolls where id = current_setting('test.roll')::uuid), true);
select public.name_roll(current_setting('test.roll')::uuid, 'Perception check', 'check', 5,
  '[{"label": "Wisdom", "value": 1}, {"label": "Proficiency", "value": 4}]', 40, true);
select ok(
  (select not for_dm and label = 'Perception check' and total = current_setting('test.natural')::int + 5
   from public.rolls where id = current_setting('test.roll')::uuid),
  'The DM names it, and the bonus goes on the total'
);
select ok(
  (select passed and not passed_by_dice from public.rolls where id = current_setting('test.roll')::uuid),
  'The DM can pass it even when the dice fall short of the DC'
);
select throws_ok(
  $$ select public.name_roll(current_setting('test.roll')::uuid, 'Stealth check', 'check', 3, '[]', null, null) $$,
  '22023', 'That roll has already been settled',
  'A roll is named once'
);

-- Another, which the DM just lets go.
set local request.jwt.claims = '{"sub": "f0f0f0f0-0000-4000-8000-000000000002", "role": "authenticated"}';
select set_config('test.two', (public.roll_for_dm(current_setting('test.campaign')::uuid, current_setting('test.ada')::uuid, 'normal')).id::text, true);
set local request.jwt.claims = '{"sub": "f0f0f0f0-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.name_roll(current_setting('test.two')::uuid, null, null, null, null, null, null);
select ok(
  (select not for_dm and label = 'A roll for the DM' and passed is null from public.rolls where id = current_setting('test.two')::uuid),
  'Letting it go keeps the roll as it was'
);
select throws_ok(
  $$ select public.name_roll(current_setting('test.two')::uuid, 'A spell', 'attack', 0, '[]', null, null) $$,
  '22023', null,
  'Only checks and saves'
);

reset role;
select * from finish();
rollback;
