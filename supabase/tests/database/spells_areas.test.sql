-- C1b, spells and areas: a spell must be on the sheet, spends its slot and its action (bonus
-- action or reaction); attacks, saves, plain damage and healing are settled on the server; a
-- monster's save shows only pass or fail; concentration ends the spell before, damage asks for a
-- save, 0 hit points ends it; areas show on the map on stage; Undo gives the slot back.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('abababab-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('abababab-0000-4000-8000-000000000002', 'thorin@example.invalid'),
  ('abababab-0000-4000-8000-000000000003', 'mira@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Spell test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
insert into public.assets (campaign_id, kind, category, name, path)
  values (current_setting('test.campaign')::uuid, 'art', 'maps', 'Crypt', current_setting('test.campaign') || '/crypt.webp');
select set_config('test.map', (select id::text from public.assets where name = 'Crypt'), true);

set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'abababab-0000-4000-8000-000000000002', 'Thorin', 'Fighter', 5, 40, 40, 18);
select set_config('test.thorin_char', (select id::text from public.characters where name = 'Thorin'), true);

-- Mira: a 5th-level wizard, Intelligence 16, so spell save DC 8 + 3 + 3 = 14.
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
insert into public.characters (
  campaign_id, owner_id, name, class, level, intelligence, constitution, max_hp, current_hp, armour_class,
  save_proficiencies, spellcasting
) values (
  current_setting('test.campaign')::uuid, 'abababab-0000-4000-8000-000000000003', 'Mira', 'Wizard', 5, 16, 14, 40, 40, 12,
  '{intelligence,wisdom}',
  '{"ability": "intelligence", "slotsMax": [4, 3, 2, 0, 0, 0, 0, 0, 0], "slotsUsed": [0, 0, 0, 0, 0, 0, 0, 0, 0], "spells": [
     {"id": "a", "index": "fire-bolt", "name": "Fire Bolt", "level": 0, "prepared": true},
     {"id": "b", "index": "magic-missile", "name": "Magic Missile", "level": 1, "prepared": true},
     {"id": "c", "index": "shield", "name": "Shield", "level": 1, "prepared": true},
     {"id": "d", "index": "fireball", "name": "Fireball", "level": 3, "prepared": true},
     {"id": "e", "index": "hold-person", "name": "Hold Person", "level": 2, "prepared": true},
     {"id": "f", "index": "darkness", "name": "Darkness", "level": 2, "prepared": true},
     {"id": "g", "index": "cure-wounds", "name": "Cure Wounds", "level": 1, "prepared": true}]}'
);
select set_config('test.mira_char', (select id::text from public.characters where name = 'Mira'), true);

-- The fight: Mira (20), Goblin A (15), Goblin B (12), Thorin (5).
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid,
  array[current_setting('test.thorin_char')::uuid, current_setting('test.mira_char')::uuid],
  current_setting('test.map')::uuid)), true);
select set_config('test.mira', (select id::text from public.combatants where character_id = current_setting('test.mira_char')::uuid), true);
select set_config('test.thorin', (select id::text from public.combatants where character_id = current_setting('test.thorin_char')::uuid), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, tiebreak, speed, initiative)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A', 14, 30, 15),
         (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin B', 14, 30, 12);
select set_config('test.goblin_a', (select id::text from public.combatants where shown_name = 'Goblin A'), true);
select set_config('test.goblin_b', (select id::text from public.combatants where shown_name = 'Goblin B'), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, monster, hp, max_hp, ac, saves)
  select c.id, c.campaign_id, c.shown_name, 'goblin', 50, 50, 5,
         '{"strength": -1, "dexterity": 2, "constitution": 0, "intelligence": 0, "wisdom": -1, "charisma": -1}'
  from public.combatants c where c.kind = 'monster';
update public.combatants set initiative = 20 where id = current_setting('test.mira')::uuid;
update public.combatants set initiative = 5 where id = current_setting('test.thorin')::uuid;
update public.encounters set current_id = current_setting('test.mira')::uuid, round = 1;

-- ---------------------------------------------------------------------------------------------
-- Mira's turn
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$ select public.cast_spell(current_setting('test.mira')::uuid, '{"name": "Wish", "level": 9, "cost": "action", "kind": "other"}', 9, '{}', '{}', null) $$,
  '22023', 'That spell isn''t on your sheet',
  'Only spells on your sheet'
);

select set_config('test.bolt', public.cast_spell(
  current_setting('test.mira')::uuid,
  '{"index": "fire-bolt", "name": "Fire Bolt", "level": 0, "cost": "action", "kind": "attack", "damageType": "fire"}',
  0, array[current_setting('test.goblin_a')::uuid],
  '{"label": "Fire Bolt", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 7, "type": "fire"}}',
  null)::text, true);
select is(
  (current_setting('test.bolt')::jsonb -> 'events' -> 0 ->> 'kind') || ' ' || (current_setting('test.bolt')::jsonb -> 'events' -> 0 -> 'shown' ->> 'spell'),
  'spell Fire Bolt',
  'A spell attack is settled like a weapon attack, and the feed names the spell'
);
select is(
  (select spellcasting -> 'slotsUsed' from public.characters where id = current_setting('test.mira_char')::uuid),
  '[0, 0, 0, 0, 0, 0, 0, 0, 0]'::jsonb,
  'A cantrip needs no slot'
);
select is(
  (select action_used::text || ' ' || attacks_made::text from public.combatants where id = current_setting('test.mira')::uuid),
  'true 0',
  'Casting it uses the action'
);
select throws_ok(
  $$ select public.cast_spell(current_setting('test.mira')::uuid, '{"index": "magic-missile", "name": "Magic Missile", "level": 1, "cost": "action", "kind": "damage", "damageType": "force"}', 1, array[current_setting('test.goblin_a')::uuid], '{"dice": [{"sides": 4, "count": 3}], "modifier": 3}', null) $$,
  '22023', 'You have used your action this turn',
  'One action a turn, spells included'
);

-- Goblin A's turn: Shield is a reaction, cast when it isn't your turn.
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000003", "role": "authenticated"}';
select lives_ok(
  $$ select public.cast_spell(current_setting('test.mira')::uuid, '{"index": "shield", "name": "Shield", "level": 1, "cost": "reaction", "kind": "other"}', 1, '{}', '{}', null) $$,
  'A reaction spell is cast when it isn''t your turn'
);
select is(
  (select (spellcasting -> 'slotsUsed' ->> 0)::int from public.characters where id = current_setting('test.mira_char')::uuid), 1,
  '...and spends a slot'
);
select is(
  (select reaction_used from public.combatants where id = current_setting('test.mira')::uuid), true,
  '...and the reaction'
);
select throws_ok(
  $$ select public.cast_spell(current_setting('test.mira')::uuid, '{"index": "magic-missile", "name": "Magic Missile", "level": 1, "cost": "action", "kind": "damage", "damageType": "force"}', 1, array[current_setting('test.goblin_a')::uuid], '{"dice": [{"sides": 4, "count": 3}], "modifier": 3}', null) $$,
  '42501', 'It isn''t your turn',
  'An action spell waits for your turn'
);

-- Round 2, Mira's turn again.
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
select public.end_turn(current_setting('test.encounter')::uuid);
select public.end_turn(current_setting('test.encounter')::uuid);
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$ select public.cast_spell(current_setting('test.mira')::uuid, '{"index": "fireball", "name": "Fireball", "level": 3, "cost": "action", "kind": "save", "save": "dexterity", "dcSuccess": "half", "damageType": "fire"}', 2, array[current_setting('test.goblin_a')::uuid], '{"dice": [{"sides": 6, "count": 8}]}', null) $$,
  '22023', 'A level 3 spell needs a slot of level 3 or higher',
  'A spell needs a slot of its own level or higher'
);

select set_config('test.missile', public.cast_spell(
  current_setting('test.mira')::uuid,
  '{"index": "magic-missile", "name": "Magic Missile", "level": 1, "cost": "action", "kind": "damage", "damageType": "force"}',
  2, array[current_setting('test.goblin_a')::uuid], '{"dice": [{"sides": 4, "count": 4}], "modifier": 4}', null)::text, true);
select ok(
  (current_setting('test.missile')::jsonb -> 'events' -> 0 -> 'shown' ->> 'damage')::int
    = (current_setting('test.missile')::jsonb -> 'roll' ->> 'total')::int,
  'Magic Missile''s damage just lands'
);
select is(
  (select (spellcasting -> 'slotsUsed' ->> 1)::int from public.characters where id = current_setting('test.mira_char')::uuid), 1,
  'Cast with a higher slot, it spends that slot'
);

set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.undo_event((current_setting('test.missile')::jsonb -> 'events' -> 0 ->> 'id')::uuid);
select is(
  (select (spellcasting -> 'slotsUsed' ->> 1)::int from public.characters where id = current_setting('test.mira_char')::uuid), 0,
  'Undo gives the slot back'
);
select is(
  (select action_used from public.combatants where id = current_setting('test.mira')::uuid), false,
  '...and the action'
);
select is(
  (select hp::int from public.combatant_secrets where combatant_id = current_setting('test.goblin_a')::uuid),
  50 - coalesce((current_setting('test.bolt')::jsonb -> 'events' -> 0 -> 'shown' ->> 'damage')::int, 0),
  '...and the hit points'
);

-- Fireball on both goblins: each saves on its own; half damage on a success.
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000003", "role": "authenticated"}';
select set_config('test.fireball', public.cast_spell(
  current_setting('test.mira')::uuid,
  '{"index": "fireball", "name": "Fireball", "level": 3, "cost": "action", "kind": "save", "save": "dexterity", "dcSuccess": "half", "damageType": "fire"}',
  3, array[current_setting('test.goblin_a')::uuid, current_setting('test.goblin_b')::uuid],
  '{"dice": [{"sides": 6, "count": 8}]}', null)::text, true);
select is(
  jsonb_array_length(current_setting('test.fireball')::jsonb -> 'events'), 2,
  'Everyone caught in the area makes a save'
);
select ok(
  (select bool_and(
     (e -> 'shown' ->> 'damage')::int = case
       when e -> 'shown' ->> 'save' = 'failed' then (current_setting('test.fireball')::jsonb -> 'roll' ->> 'total')::int
       else (current_setting('test.fireball')::jsonb -> 'roll' ->> 'total')::int / 2 end)
   from jsonb_array_elements(current_setting('test.fireball')::jsonb -> 'events') e),
  'Full damage on a failed save, half on a success'
);
select is(
  (current_setting('test.fireball')::jsonb -> 'events' -> 0 -> 'shown' ->> 'dc')::int, 14,
  'The save DC is 8 + proficiency + the spellcasting modifier'
);
select ok(
  (select bool_and(e -> 'shown' -> 'saveTotal' = 'null'::jsonb) from jsonb_array_elements(current_setting('test.fireball')::jsonb -> 'events') e),
  'Players see a monster pass or fail, never its numbers'
);

-- ---------------------------------------------------------------------------------------------
-- Concentration and areas (the DM casting for Mira, which isn't held to the action)
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.cast_spell(
  current_setting('test.mira')::uuid,
  '{"index": "hold-person", "name": "Hold Person", "level": 2, "cost": "action", "kind": "save", "save": "wisdom", "concentration": true}',
  2, array[current_setting('test.goblin_b')::uuid], '{}', null);
select is(
  (select concentration from public.characters where id = current_setting('test.mira_char')::uuid), 'Hold Person',
  'A concentration spell is marked on the caster'
);
select public.cast_spell(
  current_setting('test.mira')::uuid,
  '{"index": "darkness", "name": "Darkness", "level": 2, "cost": "action", "kind": "other", "concentration": true}',
  2, '{}', '{}', '{"shape": "sphere", "size_ft": 15, "origin_x": 5, "origin_y": 5, "tone": "block"}');
select is(
  (select concentration from public.characters where id = current_setting('test.mira_char')::uuid), 'Darkness',
  'A new concentration spell ends the one before'
);
select is(
  (select count(*)::int from public.areas where concentration and character_id = current_setting('test.mira_char')::uuid and label = 'Darkness'), 1,
  'Darkness is left on the map'
);
insert into public.areas (campaign_id, map_id, shape, size_ft, origin_x, origin_y, label, hidden)
  values (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, 'cube', 20, 1, 1, 'Pit trap', true);

set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000002", "role": "authenticated"}';
select is(
  (select string_agg(label, ', ') from public.areas), 'Darkness',
  'Players see the areas on the map, but not one the DM hid'
);
select throws_ok(
  $$ insert into public.areas (campaign_id, map_id, shape, size_ft, origin_x, origin_y) values (current_setting('test.campaign')::uuid, current_setting('test.map')::uuid, 'sphere', 10, 2, 2) $$,
  '42501', null,
  'Players don''t add areas by hand'
);

-- Hurt while concentrating: a Constitution save, DC 10 or half the damage.
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set current_hp = current_hp - 24 where id = current_setting('test.mira_char')::uuid;
select is(
  (select concentration_dc::int from public.characters where id = current_setting('test.mira_char')::uuid), 12,
  'Damage while concentrating asks for a save: DC 10, or half the damage'
);
set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$ update public.characters set concentration_dc = null where id = current_setting('test.mira_char')::uuid $$,
  '42501', null,
  'A player can''t wave the save away'
);
select set_config('test.kept', public.concentration_save(current_setting('test.mira_char')::uuid)::text, true);
select ok(
  (select case when (current_setting('test.kept')::jsonb ->> 'kept')::boolean
     then ch.concentration = 'Darkness' and ch.concentration_dc is null
          and (select count(*) from public.areas a where a.label = 'Darkness') = 1
     else ch.concentration is null and (select count(*) from public.areas a where a.label = 'Darkness') = 0 end
   from public.characters ch where ch.id = current_setting('test.mira_char')::uuid),
  'Making the save keeps the spell; failing it ends the spell and its area'
);

set local request.jwt.claims = '{"sub": "abababab-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set concentration = 'Bless' where id = current_setting('test.mira_char')::uuid;
update public.characters set current_hp = 0 where id = current_setting('test.mira_char')::uuid;
select is(
  (select concentration from public.characters where id = current_setting('test.mira_char')::uuid), null,
  'Dropping to 0 hit points ends concentration'
);
select throws_ok(
  $$ select public.cast_spell(current_setting('test.mira')::uuid, '{"index": "fire-bolt", "name": "Fire Bolt", "level": 0, "cost": "action", "kind": "attack"}', 0, array[current_setting('test.goblin_a')::uuid], '{"dice": [{"sides": 20, "count": 1}], "modifier": 5}', null) $$,
  '22023', 'Nobody casts spells at 0 hit points',
  'Nobody casts at 0 hit points'
);

-- Healing
update public.characters set current_hp = 40 where id = current_setting('test.mira_char')::uuid;
update public.characters set current_hp = 10 where id = current_setting('test.thorin_char')::uuid;
select set_config('test.heal', public.cast_spell(
  current_setting('test.mira')::uuid,
  '{"index": "cure-wounds", "name": "Cure Wounds", "level": 1, "cost": "action", "kind": "heal"}',
  1, array[current_setting('test.thorin')::uuid], '{"dice": [{"sides": 8, "count": 1}], "modifier": 3}', null)::text, true);
select is(
  (select current_hp::int from public.characters where id = current_setting('test.thorin_char')::uuid),
  10 + (current_setting('test.heal')::jsonb -> 'roll' ->> 'total')::int,
  'Healing adds to hit points'
);

reset role;
select * from finish();
rollback;
