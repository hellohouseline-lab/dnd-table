-- Bonus attacks: a monk's unarmed strike and Flurry of Blows come after attacking; Flurry is two
-- strikes for one bonus action; only monks have them; a berserker's frenzy needs a rage.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('b0b0b0b0-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('b0b0b0b0-0000-4000-8000-000000000002', 'monk@example.invalid'),
  ('b0b0b0b0-0000-4000-8000-000000000003', 'barbarian@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "b0b0b0b0-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Bonus test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "b0b0b0b0-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'b0b0b0b0-0000-4000-8000-000000000002', 'Kai', 'Monk', 2, 15, 15, 15);

set local request.jwt.claims = '{"sub": "b0b0b0b0-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'b0b0b0b0-0000-4000-8000-000000000003', 'Yenn', 'Barbarian', 3, 30, 30, 13);

set local request.jwt.claims = '{"sub": "b0b0b0b0-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, (select array_agg(id) from public.characters), null)), true);
select set_config('test.kai', (select c.id::text from public.combatants c join public.characters ch on ch.id = c.character_id where ch.name = 'Kai'), true);
select set_config('test.yenn', (select c.id::text from public.combatants c join public.characters ch on ch.id = c.character_id where ch.name = 'Yenn'), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Ogre', 1);
select set_config('test.ogre', (select id::text from public.combatants where kind = 'monster'), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, hp, max_hp, ac)
  values (current_setting('test.ogre')::uuid, current_setting('test.campaign')::uuid, 'Ogre', 200, 200, 11);
update public.combatants set initiative = 20 where id = current_setting('test.kai')::uuid;
update public.combatants set initiative = 10 where id = current_setting('test.yenn')::uuid;
update public.encounters set current_id = current_setting('test.kai')::uuid, round = 1;

select set_config('test.punch', '{"label": "Unarmed strike", "dice": [{"sides": 20, "count": 1}], "modifier": 5, "damage": {"dice": [{"sides": 4, "count": 1}], "modifier": 3, "type": "bludgeoning"}}', true);

set local request.jwt.claims = '{"sub": "b0b0b0b0-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.bonus_attack(current_setting('test.kai')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb, 'martialArts') $$,
  '22023', 'Attack with your action first',
  'A monk''s bonus strike comes after attacking'
);
select public.resolve_attack(current_setting('test.kai')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb);
select lives_ok(
  $$ select public.bonus_attack(current_setting('test.kai')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb, 'flurry') $$,
  'Flurry of Blows: the first strike'
);
select is(
  (select (bonus_used, attacks_made) from public.combatants where id = current_setting('test.kai')::uuid),
  (true, 1::smallint), '...spends the bonus action, not the action'
);
select lives_ok(
  $$ select public.bonus_attack(current_setting('test.kai')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb, 'flurry') $$,
  '...and the second strike'
);
select throws_ok(
  $$ select public.bonus_attack(current_setting('test.kai')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb, 'flurry') $$,
  '22023', 'Flurry of Blows is two strikes',
  '...but not a third'
);
select throws_ok(
  $$ select public.bonus_attack(current_setting('test.kai')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb, 'martialArts') $$,
  '22023', 'You have used your bonus action this turn',
  'One bonus action a turn'
);
select is(
  (select count(*)::int from public.combat_events where actor_id = current_setting('test.kai')::uuid and shown ->> 'bonusAttack' = 'flurry'),
  2, 'The feed says which bonus attack it was'
);

-- Yenn's turn.
select public.end_turn(current_setting('test.encounter')::uuid);
set local request.jwt.claims = '{"sub": "b0b0b0b0-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$ select public.bonus_attack(current_setting('test.yenn')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb, 'martialArts') $$,
  '22023', 'Only a monk can do that',
  'Only monks make Martial Arts strikes'
);
select throws_ok(
  $$ select public.bonus_attack(current_setting('test.yenn')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb, 'frenzy') $$,
  '22023', 'You need to be raging to attack in a frenzy',
  'A frenzy needs a rage'
);
update public.characters set effects = '[{"key": "rage", "name": "Raging", "roundsLeft": 9}]'
where id = (select character_id from public.combatants where id = current_setting('test.yenn')::uuid);
select lives_ok(
  $$ select public.bonus_attack(current_setting('test.yenn')::uuid, current_setting('test.ogre')::uuid, current_setting('test.punch')::jsonb, 'frenzy') $$,
  'Raging, a frenzy attack needs no attack first'
);
select is(
  (select (bonus_used, attacks_made) from public.combatants where id = current_setting('test.yenn')::uuid),
  (true, 0::smallint), '...and leaves the action free'
);

reset role;
select * from finish();
rollback;
