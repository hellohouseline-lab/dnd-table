-- Every action in a turn: Hide and the rest take the action; a rogue's Cunning Action makes Dash,
-- Disengage and Hide a bonus action, which a fighter can't do; an off-hand attack needs an attack
-- first and takes the bonus action, not the action.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('abcdabcd-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('abcdabcd-0000-4000-8000-000000000002', 'rogue@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "abcdabcd-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Action test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "abcdabcd-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, speed, max_hp, current_hp)
  values (current_setting('test.campaign')::uuid, 'abcdabcd-0000-4000-8000-000000000002', 'Pip', 'Rogue', 2, 30, 14, 14);
select set_config('test.pip_char', (select id::text from public.characters), true);

set local request.jwt.claims = '{"sub": "abcdabcd-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.pip_char')::uuid], null)), true);
select set_config('test.pip', (select id::text from public.combatants where kind = 'character'), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A', 5);
select set_config('test.goblin', (select id::text from public.combatants where kind = 'monster'), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, hp, max_hp, ac)
  values (current_setting('test.goblin')::uuid, current_setting('test.campaign')::uuid, 'Goblin A', 30, 30, 1);
update public.combatants set initiative = 15 where id = current_setting('test.pip')::uuid;
update public.encounters set current_id = current_setting('test.pip')::uuid, round = 1;

set local request.jwt.claims = '{"sub": "abcdabcd-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$ select public.use_action(current_setting('test.pip')::uuid, 'bonus_disengage') $$,
  'A rogue disengages as a bonus action (Cunning Action)'
);
select is(
  (select action_used::text || ' ' || bonus_used::text || ' ' || disengaged::text from public.combatants where id = current_setting('test.pip')::uuid),
  'false true true',
  '...which keeps the action and spends the bonus action'
);
select throws_ok(
  $$ select public.offhand_attack(current_setting('test.pip')::uuid, current_setting('test.goblin')::uuid, '{"label": "Dagger (off hand)", "dice": [{"sides": 20, "count": 1}], "modifier": 50}') $$,
  '22023', null,
  'An off-hand attack needs an attack first (and the bonus action is gone)'
);

-- Next round: attack, then the off hand.
set local request.jwt.claims = '{"sub": "abcdabcd-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
select public.end_turn(current_setting('test.encounter')::uuid);
set local request.jwt.claims = '{"sub": "abcdabcd-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.resolve_attack(current_setting('test.pip')::uuid, current_setting('test.goblin')::uuid,
  '{"label": "Shortsword", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 3, "type": "piercing"}}');
select set_config('test.off', public.offhand_attack(current_setting('test.pip')::uuid, current_setting('test.goblin')::uuid,
  '{"label": "Dagger (off hand)", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 1, "type": "piercing"}}')::text, true);
select is(
  (current_setting('test.off')::jsonb -> 'event' -> 'shown' ->> 'offhand'), 'true',
  'The feed marks an off-hand attack'
);
select is(
  (select attacks_made::text || ' ' || bonus_used::text from public.combatants where id = current_setting('test.pip')::uuid),
  '1 true',
  '...which takes the bonus action, not another attack'
);
select throws_ok(
  $$ select public.use_action(current_setting('test.pip')::uuid, 'bonus_hide') $$,
  '22023', 'You have used your bonus action this turn',
  'One bonus action a turn'
);
select throws_ok(
  $$ select public.use_action(current_setting('test.pip')::uuid, 'hide') $$,
  '22023', 'You have used your action this turn',
  'Hide takes the action, already spent on the attack'
);

-- A fighter can't.
set local request.jwt.claims = '{"sub": "abcdabcd-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set class = 'Fighter' where id = current_setting('test.pip_char')::uuid;
select public.end_turn(current_setting('test.encounter')::uuid);
select public.end_turn(current_setting('test.encounter')::uuid);
set local request.jwt.claims = '{"sub": "abcdabcd-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.use_action(current_setting('test.pip')::uuid, 'bonus_dash') $$,
  '22023', 'Only a rogue (Cunning Action) or a monk can do that as a bonus action',
  'A fighter can''t dash as a bonus action'
);
select lives_ok(
  $$ select public.use_action(current_setting('test.pip')::uuid, 'search') $$,
  'Search takes the action'
);

reset role;
select * from finish();
rollback;
