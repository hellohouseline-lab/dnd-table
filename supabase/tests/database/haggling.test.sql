-- Haggling: a player offers their own price, the DM agrees, says no or counters, and the player
-- takes the counter-price or leaves it. Buying at the shop's price still works.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('2e2e2e2e-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('2e2e2e2e-0000-4000-8000-000000000002', 'wren@example.invalid'),
  ('2e2e2e2e-0000-4000-8000-000000000003', 'mira@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Haggle test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Jo');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class, wallet)
  values (current_setting('test.campaign')::uuid, '2e2e2e2e-0000-4000-8000-000000000002', 'Wren', 'Bard', 2, 14, 14, 13,
    '{"cp": 0, "sp": 0, "ep": 0, "gp": 20, "pp": 0}');
select set_config('test.wren', (select id::text from public.characters where name = 'Wren'), true);
set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');

set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000001", "role": "authenticated"}';
insert into public.shops (campaign_id, name, kind, open, stock) values (current_setting('test.campaign')::uuid,
  'Harl''s Forge', 'blacksmith', true,
  '[{"id": "s", "item": "longsword", "name": "Longsword", "cost": 1500, "price": null, "quantity": 2, "bundle": 1, "weight": 3},
    {"id": "r", "item": "rope-hempen-50-feet", "name": "Rope, hempen (50 feet)", "cost": 100, "price": null, "quantity": null, "bundle": 1, "weight": 10}]');
select set_config('test.shop', (select id::text from public.shops), true);

-- Buying at the shop's price still works.
set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.buy_item(current_setting('test.shop')::uuid, 'r', 1, current_setting('test.wren')::uuid, null);
select is((select (wallet ->> 'gp')::int from public.characters where name = 'Wren'), 19, 'Rope at the shop''s price');

-- Wren offers 10 gp for a 15 gp longsword.
select set_config('test.h1', (select id::text from public.haggle(current_setting('test.shop')::uuid, 's', 1,
  current_setting('test.wren')::uuid, 1000, true)), true);
select is((select asking from public.haggles where id = current_setting('test.h1')::uuid), 1500, 'The haggle knows the asking price');

set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.haggles), 0, 'Other players don''t see it');
select throws_ok(
  $$ select public.answer_haggle(current_setting('test.h1')::uuid, true, null) $$,
  '42501', 'Only the DM can answer', 'Only the DM answers'
);

-- The DM agrees.
set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.answer_haggle(current_setting('test.h1')::uuid, true, null);
select is((select (wallet ->> 'gp')::int from public.characters where name = 'Wren'), 9, 'Agreed: Wren pays 10 gp');
select is(
  (select (a ->> 'proficient')::boolean from public.characters, jsonb_array_elements(attacks) a where name = 'Wren' and a ->> 'weapon' = 'longsword'),
  true, '...and the longsword joins her hand'
);
select is((select (e ->> 'quantity')::int from public.shops, jsonb_array_elements(stock) e where e ->> 'id' = 's'), 1, '...and one is left');
select throws_ok(
  $$ select public.answer_haggle(current_setting('test.h1')::uuid, false, null) $$,
  '22023', 'That offer has been answered', 'Answered once'
);

-- She tries again for the other one at 2 gp; the DM counters at 8 gp; she takes it.
set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000002", "role": "authenticated"}';
select set_config('test.h2', (select id::text from public.haggle(current_setting('test.shop')::uuid, 's', 1,
  current_setting('test.wren')::uuid, 200, true)), true);
set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.answer_haggle(current_setting('test.h2')::uuid, false, 800);
select is((select status from public.haggles where id = current_setting('test.h2')::uuid), 'countered', 'The DM names 8 gp');
set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.take_counter(current_setting('test.h2')::uuid, true);
select is((select (wallet ->> 'gp')::int from public.characters where name = 'Wren'), 1, 'Wren takes it at 8 gp');

-- A refusal costs nothing.
select set_config('test.h3', (select id::text from public.haggle(current_setting('test.shop')::uuid, 'r', 1,
  current_setting('test.wren')::uuid, 10, null)), true);
set local request.jwt.claims = '{"sub": "2e2e2e2e-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.answer_haggle(current_setting('test.h3')::uuid, false, null);
select is((select status from public.haggles where id = current_setting('test.h3')::uuid), 'refused', 'The DM says no');
select is((select (wallet ->> 'gp')::int from public.characters where name = 'Wren'), 1, '...and nothing changes hands');

select * from finish();
rollback;
