-- T1, features and effects: Raging brings resistances and ends at 0 hit points; using a feature
-- spends its part of the turn and is named in the feed; Action Surge gives the action back; a
-- player can undo their own newest action but nothing else.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('efefefef-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('efefefef-0000-4000-8000-000000000002', 'barbarian@example.invalid'),
  ('efefefef-0000-4000-8000-000000000003', 'other@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Rage test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'efefefef-0000-4000-8000-000000000002', 'Yenn', 'Barbarian', 3, 30, 30, 10);
select set_config('test.yenn_char', (select id::text from public.characters), true);

set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');

set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.yenn_char')::uuid], null)), true);
select set_config('test.yenn', (select id::text from public.combatants where kind = 'character'), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A', 5);
select set_config('test.goblin', (select id::text from public.combatants where kind = 'monster'), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, hp, max_hp, ac)
  values (current_setting('test.goblin')::uuid, current_setting('test.campaign')::uuid, 'Goblin A', 7, 7, 15);
update public.combatants set initiative = 15 where id = current_setting('test.yenn')::uuid;
update public.encounters set current_id = current_setting('test.yenn')::uuid, round = 1;

-- Yenn rages.
set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$ update public.characters set effects = '[{"key": "rage", "name": "Raging", "resistances": ["bludgeoning", "piercing", "slashing"], "endsWhenDown": true}]' where id = current_setting('test.yenn_char')::uuid $$,
  'A player marks their character as Raging'
);
set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000003", "role": "authenticated"}';
update public.characters set effects = '[]' where id = current_setting('test.yenn_char')::uuid;
select is(
  (select jsonb_array_length(effects) from public.characters where id = current_setting('test.yenn_char')::uuid), 1,
  '...and nobody else can take it off'
);

set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.hit', public.resolve_attack(current_setting('test.goblin')::uuid, current_setting('test.yenn')::uuid,
  '{"label": "Goblin A: Scimitar", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 10, "type": "slashing"}}'
)::text, true);
select is(
  (select current_hp::int from public.characters where id = current_setting('test.yenn_char')::uuid),
  case when (current_setting('test.hit')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean then 25 else 30 end,
  'While Raging, slashing damage is halved'
);

-- Using Rage costs the bonus action, by name in the feed.
set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000002", "role": "authenticated"}';
select set_config('test.rage', (select id::text from public.use_feature(current_setting('test.yenn')::uuid, 'Rage', 'bonus')), true);
select is(
  (select shown ->> 'feature' from public.combat_events where id = current_setting('test.rage')::uuid), 'Rage',
  'The feed names the feature'
);
select is(
  (select bonus_used from public.combatants where id = current_setting('test.yenn')::uuid), true,
  '...and it spends the bonus action'
);
select throws_ok(
  $$ select public.use_feature(current_setting('test.yenn')::uuid, 'Second Wind', 'bonus') $$,
  '22023', 'You have used your bonus action this turn',
  'One bonus action a turn'
);

-- The player takes it back.
select lives_ok(
  $$ select public.undo_event(current_setting('test.rage')::uuid) $$,
  'A player undoes their own newest action'
);
select is(
  (select bonus_used from public.combatants where id = current_setting('test.yenn')::uuid), false,
  '...and gets the bonus action back'
);
select throws_ok(
  $$ select public.undo_event((current_setting('test.hit')::jsonb -> 'event' ->> 'id')::uuid) $$,
  '42501', 'Only the DM can undo that',
  'A player can''t undo an attack'
);

-- Action Surge: the action again.
select public.use_action(current_setting('test.yenn')::uuid, 'dash');
select public.use_feature(current_setting('test.yenn')::uuid, 'Action Surge', 'surge');
select is(
  (select action_used from public.combatants where id = current_setting('test.yenn')::uuid), false,
  'Action Surge gives the action back'
);

-- Dropping to 0 ends Rage.
set local request.jwt.claims = '{"sub": "efefefef-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set current_hp = 0 where id = current_setting('test.yenn_char')::uuid;
select is(
  (select effects from public.characters where id = current_setting('test.yenn_char')::uuid), '[]'::jsonb,
  'Dropping to 0 hit points ends Rage'
);

reset role;
select * from finish();
rollback;
