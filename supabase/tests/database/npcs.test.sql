-- NPCs are the DM's alone; showing one puts only their name, role and portrait on stage (and lets
-- players load that one picture). The DM takes things away from a character.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('8b8b8b8b-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('8b8b8b8b-0000-4000-8000-000000000002', 'wren@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "8b8b8b8b-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('NPC test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
insert into public.assets (campaign_id, kind, category, name, path, size_bytes)
  values (current_setting('test.campaign')::uuid, 'art', 'people', 'Brenna',
    current_setting('test.campaign') || '/brenna.webp', 1000);
select set_config('test.portrait', (select id::text from public.assets), true);
insert into public.npcs (campaign_id, name, role, portrait_id, secrets)
  values (current_setting('test.campaign')::uuid, 'Brenna', 'Innkeeper', current_setting('test.portrait')::uuid,
    'She owes the goblins money.');
insert into public.stage (campaign_id) values (current_setting('test.campaign')::uuid);
select is((select count(*)::int from public.npcs), 1, 'The DM makes a person');

set local request.jwt.claims = '{"sub": "8b8b8b8b-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Jo');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class, inventory, attacks)
  values (current_setting('test.campaign')::uuid, '8b8b8b8b-0000-4000-8000-000000000002', 'Wren', 'Bard', 2, 14, 14, 13,
    '[{"id": "d", "item": "dagger", "name": "Dagger", "quantity": 2, "weight": 1, "worn": false, "uses": null}]',
    '[{"id": "weapon-dagger", "name": "Dagger", "weapon": "dagger", "proficient": true, "magicBonus": 0, "ability": "strength", "damageDice": "", "damageType": ""}]');
select set_config('test.wren', (select id::text from public.characters where name = 'Wren'), true);
select is((select count(*)::int from public.npcs), 0, 'Players can''t read the DM''s people or their secrets');
select is((select count(*)::int from public.assets where kind = 'art'), 0, '...or see their portrait while it''s not shown');
select throws_ok(
  $$ select public.take_items(current_setting('test.wren')::uuid, 'd', 1) $$,
  '42501', 'Only the DM can take things away', 'Players can''t take things away'
);

-- The DM shows Brenna.
set local request.jwt.claims = '{"sub": "8b8b8b8b-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.stage set npc_name = 'Brenna', npc_role = 'Innkeeper', npc_image_id = current_setting('test.portrait')::uuid;
set local request.jwt.claims = '{"sub": "8b8b8b8b-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select npc_name from public.stage), 'Brenna', 'Shown, players see her name');
select is((select count(*)::int from public.assets where kind = 'art'), 1, '...and her portrait');
select is(private.can_see_art(current_setting('test.campaign') || '/brenna.webp'), true, '...and may load the picture');
select is((select count(*)::int from public.npcs), 0, '...but still not her secrets');

-- The DM takes a dagger away.
set local request.jwt.claims = '{"sub": "8b8b8b8b-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.take_items(current_setting('test.wren')::uuid, 'd', 1);
select is(
  (select (e ->> 'quantity')::int from public.characters, jsonb_array_elements(inventory) e where name = 'Wren'),
  1, 'The DM takes one dagger of two'
);
select public.take_items(current_setting('test.wren')::uuid, 'd', 1);
select is((select jsonb_array_length(attacks) from public.characters where name = 'Wren'), 0, 'The last one gone, it leaves her hand');

select * from finish();
rollback;
