-- Giving: coins paid with change, the DM giving and taking and sharing out, the party stash
-- getting what won't share, and players handing things to each other outside a fight.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Paying, as src/rules/money.test.ts.
select is(private.pay('{"gp": 1}', 30), '{"cp": 0, "sp": 7, "ep": 0, "gp": 0, "pp": 0}'::jsonb, '3 sp from a gold piece: 7 sp change');
select is(private.pay('{"gp": 1, "sp": 5, "cp": 8}', 45), '{"cp": 3, "sp": 1, "ep": 0, "gp": 1, "pp": 0}'::jsonb, 'Copper and silver go first');
select is(private.pay('{"sp": 3, "cp": 5}', 33), '{"cp": 2, "sp": 0, "ep": 0, "gp": 0, "pp": 0}'::jsonb, 'The last silver is broken');
select is(private.pay('{"gp": 1}', 101), null, 'Not enough is null');

insert into auth.users (id, email) values
  ('9a9a9a9a-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('9a9a9a9a-0000-4000-8000-000000000002', 'thorin@example.invalid'),
  ('9a9a9a9a-0000-4000-8000-000000000003', 'mira@example.invalid'),
  ('9a9a9a9a-0000-4000-8000-000000000004', 'wren@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "9a9a9a9a-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Giving test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "9a9a9a9a-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class, wallet, inventory)
  values (current_setting('test.campaign')::uuid, '9a9a9a9a-0000-4000-8000-000000000002', 'Thorin', 'Fighter', 2, 20, 20, 18,
    '{"cp": 0, "sp": 0, "ep": 0, "gp": 10, "pp": 0}',
    '[{"id": "m", "item": "chain-mail", "name": "Chain Mail", "quantity": 1, "weight": 55, "worn": true, "uses": null}]');

set local request.jwt.claims = '{"sub": "9a9a9a9a-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '9a9a9a9a-0000-4000-8000-000000000003', 'Mira', 'Wizard', 2, 12, 12, 12);

set local request.jwt.claims = '{"sub": "9a9a9a9a-0000-4000-8000-000000000004", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Jo');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '9a9a9a9a-0000-4000-8000-000000000004', 'Wren', 'Bard', 2, 14, 14, 13);

select set_config('test.thorin', (select id::text from public.characters where name = 'Thorin'), true);
select set_config('test.mira', (select id::text from public.characters where name = 'Mira'), true);
select set_config('test.wren', (select id::text from public.characters where name = 'Wren'), true);

-- A player can't give things out of nowhere.
select throws_ok(
  $$ select public.give_items(current_setting('test.wren')::uuid, '[{"name": "Gold crown"}]', null, 0) $$,
  '42501', 'Only the DM can give things', 'Players can''t give themselves things'
);

-- The DM gives Thorin a Longsword +1, two potions and 5 gp.
set local request.jwt.claims = '{"sub": "9a9a9a9a-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.give_items(current_setting('test.thorin')::uuid,
  '[{"item": "longsword", "name": "Longsword +1", "quantity": 1, "weight": 3, "magic": "weapon-1", "bonus": 1},
    {"item": "potion-of-healing-common", "name": "Potion of Healing", "quantity": 2, "weight": 0.5, "magic": "potion-of-healing-common"}]',
  '{"longsword": true}', 500);
select is(
  (select e ->> 'name' from public.characters, jsonb_array_elements(inventory) e where name = 'Thorin' and e ->> 'item' = 'longsword'),
  'Longsword +1', 'The DM gives a Longsword +1'
);
select is(
  (select a -> 'magicBonus' from public.characters, jsonb_array_elements(attacks) a where name = 'Thorin' and a ->> 'weapon' = 'longsword'),
  '1'::jsonb, '...and it joins the hand with its +1'
);
select is((select (wallet ->> 'gp')::int from public.characters where name = 'Thorin'), 15, '...with 5 gp');
select is(
  (select text from public.log_events where kind = 'gift' order by created_at desc limit 1),
  'Thorin got Longsword +1, 2 × Potion of Healing and 5 gp', '...and the log says so'
);
select public.give_items(current_setting('test.thorin')::uuid,
  '[{"item": "potion-of-healing-common", "name": "Potion of Healing", "quantity": 1, "magic": "potion-of-healing-common"}]', null, 0);
select is(
  (select (e ->> 'quantity')::int from public.characters, jsonb_array_elements(inventory) e where name = 'Thorin' and e ->> 'name' = 'Potion of Healing'),
  3, 'Another potion joins the ones already carried'
);

-- Taking and sharing coins.
select public.take_coins(current_setting('test.thorin')::uuid, 250);
select is((select wallet from public.characters where name = 'Thorin'),
  '{"cp": 0, "sp": 5, "ep": 0, "gp": 12, "pp": 0}'::jsonb, 'Taking 2 gp 5 sp makes change');
select throws_ok(
  $$ select public.take_coins(current_setting('test.mira')::uuid, 100) $$,
  '22023', 'Mira only has no coins', 'Can''t take what isn''t there'
);
select is(
  public.split_coins(current_setting('test.campaign')::uuid,
    array[current_setting('test.thorin')::uuid, current_setting('test.mira')::uuid, current_setting('test.wren')::uuid], 1000),
  333, '10 gp shared by three is 3 gp 3 sp 3 cp each'
);
select is((select wallet from public.characters where name = 'Mira'),
  '{"cp": 3, "sp": 3, "ep": 0, "gp": 3, "pp": 0}'::jsonb, '...in Mira''s purse');
select is((select (wallet ->> 'cp')::int from public.party_stash), 1, '...and the odd copper goes to the party stash');

-- Players hand things over.
set local request.jwt.claims = '{"sub": "9a9a9a9a-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.hand_over(current_setting('test.thorin')::uuid, current_setting('test.mira')::uuid,
  (select e ->> 'id' from public.characters, jsonb_array_elements(inventory) e where name = 'Thorin' and e ->> 'item' = 'longsword'),
  1, '{"gp": 2}', false);
select is(
  (select count(*)::int from public.characters, jsonb_array_elements(inventory) e where name = 'Mira' and e ->> 'name' = 'Longsword +1'),
  1, 'Thorin hands Mira his Longsword +1'
);
select is(
  (select count(*)::int from public.characters, jsonb_array_elements(attacks) a where name = 'Thorin' and a ->> 'weapon' = 'longsword'),
  0, '...and it leaves his hand of cards'
);
select is(
  (select (a ->> 'proficient')::boolean from public.characters, jsonb_array_elements(attacks) a where name = 'Mira' and a ->> 'weapon' = 'longsword'),
  false, '...and joins hers, untrained'
);
select is((select (wallet ->> 'gp')::int from public.characters where name = 'Mira'), 5, '...with 2 gp');
select throws_ok(
  $$ select public.hand_over(current_setting('test.thorin')::uuid, current_setting('test.mira')::uuid, 'm', 1, null, null) $$,
  '22023', 'Take it off first', 'Worn armour comes off first'
);
select throws_ok(
  $$ select public.hand_over(current_setting('test.mira')::uuid, current_setting('test.thorin')::uuid, null, 0, '{"gp": 1}', null) $$,
  '42501', 'You can only hand over your own things', 'Nobody hands over someone else''s things'
);
select throws_ok(
  $$ select public.hand_over(current_setting('test.thorin')::uuid, current_setting('test.mira')::uuid, null, 0, '{"pp": 1}', null) $$,
  '22023', 'You don''t have those coins', 'Only coins you have'
);

-- Not in a fight.
set local request.jwt.claims = '{"sub": "9a9a9a9a-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.start_fight(current_setting('test.campaign')::uuid, (select array_agg(id) from public.characters), null);
select public.begin_battle(e.id) from public.encounters e where e.placing_phase and e.campaign_id in (select m.campaign_id from public.campaign_members m where m.user_id = auth.uid() and m.role = 'dm');
set local request.jwt.claims = '{"sub": "9a9a9a9a-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.hand_over(current_setting('test.thorin')::uuid, current_setting('test.mira')::uuid, null, 0, '{"gp": 1}', null) $$,
  '22023', 'Hand things over when the fight is over', 'Not in a fight'
);

select * from finish();
rollback;
