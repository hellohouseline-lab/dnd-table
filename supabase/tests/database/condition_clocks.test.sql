-- C3a: conditions that wear off. Only the DM puts conditions on; a clock counts rounds down as the
-- creature's turn starts, ends "until the end of its next turn" as that turn ends, and rolls a
-- monster's save each turn behind the screen (a player's is owed, and they roll it); a secret DC
-- stays off the row players read; concentration ending ends the conditions tied to it; players
-- stand up and break free; Undo puts conditions and clocks back; ending the fight lets a minute
-- pass; Undead Fortitude keeps a zombie up.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, email) values
  ('c3a00000-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('c3a00000-0000-4000-8000-000000000002', 'player@example.invalid');

set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Clock test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns where id = current_setting('test.campaign')::uuid), true);

set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class, strength)
  values (current_setting('test.campaign')::uuid, 'c3a00000-0000-4000-8000-000000000002', 'Yenn', 'Barbarian', 3, 30, 30, 10, 30);
select set_config('test.yenn_char', (select id::text from public.characters where name = 'Yenn'), true);

set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.yenn_char')::uuid], null)), true);
select set_config('test.yenn', (select id::text from public.combatants where kind = 'character' and encounter_id = current_setting('test.encounter')::uuid), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Unknown creature 1', 5);
select set_config('test.zombie', (select id::text from public.combatants where kind = 'monster' and encounter_id = current_setting('test.encounter')::uuid), true);
-- Its Constitution save is +30 (it always makes Undead Fortitude); its Wisdom save is -5.
insert into public.combatant_secrets (combatant_id, campaign_id, name, hp, max_hp, ac, saves, traits)
  values (current_setting('test.zombie')::uuid, current_setting('test.campaign')::uuid, 'Zombie A', 22, 22, 8,
          '{"constitution": 30, "wisdom": -5, "strength": 1, "dexterity": -2}', '{undead-fortitude}');

-- Undead Fortitude (run before switching roles: apply_damage is the server's own).
select is(
  (private.apply_damage((select c from public.combatants c where c.id = current_setting('test.zombie')::uuid), 22, 'slashing', false, false)) ->> 'fortitude',
  'true', 'Undead Fortitude: dropped to 0 by slashing, the zombie makes its save'
);
select is((select hp from public.combatant_secrets where combatant_id = current_setting('test.zombie')::uuid), 1::smallint,
  '...and stays up with 1 hit point');
select is(
  (select count(*)::int from public.rolls where secret and label = 'Zombie A: Undead Fortitude'
     and roller_id = 'c3a00000-0000-4000-8000-000000000001'),
  1, '...with the roll in the DM''s log only'
);
select is(
  (private.apply_damage((select c from public.combatants c where c.id = current_setting('test.zombie')::uuid), 5, 'radiant', false, false)) ->> 'down',
  'true', 'Radiant damage gets past Undead Fortitude'
);
update public.combatant_secrets set hp = 22 where combatant_id = current_setting('test.zombie')::uuid;
update public.combatants set health = 'healthy' where id = current_setting('test.zombie')::uuid;

update public.combatants set initiative = 15 where id = current_setting('test.yenn')::uuid;
update public.encounters set current_id = current_setting('test.yenn')::uuid, round = 1
  where id = current_setting('test.encounter')::uuid;
update public.characters set concentration = 'Hold Person' where id = current_setting('test.yenn_char')::uuid;

set local role authenticated;

-- Only the DM puts conditions on.
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  format('select public.set_condition(%L, %L, true, null, null)', current_setting('test.zombie'), 'prone'),
  '42501', 'Only the DM puts conditions on', 'A player can''t put conditions on'
);

-- Hold Person on the zombie: up to 2 rounds, a secret DC 30 Wisdom save each turn, tied to Yenn's
-- concentration.
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.set_condition(
  current_setting('test.zombie')::uuid, 'paralyzed', true,
  jsonb_build_object('rounds', 2, 'save', '{"ability": "wisdom", "dc": 30, "secret": true}'::jsonb,
                     'caster', jsonb_build_object('characterId', current_setting('test.yenn_char'), 'spell', 'Hold Person')),
  null
);
select ok(
  (select 'paralyzed' = any (conditions) from public.combatants where id = current_setting('test.zombie')::uuid),
  'The DM paralyses the zombie'
);
select is(
  (select x -> 'save' from public.combatants, jsonb_array_elements(condition_clocks) x where id = current_setting('test.zombie')::uuid),
  '{"ability": "wisdom", "dc": null, "secret": true}'::jsonb,
  'A secret DC isn''t on the row everyone reads'
);
select is((select dc from public.clock_secrets where combatant_id = current_setting('test.zombie')::uuid), 30::smallint,
  '...it''s kept for the DM');

set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.clock_secrets), 0, 'Players can''t read a secret DC');

-- Yenn ends the turn: the zombie's turn starts (a round off) and ends (its save, behind the screen).
select public.end_turn(current_setting('test.encounter')::uuid);
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
select is(
  (select (x ->> 'rounds')::int from public.combatants, jsonb_array_elements(condition_clocks) x where id = current_setting('test.zombie')::uuid),
  1, 'A round comes off as the zombie''s turn starts'
);
select is(
  (select count(*)::int from public.rolls where secret and label = 'Zombie A: Wisdom save against Paralysed'),
  1, 'Its save each turn is rolled at the end of its turn, in the DM''s log'
);
select is(
  (select count(*)::int from public.combat_events where kind = 'condition' and shown ->> 'still' = 'true'),
  1, '...and the feed says it''s still paralysed'
);

-- Yenn stops concentrating: Hold Person's paralysis ends.
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000002", "role": "authenticated"}';
update public.characters set concentration = null where id = current_setting('test.yenn_char')::uuid;
select ok(
  (select not ('paralyzed' = any (conditions)) and condition_clocks = '[]'::jsonb
   from public.combatants where id = current_setting('test.zombie')::uuid),
  'Losing concentration ends the conditions tied to it'
);
select is(
  (select shown ->> 'ended' from public.combat_events where kind = 'condition' order by seq desc limit 1),
  'concentration', '...and the feed says why'
);

-- Round 2, Yenn's turn. Frightened for 1 round on the zombie; Blinded until the end of Yenn's next
-- turn (put on during this one, so it lasts through the next); Poisoned with a Constitution save
-- each turn that Yenn can't fail (DC 1).
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.set_condition(current_setting('test.zombie')::uuid, 'frightened', true, '{"rounds": 1}', null);
select public.set_condition(current_setting('test.yenn')::uuid, 'blinded', true, '{"endOfNextTurn": true}', null);
select public.set_condition(current_setting('test.yenn')::uuid, 'poisoned', true,
  '{"save": {"ability": "constitution", "dc": 1, "secret": false}}', null);
select is(
  (select conditions from public.characters where id = current_setting('test.yenn_char')::uuid),
  '{blinded,poisoned}'::text[], 'Conditions on a character live on the character'
);

set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
select ok(
  (select 'blinded' = any (conditions) from public.characters where id = current_setting('test.yenn_char')::uuid),
  'Until the end of its next turn: still on at the end of the turn it was put on in'
);
select ok(
  (select not ('frightened' = any (conditions)) from public.combatants where id = current_setting('test.zombie')::uuid),
  'A 1-round condition ends as the creature''s next turn starts'
);
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
select ok(
  (select not ('blinded' = any (conditions)) from public.characters where id = current_setting('test.yenn_char')::uuid),
  '...and ends as the next one ends'
);
select is(
  (select (x ->> 'owed')::boolean from public.combatants, jsonb_array_elements(condition_clocks) x
   where id = current_setting('test.yenn')::uuid and x ->> 'condition' = 'poisoned'),
  true, 'A player''s save each turn is owed at the end of their turn'
);
select ok(
  (public.condition_save(current_setting('test.yenn')::uuid, 'poisoned') ->> 'saved')::boolean,
  'The player rolls it'
);
select ok(
  (select not ('poisoned' = any (conditions)) from public.characters where id = current_setting('test.yenn_char')::uuid),
  '...and passing ends it'
);

-- A wolf's bite: Strength save DC 1 against Prone, which Yenn resists.
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select ok(
  (public.set_condition(current_setting('test.yenn')::uuid, 'prone', true, null, '{"ability": "strength", "dc": 1}') ->> 'resisted')::boolean,
  'A save to resist is rolled first'
);
select ok(
  (select not ('prone' = any (conditions)) from public.characters where id = current_setting('test.yenn_char')::uuid),
  '...and a pass keeps the condition off'
);

-- Yenn's turn again: standing up and breaking free.
select public.end_turn(current_setting('test.encounter')::uuid);
select public.set_condition(current_setting('test.yenn')::uuid, 'prone', true, null, null);
select public.set_condition(current_setting('test.yenn')::uuid, 'grappled', true, '{"escapeDc": 1}', null);
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.stand_up(current_setting('test.yenn')::uuid);
select is(
  (select feet_moved from public.combatants where id = current_setting('test.yenn')::uuid), 15::smallint,
  'Standing up costs half your speed'
);
select ok(
  (public.break_free(current_setting('test.yenn')::uuid) ->> 'free')::boolean,
  'Breaking free: Athletics against the escape DC'
);
select is(
  (select conditions from public.characters where id = current_setting('test.yenn_char')::uuid), '{}'::text[],
  '...ends the grapple'
);

-- Taking a condition off by hand takes its clock with it.
set local request.jwt.claims = '{"sub": "c3a00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.set_condition(current_setting('test.zombie')::uuid, 'restrained', true, '{"escapeDc": 12}', null);
update public.combatants set conditions = '{}' where id = current_setting('test.zombie')::uuid;
select is((select condition_clocks from public.combatants where id = current_setting('test.zombie')::uuid), '[]'::jsonb,
  'Taking a condition off by hand takes its clock');

-- Undo puts a condition and its clock back.
select public.set_condition(current_setting('test.zombie')::uuid, 'stunned', true, '{"rounds": 3}', null);
select public.undo_event((select id from public.combat_events order by seq desc limit 1));
select ok(
  (select conditions = '{}' and condition_clocks = '[]'::jsonb from public.combatants where id = current_setting('test.zombie')::uuid),
  'Undo takes a condition back off, clock and all'
);

-- Ending the fight lets a minute pass: 5 rounds of Charmed end; Deafened with no clock stays.
select public.set_condition(current_setting('test.yenn')::uuid, 'charmed', true, '{"rounds": 5}', null);
select public.set_condition(current_setting('test.yenn')::uuid, 'deafened', true, null, null);
select public.end_fight(current_setting('test.encounter')::uuid);
select is(
  (select conditions from public.characters where id = current_setting('test.yenn_char')::uuid),
  '{deafened}'::text[], 'Ending the fight ends conditions with a minute or less left'
);

select * from finish();
rollback;
