-- P1c: a monster's ability with a save (a dragon's breath). Only the DM uses it; the server throws
-- the damage behind the screen, rolls each target's save against the DC, takes off full, half or
-- none, and never puts the DC in what players see. Undo gives the action back.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('c1c00000-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('c1c00000-0000-4000-8000-000000000002', 'player@example.invalid');

set local request.jwt.claims = '{"sub": "c1c00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Breath test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns where id = current_setting('test.campaign')::uuid), true);

set local request.jwt.claims = '{"sub": "c1c00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'c1c00000-0000-4000-8000-000000000002', 'Elowen', 'Bard', 3, 200, 200, 12);
select set_config('test.elowen_char', (select id::text from public.characters where name = 'Elowen'), true);

set local request.jwt.claims = '{"sub": "c1c00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.elowen_char')::uuid], null)), true);
select set_config('test.elowen', (select id::text from public.combatants where kind = 'character' and encounter_id = current_setting('test.encounter')::uuid), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative, created_at) values
  (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Dragon', 20, now()),
  (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin', 5, now() + interval '1 second');
select set_config('test.dragon', (select id::text from public.combatants where shown_name = 'Dragon' and encounter_id = current_setting('test.encounter')::uuid), true);
select set_config('test.goblin', (select id::text from public.combatants where shown_name = 'Goblin' and encounter_id = current_setting('test.encounter')::uuid), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, hp, max_hp, ac, saves) values
  (current_setting('test.dragon')::uuid, current_setting('test.campaign')::uuid, 'Young black dragon', 127, 127, 18, '{}'),
  -- A goblin that can't fail a DC 10 Dexterity save, to see half damage.
  (current_setting('test.goblin')::uuid, current_setting('test.campaign')::uuid, 'Goblin', 500, 500, 15, '{"dexterity": 40}');
update public.encounters set current_id = current_setting('test.dragon')::uuid, round = 1
  where id = current_setting('test.encounter')::uuid;
select set_config('test.breath', '{"name": "Acid Breath", "save": "dexterity", "dc": 10, "dcSuccess": "half", "damageType": "acid", "cost": "action"}', true);
select set_config('test.dice', '{"dice": [{"sides": 4, "count": 1}], "modifier": 40}', true);

set local role authenticated;

-- A player can't use a monster's ability.
set local request.jwt.claims = '{"sub": "c1c00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  format('select public.monster_ability(%L, %L, array[%L]::uuid[], %L)', current_setting('test.dragon'),
         current_setting('test.breath'), current_setting('test.elowen'), current_setting('test.dice')),
  '42501', 'Only the DM plays the monsters', 'Only the DM plays the monsters'
);

set local request.jwt.claims = '{"sub": "c1c00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  format('select public.monster_ability(%L, %L, array[]::uuid[], %L)', current_setting('test.dragon'),
         current_setting('test.breath'), current_setting('test.dice')),
  '22023', 'Pick who it catches', 'It needs someone to catch'
);
select throws_ok(
  format('select public.monster_ability(%L, %L, array[%L]::uuid[], %L)', current_setting('test.dragon'),
         '{"name": "Acid Breath", "save": "luck", "dc": 10}', current_setting('test.elowen'), current_setting('test.dice')),
  '22023', 'Which saving throw does it ask for?', 'The save must be an ability'
);
select throws_ok(
  format('select public.monster_ability(%L, %L, array[%L]::uuid[], %L)', current_setting('test.elowen'),
         current_setting('test.breath'), current_setting('test.goblin'), current_setting('test.dice')),
  '22023', 'That fight is over', 'Only a monster uses a monster''s ability'
);

select lives_ok(
  format('select public.monster_ability(%L, %L, array[%L, %L]::uuid[], %L)', current_setting('test.dragon'),
         current_setting('test.breath'), current_setting('test.elowen'), current_setting('test.goblin'), current_setting('test.dice')),
  'The dragon breathes on Elowen and the goblin'
);
select is(
  (select count(*)::int from public.combat_events where encounter_id = current_setting('test.encounter')::uuid and kind = 'spell'),
  2, 'One line in the feed for each'
);
select ok(
  (select r.secret and r.total between 41 and 44 from public.combat_events ev join public.rolls r on r.id = ev.roll_id
   where ev.target_id = current_setting('test.goblin')::uuid),
  'The damage is thrown once, behind the screen'
);
select is(
  (select shown ->> 'save' from public.combat_events where target_id = current_setting('test.goblin')::uuid),
  'passed', 'The goblin makes its save'
);
select set_config('test.total', (select r.total::text from public.combat_events ev join public.rolls r on r.id = ev.roll_id
  where ev.target_id = current_setting('test.goblin')::uuid), true);
select is(
  (select hp::int from public.combatant_secrets where combatant_id = current_setting('test.goblin')::uuid),
  500 - current_setting('test.total')::int / 2, '...and takes half'
);
select ok(
  (select (shown ->> 'damage')::int = case when shown ->> 'save' = 'passed' then current_setting('test.total')::int / 2
                                            else current_setting('test.total')::int end
          and ch.current_hp = 200 - (shown ->> 'damage')::int
   from public.combat_events ev, public.characters ch
   where ev.target_id = current_setting('test.elowen')::uuid and ch.id = current_setting('test.elowen_char')::uuid),
  'Elowen takes full damage on a fail or half on a pass'
);
select ok(
  (select bool_and(not (shown ? 'dc')) and bool_and(shown ->> 'spell' = 'Acid Breath') and bool_and((shown ->> 'monster')::boolean)
   from public.combat_events where encounter_id = current_setting('test.encounter')::uuid and kind = 'spell'),
  'The DC never goes in what players see'
);
select ok(
  (select shown ->> 'saveTotal' is not null from public.combat_events where target_id = current_setting('test.elowen')::uuid)
  and (select shown ->> 'saveTotal' is null from public.combat_events where target_id = current_setting('test.goblin')::uuid),
  'A character''s save total shows; a monster''s doesn''t'
);
select ok((select action_used from public.combatants where id = current_setting('test.dragon')::uuid), 'It spends the dragon''s action');

-- Undo, newest first: the goblin's line, then Elowen's, which gives the action back.
select public.undo_event((select id from public.combat_events where target_id = current_setting('test.goblin')::uuid));
select public.undo_event((select id from public.combat_events where target_id = current_setting('test.elowen')::uuid));
select ok(
  not (select action_used from public.combatants where id = current_setting('test.dragon')::uuid)
  and (select current_hp from public.characters where id = current_setting('test.elowen_char')::uuid) = 200
  and (select hp from public.combatant_secrets where combatant_id = current_setting('test.goblin')::uuid) = 500,
  'Undo puts the hit points and the action back'
);

select * from finish();
rollback;
