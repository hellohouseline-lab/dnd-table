-- Levelling up: a player can't raise their own level until the DM grants it; once they've taken
-- it, the grant is used up; the DM can grant the whole party, and change any level.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('1a1a1a1a-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('1a1a1a1a-0000-4000-8000-000000000002', 'one@example.invalid'),
  ('1a1a1a1a-0000-4000-8000-000000000003', 'two@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "1a1a1a1a-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Level test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "1a1a1a1a-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '1a1a1a1a-0000-4000-8000-000000000003', 'Mira', 'Wizard', 3, 14, 14, 12);

set local request.jwt.claims = '{"sub": "1a1a1a1a-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '1a1a1a1a-0000-4000-8000-000000000002', 'Thorin', 'Fighter', 3, 28, 28, 18);

select throws_ok(
  $$ update public.characters set level = 4 where name = 'Thorin' $$,
  '42501', 'Your DM hasn''t let you level up yet',
  'A player can''t level up on their own'
);
select throws_ok(
  $$ select public.grant_level_up(array(select id from public.characters)) $$,
  '42501', 'Only the DM can let a character level up',
  '...or grant it'
);

set local request.jwt.claims = '{"sub": "1a1a1a1a-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(
  (select count(*)::int from public.grant_level_up(array(select id from public.characters))), 2,
  'The DM lets the whole party level up'
);
select is((select level_up_to::int from public.characters where name = 'Thorin'), 4, '...one level each');

set local request.jwt.claims = '{"sub": "1a1a1a1a-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok($$ update public.characters set level = 4, max_hp = 36 where name = 'Thorin' $$, 'Then the player takes it');
select is((select level_up_to from public.characters where name = 'Thorin'), null, '...and the grant is used up');
select throws_ok(
  $$ update public.characters set level = 5 where name = 'Thorin' $$,
  '42501', 'Your DM hasn''t let you level up yet',
  'One level per grant'
);

set local request.jwt.claims = '{"sub": "1a1a1a1a-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$ update public.characters set level = 6 where name = 'Mira' $$, 'The DM can set any level');

reset role;
select * from finish();
rollback;
