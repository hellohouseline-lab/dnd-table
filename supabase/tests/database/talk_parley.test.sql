-- C3b: talk cards and parley. A player spends their action to Persuade, Intimidate or Deceive the
-- monsters still in the fight; only the DM answers, sets a stance or calls a parley; surrendered
-- and fled monsters are passed over, running ones leave as their turn comes round; a parley pauses
-- Next turn; Undo puts stances and the parley back.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('c3b00000-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('c3b00000-0000-4000-8000-000000000002', 'player@example.invalid');

set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Talk test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns where id = current_setting('test.campaign')::uuid), true);

set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'c3b00000-0000-4000-8000-000000000002', 'Elowen', 'Bard', 3, 20, 20, 12);
select set_config('test.elowen_char', (select id::text from public.characters where name = 'Elowen'), true);

set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.elowen_char')::uuid], null)), true);
select set_config('test.elowen', (select id::text from public.combatants where kind = 'character' and encounter_id = current_setting('test.encounter')::uuid), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative, created_at) values
  (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Unknown creature 1', 10, now()),
  (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Unknown creature 2', 5, now() + interval '1 second');
select set_config('test.g1', (select id::text from public.combatants where shown_name = 'Unknown creature 1' and encounter_id = current_setting('test.encounter')::uuid), true);
select set_config('test.g2', (select id::text from public.combatants where shown_name = 'Unknown creature 2' and encounter_id = current_setting('test.encounter')::uuid), true);
update public.combatants set initiative = 15 where id = current_setting('test.elowen')::uuid;
update public.encounters set current_id = current_setting('test.elowen')::uuid, round = 1
  where id = current_setting('test.encounter')::uuid;
select set_config('test.roll', '{"label": "Persuasion", "dice": [{"sides": 20, "count": 1}], "modifier": 5}', true);

set local role authenticated;

-- Elowen's turn.
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  format('select public.talk(%L, %L, array[%L]::uuid[], null, %L)', current_setting('test.elowen'), 'athletics',
         current_setting('test.g1'), current_setting('test.roll')),
  '22023', 'Pick Persuade, Intimidate or Deceive', 'Talk is Persuade, Intimidate or Deceive'
);
select throws_ok(
  format('select public.talk(%L, %L, array[%L]::uuid[], null, %L)', current_setting('test.elowen'), 'persuasion',
         current_setting('test.elowen'), current_setting('test.roll')),
  '22023', 'Pick who you''re talking to', 'You talk to the monsters in the fight'
);
select lives_ok(
  format('select public.talk(%L, %L, array[%L, %L]::uuid[], %L, %L)', current_setting('test.elowen'), 'persuasion',
         current_setting('test.g1'), current_setting('test.g2'), '  Drop your weapons and you can walk away.  ',
         current_setting('test.roll')),
  'Elowen talks to both goblins'
);
select set_config('test.talk', (select id::text from public.combat_events where kind = 'talk' order by seq desc limit 1), true);
select is(
  (select shown - 'total' from public.combat_events where id = current_setting('test.talk')::uuid),
  jsonb_build_object('talk', 'persuasion', 'words', 'Drop your weapons and you can walk away.',
                     'targets', jsonb_build_array(current_setting('test.g1'), current_setting('test.g2'))),
  'The card has the skill, both goblins and what she said'
);
select ok(
  (select (shown ->> 'total')::int = r.total and r.kind = 'check' and not r.secret
   from public.combat_events ev join public.rolls r on r.id = ev.roll_id where ev.id = current_setting('test.talk')::uuid),
  '...with the total of a check thrown by the server'
);
select ok((select action_used from public.combatants where id = current_setting('test.elowen')::uuid), 'Talking spends the action');
select throws_ok(
  format('select public.talk(%L, %L, array[%L]::uuid[], null, %L)', current_setting('test.elowen'), 'intimidation',
         current_setting('test.g1'), current_setting('test.roll')),
  '22023', 'You have used your action this turn', 'Only once a turn'
);

-- Only the DM answers, sets a stance or calls a parley.
select throws_ok(
  format('select public.answer_talk(%L, %L, %L)', current_setting('test.talk'), 'works', 'surrender'),
  '42501', 'Only the DM can answer that', 'A player can''t answer a talk card'
);
select throws_ok(
  format('select public.set_stance(%L, %L)', current_setting('test.g1'), 'surrendered'),
  '42501', 'Only the DM can do that', 'A player can''t make a monster surrender'
);
select throws_ok(
  format('select public.set_parley(%L, true)', current_setting('test.encounter')),
  '42501', 'Only the DM can do that', 'A player can''t call a parley'
);

-- It works: they surrender, and are passed over.
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.answer_talk(current_setting('test.talk')::uuid, 'works', 'surrender');
select is(
  (select array_agg(stance order by initiative desc) from public.combatants where kind = 'monster' and encounter_id = current_setting('test.encounter')::uuid),
  '{surrendered,surrendered}'::text[], 'It works: both goblins surrender'
);
select throws_ok(
  format('select public.answer_talk(%L, %L, null)', current_setting('test.talk'), 'fails'),
  '22023', 'That has been answered', 'A card is answered once'
);
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
select is(
  (select current_id::text || ' ' || round from public.encounters where id = current_setting('test.encounter')::uuid),
  current_setting('test.elowen') || ' 2', 'Surrendered goblins are passed over: Elowen again, round 2'
);

-- Undo the answer: they fight on, and the card can be answered again.
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.undo_event((select id from public.combat_events where shown ? 'answerTo' order by seq desc limit 1));
select is(
  (select array_agg(stance order by initiative desc) from public.combatants where kind = 'monster' and encounter_id = current_setting('test.encounter')::uuid),
  '{fighting,fighting}'::text[], 'Undo: the goblins fight on'
);

-- It works: they run, and leave as their turns come round.
select public.answer_talk(current_setting('test.talk')::uuid, 'works', 'run');
select is(
  (select array_agg(stance order by initiative desc) from public.combatants where kind = 'monster' and encounter_id = current_setting('test.encounter')::uuid),
  '{running,running}'::text[], 'It works: both goblins run'
);
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.end_turn(current_setting('test.encounter')::uuid);
select is(
  (select array_agg(stance order by initiative desc) from public.combatants where kind = 'monster' and encounter_id = current_setting('test.encounter')::uuid),
  '{fled,fled}'::text[], 'Running goblins leave as their turns come round'
);
select is(
  (select count(*)::int from public.combat_events where kind = 'talk' and shown ->> 'stance' = 'fled'),
  2, '...with a line in the feed for each'
);
select is(
  (select current_id::text || ' ' || round from public.encounters where id = current_setting('test.encounter')::uuid),
  current_setting('test.elowen') || ' 3', '...and the turn comes back to Elowen, round 3'
);

-- The DM sets a stance by hand.
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.set_stance(current_setting('test.g1')::uuid, 'fighting');
select is((select stance from public.combatants where id = current_setting('test.g1')::uuid), 'fighting',
  'The DM brings a goblin back into the fight');
select throws_ok(
  format('select public.set_stance(%L, %L)', current_setting('test.elowen'), 'surrendered'),
  '22023', 'Only monsters surrender or run here', 'Characters don''t get a stance'
);

-- Parley: Next turn waits until Back to the fight.
select public.set_parley(current_setting('test.encounter')::uuid, true);
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select ok((select parley from public.encounters where id = current_setting('test.encounter')::uuid), 'Players see the parley');
select throws_ok(
  format('select public.end_turn(%L)', current_setting('test.encounter')),
  '22023', 'The fight is paused for a parley. Press Back to the fight first.', 'A parley pauses the turns'
);
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.undo_event((select id from public.combat_events where shown ? 'parley' order by seq desc limit 1));
select ok(not (select parley from public.encounters where id = current_setting('test.encounter')::uuid), 'Undo ends the parley');
set local request.jwt.claims = '{"sub": "c3b00000-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(
  format('select public.end_turn(%L)', current_setting('test.encounter')),
  'Back to the fight: turns carry on'
);

select * from finish();
rollback;
