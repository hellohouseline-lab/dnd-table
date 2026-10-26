-- Using items in a fight: a potion heals and takes the action, one comes out of the pack; a
-- healer's kit steadies a friend at 0 and loses a use; a flask is thrown as an attack.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('1e1e1e1e-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('1e1e1e1e-0000-4000-8000-000000000002', 'fighter@example.invalid'),
  ('1e1e1e1e-0000-4000-8000-000000000003', 'friend@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "1e1e1e1e-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Item test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "1e1e1e1e-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class, inventory)
  values (current_setting('test.campaign')::uuid, '1e1e1e1e-0000-4000-8000-000000000002', 'Thorin', 'Fighter', 2, 30, 5, 18,
    '[{"id": "p", "item": "potion-of-healing-common", "name": "Potion of Healing", "quantity": 2, "weight": 0.5, "worn": false, "uses": null},
      {"id": "k", "item": "healers-kit", "name": "Healer''s Kit", "quantity": 1, "weight": 3, "worn": false, "uses": 10},
      {"id": "f", "item": "alchemists-fire-flask", "name": "Alchemist''s fire", "quantity": 1, "weight": 1, "worn": false, "uses": null}]');

set local request.jwt.claims = '{"sub": "1e1e1e1e-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '1e1e1e1e-0000-4000-8000-000000000003', 'Mira', 'Wizard', 2, 12, 12, 12);

set local request.jwt.claims = '{"sub": "1e1e1e1e-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set current_hp = 0 where name = 'Mira';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, (select array_agg(id) from public.characters), null)), true);
select set_config('test.thorin', (select c.id::text from public.combatants c join public.characters ch on ch.id = c.character_id where ch.name = 'Thorin'), true);
select set_config('test.mira', (select c.id::text from public.combatants c join public.characters ch on ch.id = c.character_id where ch.name = 'Mira'), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A', 1);
select set_config('test.goblin', (select id::text from public.combatants where kind = 'monster'), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, hp, max_hp, ac)
  values (current_setting('test.goblin')::uuid, current_setting('test.campaign')::uuid, 'Goblin A', 50, 50, 1);
update public.combatants set initiative = 20 where id = current_setting('test.thorin')::uuid;
update public.encounters set current_id = current_setting('test.thorin')::uuid, round = 1;

-- Thorin drinks a potion on his turn.
set local request.jwt.claims = '{"sub": "1e1e1e1e-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$ select public.use_item(current_setting('test.thorin')::uuid, 'p', null, null) $$,
  'A player drinks a potion on their turn'
);
select ok(
  (select current_hp between 9 and 15 from public.characters where name = 'Thorin'),
  '...and heals 2d4 + 2'
);
select is(
  (select (e ->> 'quantity')::int from public.characters, jsonb_array_elements(inventory) e where name = 'Thorin' and e ->> 'id' = 'p'),
  1, '...and one comes out of the pack'
);
select is((select action_used from public.combatants where id = current_setting('test.thorin')::uuid), true, '...and it takes the action');
select throws_ok(
  $$ select public.use_item(current_setting('test.thorin')::uuid, 'p', null, null) $$,
  '22023', 'You have used your action this turn',
  'One action a turn'
);
select throws_ok(
  $$ select public.use_item(current_setting('test.mira')::uuid, 'k', null, null) $$,
  '42501', 'It isn''t your turn',
  'Not on someone else''s turn'
);

-- The DM uses Thorin's kit on Mira, and throws his flask at the goblin.
set local request.jwt.claims = '{"sub": "1e1e1e1e-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.use_item(current_setting('test.thorin')::uuid, 'k', current_setting('test.mira')::uuid, null);
select is((select stable from public.characters where name = 'Mira'), true, 'A healer''s kit steadies a friend at 0');
select is(
  (select (e ->> 'uses')::int from public.characters, jsonb_array_elements(inventory) e where name = 'Thorin' and e ->> 'id' = 'k'),
  9, '...and uses one of its 10 uses'
);
select set_config('test.throw', public.use_item(current_setting('test.thorin')::uuid, 'f', current_setting('test.goblin')::uuid,
  '{"label": "Alchemist''s fire", "dice": [{"sides": 20, "count": 1}], "modifier": 30, "damage": {"dice": [{"sides": 4, "count": 1}], "modifier": 0, "type": "fire"}}')::text, true);
select is(
  (select shown ->> 'item' from public.combat_events where id = (current_setting('test.throw')::jsonb -> 'event' ->> 'id')::uuid),
  'Alchemist''s fire', 'A thrown flask is an attack, named in the feed'
);
select is(
  (select count(*)::int from public.characters, jsonb_array_elements(inventory) e where name = 'Thorin' and e ->> 'id' = 'f'),
  0, '...and the last one is gone from the pack'
);

reset role;
select * from finish();
rollback;
