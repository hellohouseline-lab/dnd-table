-- Shops: players see only open ones (and never the DM's note), buy with change made, sell back for
-- half the book price, and the DM can undo a sale.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('3d3d3d3d-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('3d3d3d3d-0000-4000-8000-000000000002', 'wren@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "3d3d3d3d-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Shop test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "3d3d3d3d-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Jo');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class, wallet, inventory)
  values (current_setting('test.campaign')::uuid, '3d3d3d3d-0000-4000-8000-000000000002', 'Wren', 'Bard', 2, 14, 14, 13,
    '{"cp": 0, "sp": 0, "ep": 0, "gp": 3, "pp": 0}',
    '[{"id": "d", "item": "dagger", "name": "Dagger", "quantity": 1, "weight": 1, "worn": false, "uses": null},
      {"id": "l", "item": "leather-armor", "name": "Leather Armour", "quantity": 1, "weight": 10, "worn": true, "uses": null}]');
select set_config('test.wren', (select id::text from public.characters where name = 'Wren'), true);

select is((select cost from public.srd_prices where index = 'rope-hempen-50-feet'), 100, 'The price list has the book prices');
select is((select bundle from public.srd_prices where index = 'arrow'), 20, '...and arrows come twenty to a bundle');

-- The DM makes a shop, closed for now, with a note only they see.
set local request.jwt.claims = '{"sub": "3d3d3d3d-0000-4000-8000-000000000001", "role": "authenticated"}';
insert into public.shops (campaign_id, name, keeper, kind, markup, stock) values (current_setting('test.campaign')::uuid,
  'Brenna''s Goods', 'Brenna', 'general', 125,
  '[{"id": "r", "item": "rope-hempen-50-feet", "name": "Rope, hempen (50 feet)", "cost": 100, "price": null, "quantity": 2, "bundle": 1, "weight": 10},
    {"id": "a", "item": "arrow", "name": "Arrow (20)", "cost": 100, "price": null, "quantity": null, "bundle": 20, "weight": 0.05},
    {"id": "c", "item": "cloak-of-protection", "magic": "cloak-of-protection", "name": "Cloak of Protection", "cost": 0, "price": null, "quantity": 1, "bundle": 1, "weight": 0, "attune": true}]');
select set_config('test.shop', (select id::text from public.shops), true);
insert into public.shop_notes (shop_id, campaign_id, note)
  values (current_setting('test.shop')::uuid, current_setting('test.campaign')::uuid, 'Never stops talking about her son.');

set local request.jwt.claims = '{"sub": "3d3d3d3d-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.shops), 0, 'Players don''t see a closed shop');
select throws_ok(
  $$ select public.buy_item(current_setting('test.shop')::uuid, 'r', 1, current_setting('test.wren')::uuid, null) $$,
  '22023', 'The shop is closed', 'Nobody buys from a closed shop'
);

set local request.jwt.claims = '{"sub": "3d3d3d3d-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.shops set open = true;

set local request.jwt.claims = '{"sub": "3d3d3d3d-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.shops), 1, 'Players see it once it''s open');
select is((select count(*)::int from public.shop_notes), 0, '...but never the DM''s note');
update public.shops set markup = 25;
select is((select markup from public.shops), 125, 'Players can''t change prices');

-- Buying.
select set_config('test.sale', (select id::text from public.buy_item(current_setting('test.shop')::uuid, 'r', 1, current_setting('test.wren')::uuid, null)), true);
select is((select wallet from public.characters where name = 'Wren'),
  '{"cp": 5, "sp": 7, "ep": 0, "gp": 1, "pp": 0}'::jsonb, 'Rope at 125% costs 1 gp 2 sp 5 cp, with change');
select is(
  (select e ->> 'name' from public.characters, jsonb_array_elements(inventory) e where name = 'Wren' and e ->> 'item' = 'rope-hempen-50-feet'),
  'Rope, hempen (50 feet)', '...and the rope is in the pack'
);
select is((select (e ->> 'quantity')::int from public.shops, jsonb_array_elements(stock) e where e ->> 'id' = 'r'), 1, '...and one is left on the shelf');
select public.buy_item(current_setting('test.shop')::uuid, 'a', 1, current_setting('test.wren')::uuid, null);
select is(
  (select (e ->> 'quantity')::int from public.characters, jsonb_array_elements(inventory) e where name = 'Wren' and e ->> 'item' = 'arrow'),
  20, 'A bundle of arrows is twenty arrows'
);
select throws_ok(
  $$ select public.buy_item(current_setting('test.shop')::uuid, 'c', 1, current_setting('test.wren')::uuid, null) $$,
  '22023', 'That isn''t for sale yet', 'A magic item needs a price first'
);
select throws_ok(
  $$ select public.buy_item(current_setting('test.shop')::uuid, 'r', 1, current_setting('test.wren')::uuid, null) $$,
  '22023', 'That costs 1 gp 2 sp 5 cp, and you have 5 sp', 'Not enough coins'
);

-- Selling.
select public.sell_item(current_setting('test.shop')::uuid, current_setting('test.wren')::uuid, 'd', 1);
select is((select (wallet ->> 'gp')::int from public.characters where name = 'Wren'), 1, 'A dagger sells for half its 2 gp');
select is(
  (select e ->> 'name' from public.shops, jsonb_array_elements(stock) e where e ->> 'item' = 'dagger'),
  'Dagger', '...and goes on the shelf'
);
select throws_ok(
  $$ select public.sell_item(current_setting('test.shop')::uuid, current_setting('test.wren')::uuid, 'l', 1) $$,
  '22023', 'Take it off first', 'Worn armour comes off first'
);

-- Undoing.
select throws_ok(
  $$ select public.undo_sale(current_setting('test.sale')::uuid) $$,
  '42501', 'Only the DM can undo a sale', 'Players can''t undo'
);
set local request.jwt.claims = '{"sub": "3d3d3d3d-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.undo_sale(current_setting('test.sale')::uuid);
select is(
  (select count(*)::int from public.characters, jsonb_array_elements(inventory) e where name = 'Wren' and e ->> 'item' = 'rope-hempen-50-feet'),
  0, 'Undo takes the rope back'
);
select is((select (e ->> 'quantity')::int from public.shops, jsonb_array_elements(stock) e where e ->> 'id' = 'r'), 2, '...onto the shelf');
select is((select wallet ->> 'gp' from public.characters where name = 'Wren'), '2', '...and the coins come back');

select public.set_shop_open(current_setting('test.shop')::uuid, false);
set local request.jwt.claims = '{"sub": "3d3d3d3d-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.shops), 0, 'Closing the shop hides it again');
select throws_ok(
  $$ select public.set_shop_open(current_setting('test.shop')::uuid, true) $$,
  '42501', 'Only the DM opens and closes shops', 'Players can''t open it'
);

select * from finish();
rollback;
