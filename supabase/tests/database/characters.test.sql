-- Who can see and change character sheets and portraits.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- A DM, two players and an outsider who all signed in with email, plus an anonymous guest.
insert into auth.users (id, email) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'player1@example.invalid'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'player2@example.invalid'),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'outsider@example.invalid'),
  ('bbbbbbbb-0000-4000-8000-000000000005', null);

set local role authenticated;

-- The DM starts a campaign and both players join.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Sheets test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');

-- ---------------------------------------------------------------------------------------------
-- Player 1 makes their character
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.characters (campaign_id, owner_id, name, race, class, level, strength, max_hp, current_hp,
       save_proficiencies, skill_proficiencies)
     values (current_setting('test.campaign')::uuid, 'bbbbbbbb-0000-4000-8000-000000000002', 'Dwarf Fighter',
       'Dwarf', 'Fighter', 2, 16, 20, 17, '{strength,constitution}', '{athletics,perception}') $$,
  'A player makes their own character'
);
select set_config('test.character', (select id::text from public.characters where name = 'Dwarf Fighter'), true);

select throws_ok(
  $$ insert into public.characters (campaign_id, owner_id, name)
     values (current_setting('test.campaign')::uuid, 'bbbbbbbb-0000-4000-8000-000000000002', 'A second one') $$,
  '23505', null,
  'A player has one character per campaign'
);
select throws_ok(
  $$ insert into public.characters (campaign_id, owner_id, name)
     values (current_setting('test.campaign')::uuid, 'bbbbbbbb-0000-4000-8000-000000000003', 'For Alex') $$,
  '42501', null,
  'A player cannot make a character for someone else'
);

update public.characters set current_hp = 12 where id = current_setting('test.character')::uuid;
select is(
  (select current_hp from public.characters where id = current_setting('test.character')::uuid), 12::smallint,
  'A player can change their own hit points'
);
select throws_ok(
  $$ update public.characters set owner_id = 'bbbbbbbb-0000-4000-8000-000000000003'
     where id = current_setting('test.character')::uuid $$,
  '42501', null,
  'A player cannot give their character to someone else'
);
select throws_ok(
  $$ update public.characters set current_hp = 25 where id = current_setting('test.character')::uuid $$,
  '23514', null,
  'Hit points cannot go above the maximum'
);
select throws_ok(
  $$ update public.characters set skill_proficiencies = '{athletics,cooking}' where id = current_setting('test.character')::uuid $$,
  '23514', null,
  'Only real skills can be proficiencies'
);
select throws_ok(
  $$ update public.characters set skill_expertise = '{stealth}' where id = current_setting('test.character')::uuid $$,
  '23514', null,
  'Expertise needs proficiency in that skill'
);
select throws_ok(
  $$ update public.characters set conditions = '{sleepy}' where id = current_setting('test.character')::uuid $$,
  '23514', null,
  'Only real conditions can be applied'
);
select ok(
  private.can_change_portrait(current_setting('test.campaign') || '/' || current_setting('test.character') || '/1.webp'),
  'A player can upload their own portrait'
);

-- ---------------------------------------------------------------------------------------------
-- Player 2 at the same table
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000003", "role": "authenticated"}';

select is((select count(*)::int from public.characters), 1, 'Another player at the table can see the character');
update public.characters set current_hp = 1 where id = current_setting('test.character')::uuid;
delete from public.characters where id = current_setting('test.character')::uuid;
select is(
  (select current_hp from public.characters where id = current_setting('test.character')::uuid), 12::smallint,
  'Another player cannot change or delete someone else''s character'
);
select ok(
  private.can_see_portrait(current_setting('test.campaign') || '/' || current_setting('test.character') || '/1.webp'),
  'Another player at the table can see the portrait'
);
select ok(
  not private.can_change_portrait(current_setting('test.campaign') || '/' || current_setting('test.character') || '/1.webp'),
  'Another player cannot replace someone else''s portrait'
);

-- ---------------------------------------------------------------------------------------------
-- Someone not at the table, and an anonymous guest
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000004", "role": "authenticated"}';

select is((select count(*)::int from public.characters), 0, 'An outsider cannot see the party');
select throws_ok(
  $$ insert into public.characters (campaign_id, owner_id, name)
     values (current_setting('test.campaign')::uuid, 'bbbbbbbb-0000-4000-8000-000000000004', 'Gatecrasher') $$,
  '42501', null,
  'An outsider cannot add a character to the table'
);
select ok(
  not private.can_see_portrait(current_setting('test.campaign') || '/' || current_setting('test.character') || '/1.webp'),
  'An outsider cannot see the portraits'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000005", "role": "authenticated", "is_anonymous": true}';
select is((select count(*)::int from public.characters), 0, 'An anonymous guest cannot see the party');

-- ---------------------------------------------------------------------------------------------
-- The DM
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001", "role": "authenticated"}';

update public.characters set current_hp = 5 where id = current_setting('test.character')::uuid;
select is(
  (select current_hp from public.characters where id = current_setting('test.character')::uuid), 5::smallint,
  'The DM can change any character'
);
select lives_ok(
  $$ insert into public.characters (campaign_id, owner_id, name)
     values (current_setting('test.campaign')::uuid, 'bbbbbbbb-0000-4000-8000-000000000003', 'Elf Wizard') $$,
  'The DM can make a character for a player'
);
select throws_ok(
  $$ insert into public.characters (campaign_id, owner_id, name)
     values (current_setting('test.campaign')::uuid, 'bbbbbbbb-0000-4000-8000-000000000004', 'Not at the table') $$,
  '42501', null,
  'Even the DM cannot give a character to someone not at the table'
);
select ok(
  private.can_change_portrait(current_setting('test.campaign') || '/' || current_setting('test.character') || '/1.webp'),
  'The DM can change any portrait'
);
delete from public.characters where name = 'Elf Wizard';
select is((select count(*)::int from public.characters), 1, 'The DM can delete a character');

-- ---------------------------------------------------------------------------------------------
-- Signed out
-- ---------------------------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.characters $$, '42501', null, 'Signed-out visitors cannot read characters');

reset role;
select * from finish();
rollback;
