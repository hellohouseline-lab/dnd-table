-- Fair dice thrown by the server, and who can see which rolls.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- A DM, two players and an outsider who all signed in with email, plus an anonymous guest.
insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('cccccccc-0000-4000-8000-000000000002', 'player1@example.invalid'),
  ('cccccccc-0000-4000-8000-000000000003', 'player2@example.invalid'),
  ('cccccccc-0000-4000-8000-000000000004', 'outsider@example.invalid'),
  ('cccccccc-0000-4000-8000-000000000005', null);

set local role authenticated;

-- The DM starts a campaign, both players join and make characters.
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Dice test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name)
  values (current_setting('test.campaign')::uuid, 'cccccccc-0000-4000-8000-000000000003', 'Elf Wizard');
select set_config('test.wizard', (select id::text from public.characters where name = 'Elf Wizard'), true);
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name)
  values (current_setting('test.campaign')::uuid, 'cccccccc-0000-4000-8000-000000000002', 'Dwarf Fighter');
select set_config('test.fighter', (select id::text from public.characters where name = 'Dwarf Fighter'), true);

-- ---------------------------------------------------------------------------------------------
-- Player 1 throws dice
-- ---------------------------------------------------------------------------------------------

update public.campaign_members set dice_style = '{"material": "glass", "colour": "ruby", "numbers": "gold"}'
  where campaign_id = current_setting('test.campaign')::uuid and user_id = 'cccccccc-0000-4000-8000-000000000002';

select lives_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       '{"label": "Two six-siders", "kind": "free", "dice": [{"sides": 6, "count": 2}], "modifier": 3}') $$,
  'A player throws a free roll'
);
select is(
  (select count(*)::int from public.rolls r, jsonb_array_elements(r.dice) d
   where r.label = 'Two six-siders' and (d ->> 'value')::int between 1 and 6),
  2,
  'Each die lands between 1 and its number of sides'
);
select is(
  (select total - private.kept_sum(dice) from public.rolls where label = 'Two six-siders'),
  3,
  'The total is the dice plus the bonus'
);
select is((select natural_d20 from public.rolls where label = 'Two six-siders'), null::smallint, 'Only a single d20 has a natural');
select is(
  (select style ->> 'material' from public.rolls where label = 'Two six-siders'),
  'glass',
  'The roll carries the roller''s dice look'
);

select public.throw_dice(current_setting('test.campaign')::uuid,
  '{"label": "Lucky", "kind": "check", "dice": [{"sides": 20, "count": 1}], "mode": "advantage", "modifier": 2}');
select is(
  (select count(*)::int from public.rolls r, jsonb_array_elements(r.dice) d where r.label = 'Lucky' and (d ->> 'dropped')::boolean),
  1,
  'Advantage throws two d20s and drops one'
);
select ok(
  (select bool_and(kept.v >= dropped.v) from public.rolls r,
     lateral (select (d ->> 'value')::int v from jsonb_array_elements(r.dice) d where not (d ->> 'dropped')::boolean) kept,
     lateral (select (d ->> 'value')::int v from jsonb_array_elements(r.dice) d where (d ->> 'dropped')::boolean) dropped
   where r.label = 'Lucky'),
  'Advantage keeps the higher d20'
);
select ok(
  (select natural_d20 = private.kept_sum(dice) and total = natural_d20 + 2 from public.rolls where label = 'Lucky'),
  'The natural is the d20 that counts'
);

select public.throw_dice(current_setting('test.campaign')::uuid,
  '{"label": "Unlucky", "kind": "save", "dice": [{"sides": 20, "count": 1}], "mode": "disadvantage"}')
  from generate_series(1, 20);
select is(
  (select count(*)::int from public.rolls r,
     lateral (select (d ->> 'value')::int v from jsonb_array_elements(r.dice) d where not (d ->> 'dropped')::boolean) kept,
     lateral (select (d ->> 'value')::int v from jsonb_array_elements(r.dice) d where (d ->> 'dropped')::boolean) dropped
   where r.label = 'Unlucky' and kept.v > dropped.v),
  0,
  'Disadvantage keeps the lower d20'
);

select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       '{"label": "Odd", "kind": "free", "dice": [{"sides": 6, "count": 2}], "mode": "advantage"}') $$,
  '22023', null,
  'Advantage needs a single d20'
);
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       '{"label": "Odd", "kind": "free", "dice": [{"sides": 7, "count": 1}]}') $$,
  '22023', null,
  'Only real dice can be thrown'
);
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       '{"label": "Odd", "kind": "free", "dice": [{"sides": 6, "count": 20}, {"sides": 8, "count": 20}, {"sides": 4, "count": 1}]}') $$,
  '22023', null,
  'At most 40 dice at once'
);
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       '{"label": "Odd", "kind": "check", "dice": [{"sides": 20, "count": 1}], "damage": {"dice": [{"sides": 8, "count": 1}]}}') $$,
  '22023', null,
  'Only an attack carries damage'
);

-- A hundred longsword swings: a natural 1 throws no damage, a natural 20 doubles the damage dice.
select public.throw_dice(current_setting('test.campaign')::uuid,
  jsonb_build_object('character_id', current_setting('test.fighter')) || '{"label": "Many swings", "kind": "attack", "dice": [{"sides": 20, "count": 1}], "modifier": 5, "damage": {"dice": [{"sides": 8, "count": 1}], "modifier": 3, "type": "slashing"}}'::jsonb)
  from generate_series(1, 100);
select is(
  (select count(*)::int from public.rolls where label = 'Many swings' and not (case
     when natural_d20 = 1 then damage is null
     when natural_d20 = 20 then jsonb_array_length(damage -> 'dice') = 2 and (damage ->> 'critical')::boolean
     else jsonb_array_length(damage -> 'dice') = 1 and not (damage ->> 'critical')::boolean
   end)),
  0,
  'A natural 1 misses and a natural 20 doubles the damage dice'
);
select is(
  (select count(*)::int from public.rolls where label = 'Many swings' and damage is not null
     and (damage ->> 'total')::int <> private.kept_sum(damage -> 'dice') + 3),
  0,
  'Damage is the damage dice plus the bonus'
);

select public.throw_dice(current_setting('test.campaign')::uuid,
  '{"label": "Weak swings", "kind": "attack", "dice": [{"sides": 20, "count": 1}], "damage": {"dice": [{"sides": 4, "count": 1}], "modifier": -9}}')
  from generate_series(1, 10);
select is(
  (select count(*)::int from public.rolls where label = 'Weak swings' and damage is not null and (damage ->> 'total')::int <> 0),
  0,
  'Damage never goes below 0'
);

select public.throw_dice(current_setting('test.campaign')::uuid,
  '{"label": "Punches", "kind": "attack", "dice": [{"sides": 20, "count": 1}], "damage": {"dice": [], "modifier": 4, "type": "bludgeoning"}}')
  from generate_series(1, 10);
select is(
  (select count(*)::int from public.rolls where label = 'Punches' and natural_d20 <> 1
     and ((damage ->> 'total')::int <> 4 or jsonb_array_length(damage -> 'dice') <> 0)),
  0,
  'Damage with no dice is flat, such as an unarmed strike'
);

-- Fairness: 2,000 d20s should show every face close to 100 times.
select public.throw_dice(current_setting('test.campaign')::uuid,
  '{"label": "Fairness", "kind": "free", "dice": [{"sides": 20, "count": 20}, {"sides": 20, "count": 20}]}')
  from generate_series(1, 50);
select is(
  (select count(*)::int from (
     select (d ->> 'value')::int face, count(*) n
     from public.rolls r, jsonb_array_elements(r.dice) d where r.label = 'Fairness' group by 1
   ) faces where face between 1 and 20 and n between 55 and 145),
  20,
  'Every face of a d20 comes up about as often'
);
select public.throw_dice(current_setting('test.campaign')::uuid,
  '{"label": "Percentile", "kind": "free", "dice": [{"sides": 100, "count": 20}]}') from generate_series(1, 5);
select is(
  (select count(*)::int from public.rolls r, jsonb_array_elements(r.dice) d
   where r.label = 'Percentile' and (d ->> 'value')::int not between 1 and 100),
  0,
  'A d100 lands between 1 and 100'
);

-- Whose character
select lives_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('character_id', current_setting('test.fighter')) || '{"label": "Athletics check", "kind": "check", "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  'A player rolls for their own character'
);
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('character_id', current_setting('test.wizard')) || '{"label": "Arcana check", "kind": "check", "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  '42501', null,
  'A player cannot roll for someone else''s character'
);

-- Nobody writes rolls directly
select throws_ok(
  $$ insert into public.rolls (campaign_id, roller_id, label, kind, dice, total)
     values (current_setting('test.campaign')::uuid, 'cccccccc-0000-4000-8000-000000000002', 'Fake', 'free', '[]', 20) $$,
  '42501', null,
  'Nobody can add a roll without throwing it'
);
select throws_ok(
  $$ update public.rolls set total = 30 where label = 'Lucky' $$,
  '42501', null,
  'Nobody can change a roll'
);

-- A secret roll, only for the DM
select public.throw_dice(current_setting('test.campaign')::uuid,
  '{"label": "Sneaky", "kind": "check", "dice": [{"sides": 20, "count": 1}], "secret": true}');
select is((select count(*)::int from public.rolls where label = 'Sneaky'), 1, 'You see your own secret roll');

-- ---------------------------------------------------------------------------------------------
-- Player 2
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}';

select is((select count(*)::int from public.rolls where label = 'Lucky'), 1, 'Another player sees your rolls');
select is((select count(*)::int from public.rolls where label = 'Sneaky'), 0, 'Another player cannot see your secret roll');
update public.campaign_members set dice_style = '{"material": "metal"}'
  where campaign_id = current_setting('test.campaign')::uuid and user_id = 'cccccccc-0000-4000-8000-000000000002';
select is(
  (select dice_style ->> 'material' from public.campaign_members
   where campaign_id = current_setting('test.campaign')::uuid and user_id = 'cccccccc-0000-4000-8000-000000000002'),
  'glass',
  'A player cannot change someone else''s dice'
);

-- ---------------------------------------------------------------------------------------------
-- Someone not at the table, and an anonymous guest
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000004", "role": "authenticated"}';

select is((select count(*)::int from public.rolls), 0, 'An outsider cannot see the rolls');
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid, '{"label": "Gatecrash", "dice": [{"sides": 20, "count": 1}]}') $$,
  '42501', null,
  'An outsider cannot roll at the table'
);

set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000005", "role": "authenticated", "is_anonymous": true}';
select throws_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid, '{"label": "Guest", "dice": [{"sides": 20, "count": 1}]}') $$,
  '42501', null,
  'An anonymous guest cannot roll'
);

-- ---------------------------------------------------------------------------------------------
-- The DM
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';

select is((select count(*)::int from public.rolls where label = 'Sneaky'), 1, 'The DM sees a player''s secret roll');
select lives_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       '{"label": "Behind the screen", "kind": "free", "dice": [{"sides": 20, "count": 1}], "secret": true}') $$,
  'The DM rolls behind the screen'
);
select lives_ok(
  $$ select public.throw_dice(current_setting('test.campaign')::uuid,
       jsonb_build_object('character_id', current_setting('test.wizard')) || '{"label": "Wisdom save", "kind": "save", "dice": [{"sides": 20, "count": 1}]}'::jsonb) $$,
  'The DM can roll for any character'
);

set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.rolls where label = 'Behind the screen'), 0, 'Players cannot see the DM''s secret roll');

-- ---------------------------------------------------------------------------------------------
-- Signed out
-- ---------------------------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.rolls $$, '42501', null, 'Signed-out visitors cannot read rolls');

reset role;
select * from finish();
rollback;
