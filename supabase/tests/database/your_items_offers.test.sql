-- Your items are the DM's alone; gifts keep their note; the DM offers coins for something and the
-- player sells or says no.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('7b7b7b7b-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('7b7b7b7b-0000-4000-8000-000000000002', 'wren@example.invalid'),
  ('7b7b7b7b-0000-4000-8000-000000000003', 'mira@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Offers test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Jo');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class, inventory, attacks)
  values (current_setting('test.campaign')::uuid, '7b7b7b7b-0000-4000-8000-000000000002', 'Wren', 'Bard', 2, 14, 14, 13,
    '[{"id": "d", "item": "dagger", "name": "Dagger", "quantity": 2, "weight": 1, "worn": false, "uses": null}]',
    '[{"id": "weapon-dagger", "name": "Dagger", "weapon": "dagger", "proficient": true, "magicBonus": 0, "ability": "strength", "damageDice": "", "damageType": ""}]');
set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
select set_config('test.wren', (select id::text from public.characters where name = 'Wren'), true);

-- The DM makes a key item; players can't see it or make their own.
set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000001", "role": "authenticated"}';
insert into public.dm_items (campaign_id, name, description, type, key)
  values (current_setting('test.campaign')::uuid, 'The Raven Seal', 'Black wax, stamped with a raven.', 'other', true);
select is((select count(*)::int from public.dm_items), 1, 'The DM makes an item of their own');

set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.dm_items), 0, 'Players can''t see the DM''s items');
select throws_ok(
  $$ insert into public.dm_items (campaign_id, name) values (current_setting('test.campaign')::uuid, 'Free sword') $$,
  '42501', null, 'Players can''t make them'
);

-- Given, it keeps its description.
set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.give_items(current_setting('test.wren')::uuid,
  '[{"name": "The Raven Seal", "quantity": 1, "note": "Black wax, stamped with a raven."}]', null, 0);
select is(
  (select e ->> 'note' from public.characters, jsonb_array_elements(inventory) e where name = 'Wren' and e ->> 'name' = 'The Raven Seal'),
  'Black wax, stamped with a raven.', 'A gift keeps what it is'
);

-- Offers.
select set_config('test.offer', (select id::text from public.make_offer(current_setting('test.wren')::uuid, 'd', 1, 200)), true);
select is((select status from public.offers where id = current_setting('test.offer')::uuid), 'open', 'The DM offers 2 gp for a dagger');

set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.offers), 0, 'Other players don''t see it');
select throws_ok(
  $$ select public.answer_offer(current_setting('test.offer')::uuid, true) $$,
  '42501', 'Only the player can answer an offer for their things', 'Nobody else can answer it'
);

set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.offers), 1, 'Wren sees the offer');
select public.answer_offer(current_setting('test.offer')::uuid, true);
select is(
  (select (e ->> 'quantity')::int from public.characters, jsonb_array_elements(inventory) e where name = 'Wren' and e ->> 'id' = 'd'),
  1, 'Selling one dagger leaves one'
);
select is((select (wallet ->> 'gp')::int from public.characters where name = 'Wren'), 2, '...and 2 gp arrive');
select is((select jsonb_array_length(attacks) from public.characters where name = 'Wren'), 1, '...and the other dagger stays in the hand');
select throws_ok(
  $$ select public.answer_offer(current_setting('test.offer')::uuid, true) $$,
  '22023', 'That offer has gone', 'An offer is answered once'
);

set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.offer2', (select id::text from public.make_offer(current_setting('test.wren')::uuid, 'd', 1, 100)), true);
set local request.jwt.claims = '{"sub": "7b7b7b7b-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.answer_offer(current_setting('test.offer2')::uuid, false);
select is((select status from public.offers where id = current_setting('test.offer2')::uuid), 'declined', 'No thanks keeps the dagger');

select * from finish();
rollback;
