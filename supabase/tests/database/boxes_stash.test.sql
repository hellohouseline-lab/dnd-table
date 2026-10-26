-- The party stash: the DM puts a box's finds on the table, players take what they want for
-- themselves, and anyone can split the coins; the DM's box numbers stay in the DM's notebook.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('5c5c5c5c-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('5c5c5c5c-0000-4000-8000-000000000002', 'wren@example.invalid'),
  ('5c5c5c5c-0000-4000-8000-000000000003', 'mira@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "5c5c5c5c-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Stash test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "5c5c5c5c-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Jo');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '5c5c5c5c-0000-4000-8000-000000000002', 'Wren', 'Bard', 2, 14, 14, 13);
set local request.jwt.claims = '{"sub": "5c5c5c5c-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '5c5c5c5c-0000-4000-8000-000000000003', 'Mira', 'Wizard', 2, 12, 12, 12);
select set_config('test.wren', (select id::text from public.characters where name = 'Wren'), true);
select set_config('test.mira', (select id::text from public.characters where name = 'Mira'), true);

select throws_ok(
  $$ select public.put_on_table(current_setting('test.campaign')::uuid, '[{"name": "Gold crown"}]', 0) $$,
  '42501', 'Only the DM can put things on the table', 'Players can''t fill the stash'
);

set local request.jwt.claims = '{"sub": "5c5c5c5c-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.put_on_table(current_setting('test.campaign')::uuid,
  '[{"item": "dagger", "name": "Dagger", "quantity": 2, "weight": 1},
    {"name": "Bent spoon", "quantity": 1, "note": "Pewter, bent nearly in half."}]', 1001);
select is((select jsonb_array_length(items) from public.party_stash), 2, 'The DM puts a box''s finds on the table');
select is((select wallet ->> 'gp' from public.party_stash), '10', '...and its coins');
select ok(
  (select data -> 'to' ? current_setting('test.wren') from public.log_events where kind = 'gift' order by created_at desc limit 1),
  '...and everyone hears about it'
);
insert into public.dm_notebooks (campaign_id, box_settings) values (current_setting('test.campaign')::uuid, '{"junk": {"bits": [1, 2]}}');
select is(
  (select box_settings -> 'junk' -> 'bits' from public.dm_notebooks where campaign_id = current_setting('test.campaign')::uuid),
  '[1, 2]'::jsonb, 'The DM keeps their own box numbers'
);

set local request.jwt.claims = '{"sub": "5c5c5c5c-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select jsonb_array_length(items) from public.party_stash), 2, 'Players see the stash');
select public.take_from_stash(current_setting('test.wren')::uuid,
  (select e ->> 'id' from public.party_stash, jsonb_array_elements(items) e where e ->> 'name' = 'Dagger'), 1, true);
select is(
  (select (e ->> 'quantity')::int from public.party_stash, jsonb_array_elements(items) e where e ->> 'name' = 'Dagger'),
  1, 'Wren takes one dagger, one is left'
);
select is(
  (select count(*)::int from public.characters, jsonb_array_elements(attacks) a where name = 'Wren' and a ->> 'weapon' = 'dagger'),
  1, '...and it joins her hand'
);
select throws_ok(
  $$ select public.take_from_stash(current_setting('test.mira')::uuid,
    (select e ->> 'id' from public.party_stash, jsonb_array_elements(items) e where e ->> 'name' = 'Bent spoon'), 1, null) $$,
  '42501', 'You can only take things for your own character', 'Nobody takes things for someone else'
);

select is(public.split_stash(current_setting('test.campaign')::uuid), 500, 'Splitting 10 gp 1 cp gives 5 gp each');
select is((select wallet ->> 'cp' from public.party_stash), '1', '...and the odd copper stays');
select throws_ok(
  $$ select public.split_stash(current_setting('test.campaign')::uuid) $$,
  '22023', 'Too few coins to share', 'One copper won''t split'
);

select * from finish();
rollback;
