-- Ending a fight: only the DM; the fight's miniatures go; the battle map stays up as a picture,
-- which players can still see; chances to strike close.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('cdcdcdcd-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('cdcdcdcd-0000-4000-8000-000000000002', 'player@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "cdcdcdcd-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('End test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
insert into public.assets (campaign_id, kind, category, name, path)
  values (current_setting('test.campaign')::uuid, 'art', 'maps', 'Cellar', current_setting('test.campaign') || '/cellar.webp');
select set_config('test.map', (select id::text from public.assets where name = 'Cellar'), true);

set local request.jwt.claims = '{"sub": "cdcdcdcd-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, max_hp, current_hp)
  values (current_setting('test.campaign')::uuid, 'cdcdcdcd-0000-4000-8000-000000000002', 'Thorin', 20, 20);
select set_config('test.thorin', (select id::text from public.characters), true);

set local request.jwt.claims = '{"sub": "cdcdcdcd-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.thorin')::uuid], current_setting('test.map')::uuid)), true);
select public.begin_battle(e.id) from public.encounters e where e.placing_phase and e.campaign_id in (select m.campaign_id from public.campaign_members m where m.user_id = auth.uid() and m.role = 'dm');
insert into public.combatants (encounter_id, campaign_id, kind, shown_name)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A');
insert into public.tokens (campaign_id, map_id, character_id, x, y)
  values (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, current_setting('test.thorin')::uuid, 2, 2);
insert into public.tokens (campaign_id, map_id, combatant_id, x, y)
  select current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, c.id, 3, 2
  from public.combatants c where c.kind = 'monster';

set local request.jwt.claims = '{"sub": "cdcdcdcd-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.end_fight(current_setting('test.encounter')::uuid) $$,
  '42501', 'Only the DM ends a fight',
  'Players can''t end a fight'
);

set local request.jwt.claims = '{"sub": "cdcdcdcd-0000-4000-8000-000000000001", "role": "authenticated"}';
select is((select status from public.end_fight(current_setting('test.encounter')::uuid)), 'ended', 'The DM ends the fight');
select is((select count(*)::int from public.tokens), 0, 'Every miniature in the fight leaves the map');
select is(
  (select mode || ' ' || (image_id = current_setting('test.map')::uuid)::text from public.stage),
  'scene true',
  'The battle map stays on stage, as a picture'
);
select throws_ok(
  $$ select public.end_fight(current_setting('test.encounter')::uuid) $$,
  '22023', 'That fight is over',
  'A fight ends once'
);

set local request.jwt.claims = '{"sub": "cdcdcdcd-0000-4000-8000-000000000002", "role": "authenticated"}';
select is(
  (select count(*)::int from public.assets where id = current_setting('test.map')::uuid), 1,
  'Players still see the map, now as the picture on stage'
);
select is((select current_id from public.encounters), null::uuid, 'Nobody is acting any more');

reset role;
select * from finish();
rollback;
