-- Timed effects: Rage lasts 10 rounds, counted at the start of the barbarian's turns; a
-- concentration timer ends the concentration when it runs out, and goes when the concentration
-- does; ending a fight ends anything with a minute or less left.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('7e7e7e7e-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('7e7e7e7e-0000-4000-8000-000000000002', 'barbarian@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "7e7e7e7e-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Timer test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "7e7e7e7e-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, '7e7e7e7e-0000-4000-8000-000000000002', 'Yenn', 'Barbarian', 3, 30, 30, 10);
select set_config('test.yenn_char', (select id::text from public.characters), true);

set local request.jwt.claims = '{"sub": "7e7e7e7e-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.yenn_char')::uuid], null)), true);
select set_config('test.yenn', (select id::text from public.combatants where kind = 'character'), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, initiative)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Goblin A', 5);
insert into public.combatant_secrets (combatant_id, campaign_id, name, hp, max_hp, ac)
  select id, campaign_id, 'Goblin A', 7, 7, 15 from public.combatants where kind = 'monster';
update public.combatants set initiative = 15 where id = current_setting('test.yenn')::uuid;
update public.encounters set current_id = current_setting('test.yenn')::uuid, round = 1;

-- Yenn rages in round 1, and is concentrating on a spell with 2 rounds on its timer.
set local request.jwt.claims = '{"sub": "7e7e7e7e-0000-4000-8000-000000000002", "role": "authenticated"}';
update public.characters
set effects = '[{"key": "rage", "name": "Raging", "roundsLeft": 10}, {"key": "concentration", "name": "Bless", "spell": "Bless", "roundsLeft": 2}, {"key": "other", "name": "Untimed"}]'
where id = current_setting('test.yenn_char')::uuid;

set local request.jwt.claims = '{"sub": "7e7e7e7e-0000-4000-8000-000000000001", "role": "authenticated"}';
-- concentration is set by cast_spell; set it directly here (as the DM).
reset role;
update public.characters set concentration = 'Bless' where id = current_setting('test.yenn_char')::uuid;
set local role authenticated;
select is(
  (select jsonb_array_length(effects) from public.characters where id = current_setting('test.yenn_char')::uuid), 3,
  'Starting concentration on the same spell keeps its timer'
);

-- Round 2: the goblin's turn, then Yenn's.
select public.end_turn(current_setting('test.encounter')::uuid);
select public.end_turn(current_setting('test.encounter')::uuid);
select is(
  (select (e ->> 'roundsLeft')::int from public.characters, jsonb_array_elements(effects) e
   where id = current_setting('test.yenn_char')::uuid and e ->> 'key' = 'rage'),
  9, 'Each of Yenn''s turns takes a round off Rage'
);
select is(
  (select e from public.characters, jsonb_array_elements(effects) e
   where id = current_setting('test.yenn_char')::uuid and e ->> 'key' = 'other'),
  '{"key": "other", "name": "Untimed"}'::jsonb, '...and leaves untimed effects alone'
);

-- Round 3: the concentration timer runs out.
select public.end_turn(current_setting('test.encounter')::uuid);
select public.end_turn(current_setting('test.encounter')::uuid);
select is(
  (select concentration from public.characters where id = current_setting('test.yenn_char')::uuid), null,
  'When its timer runs out, the concentration ends'
);

-- Rounds 4 to 11: Rage runs out at the start of Yenn's turn in round 11, 10 rounds after round 1.
select public.end_turn(current_setting('test.encounter')::uuid) from generate_series(1, 14);
select is(
  (select (e ->> 'roundsLeft')::int from public.characters, jsonb_array_elements(effects) e
   where id = current_setting('test.yenn_char')::uuid and e ->> 'key' = 'rage'),
  1, 'Rage has 1 round left in round 10'
);
select public.end_turn(current_setting('test.encounter')::uuid) from generate_series(1, 2);
select is(
  (select count(*)::int from public.characters, jsonb_array_elements(effects) e
   where id = current_setting('test.yenn_char')::uuid and e ->> 'key' = 'rage'),
  0, 'Rage ends after 10 rounds'
);

-- A new concentration takes the old timer with it.
reset role;
update public.characters
set concentration = 'Hold Person',
    effects = effects || '[{"key": "concentration", "name": "Bless", "spell": "Bless", "roundsLeft": 5}, {"key": "rage", "name": "Raging", "roundsLeft": 4}, {"key": "long", "name": "Long", "roundsLeft": 50}]'
where id = current_setting('test.yenn_char')::uuid;
set local role authenticated;
select is(
  (select count(*)::int from public.characters, jsonb_array_elements(effects) e
   where id = current_setting('test.yenn_char')::uuid and e ->> 'key' = 'concentration'),
  0, 'Concentrating on another spell drops the old timer'
);

-- Ending the fight ends a minute or less.
select public.end_fight(current_setting('test.encounter')::uuid);
select is(
  (select jsonb_agg(e ->> 'key' order by e ->> 'key') from public.characters, jsonb_array_elements(effects) e
   where id = current_setting('test.yenn_char')::uuid),
  '["long", "other"]'::jsonb, 'Ending the fight ends Rage but not longer effects'
);

reset role;
select * from finish();
rollback;
