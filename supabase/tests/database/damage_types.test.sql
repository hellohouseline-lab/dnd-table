-- C1b, damage types: resistance halves, vulnerability doubles, immunity stops it; a monster's
-- defences stay secret; players keep their own character's list.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- The rule itself
select is(private.damage_adjustment('poison', false, '{}', '{}', '{poison}'), 'immune', 'Immunity stops the damage');
select is(private.damage_adjustment('cold', false, '{cold}', '{}', '{}'), 'resisted', 'Resistance halves it');
select is(private.damage_adjustment('fire', false, '{}', '{fire}', '{}'), 'vulnerable', 'Vulnerability doubles it');
select is(
  private.damage_adjustment('slashing', false, '{slashing:nonmagical}', '{}', '{}'), 'resisted',
  'Resistance to non-magical weapons covers an ordinary sword'
);
select is(
  private.damage_adjustment('slashing', true, '{slashing:nonmagical}', '{}', '{}'), null,
  '...but not a magic one'
);
select is(private.damage_adjustment('fire', false, '{fire}', '{fire}', '{}'), null, 'Resistance and vulnerability cancel out');
select is(private.damage_adjustment('thunder', false, '{cold}', '{fire}', '{poison}'), null, 'Other damage is unchanged');

insert into auth.users (id, email) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'player@example.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'player2@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Damage test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
insert into public.characters (campaign_id, owner_id, name, max_hp, current_hp, armour_class)
  values (current_setting('test.campaign')::uuid, 'eeeeeeee-0000-4000-8000-000000000002', 'Tiefling', 40, 40, 10);
select set_config('test.tiefling', (select id::text from public.characters), true);
select lives_ok(
  $$ update public.characters set resistances = '{fire}' where id = current_setting('test.tiefling')::uuid $$,
  'A player marks their own character''s resistance'
);

set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000003", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Alex');
update public.characters set resistances = '{}' where id = current_setting('test.tiefling')::uuid;
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000002", "role": "authenticated"}';
select is(
  (select resistances from public.characters where id = current_setting('test.tiefling')::uuid), '{fire}'::text[],
  '...and nobody else can change it'
);

-- A fight against a creature that resists cold, is immune to poison and vulnerable to fire.
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.encounter', (select id::text from public.start_fight(
  current_setting('test.campaign')::uuid, array[current_setting('test.tiefling')::uuid], null)), true);
select public.begin_battle(e.id) from public.encounters e where e.placing_phase and e.campaign_id in (select m.campaign_id from public.campaign_members m where m.user_id = auth.uid() and m.role = 'dm');
select set_config('test.hero', (select id::text from public.combatants where kind = 'character'), true);
insert into public.combatants (encounter_id, campaign_id, kind, shown_name, revealed)
  values (current_setting('test.encounter')::uuid, current_setting('test.campaign')::uuid, 'monster', 'Ice troll', true);
select set_config('test.troll', (select id::text from public.combatants where kind = 'monster'), true);
insert into public.combatant_secrets (combatant_id, campaign_id, name, hp, max_hp, ac, resistances, vulnerabilities, immunities)
  values (current_setting('test.troll')::uuid, current_setting('test.campaign')::uuid, 'Ice troll', 200, 200, 5,
    '{cold,slashing:nonmagical}', '{fire}', '{poison}');

-- Flat damage (no dice) of 10, with a bonus so big only a natural 1 misses.
select set_config('test.cold', public.resolve_attack(current_setting('test.hero')::uuid, current_setting('test.troll')::uuid,
  '{"label": "Ray of Frost", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 10, "type": "cold"}}'
)::text, true);
select is(
  (current_setting('test.cold')::jsonb -> 'event' -> 'shown' ->> 'damage')::int,
  case when (current_setting('test.cold')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean then 5 else 0 end,
  'Cold damage is halved for a creature that resists it'
);
select ok(
  (current_setting('test.cold')::jsonb -> 'event' -> 'shown' ->> 'adjust') = 'resisted'
    or not (current_setting('test.cold')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean,
  'The feed says it was resisted'
);

select set_config('test.poison', public.resolve_attack(current_setting('test.hero')::uuid, current_setting('test.troll')::uuid,
  '{"label": "Poison dart", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 10, "type": "poison"}}'
)::text, true);
select is(
  (current_setting('test.poison')::jsonb -> 'event' -> 'shown' ->> 'damage')::int, 0,
  'Poison does nothing to a creature immune to it'
);

select set_config('test.fire', public.resolve_attack(current_setting('test.hero')::uuid, current_setting('test.troll')::uuid,
  '{"label": "Fire Bolt", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 10, "type": "Fire"}}'
)::text, true);
select is(
  (current_setting('test.fire')::jsonb -> 'event' -> 'shown' ->> 'damage')::int,
  case when (current_setting('test.fire')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean then 20 else 0 end,
  'Fire damage is doubled for a creature vulnerable to it, whatever the capitals'
);

select set_config('test.magic', public.resolve_attack(current_setting('test.hero')::uuid, current_setting('test.troll')::uuid,
  '{"label": "+1 Longsword", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "magical": true, "damage": {"dice": [], "modifier": 10, "type": "slashing"}}'
)::text, true);
select is(
  (current_setting('test.magic')::jsonb -> 'event' -> 'shown' ->> 'damage')::int,
  case when (current_setting('test.magic')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean then 10 else 0 end,
  'A magic weapon gets past resistance to non-magical weapons'
);
select is(
  (select hp::int from public.combatant_secrets),
  200 - (select sum((shown ->> 'damage')::int)::int from public.combat_events),
  'The adjusted damage is what comes off'
);

-- The creature hits back with fire; the tiefling resists it.
select set_config('test.burn', public.resolve_attack(current_setting('test.troll')::uuid, current_setting('test.hero')::uuid,
  '{"label": "Ice troll: Breath", "dice": [{"sides": 20, "count": 1}], "modifier": 50, "damage": {"dice": [], "modifier": 11, "type": "fire"}}'
)::text, true);
select is(
  (select current_hp::int from public.characters),
  case when (current_setting('test.burn')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean then 35 else 40 end,
  'A character''s own resistance halves the damage too (11 becomes 5)'
);

-- What players see
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.combatant_secrets), 0, 'Players can''t read a monster''s resistances');
select ok(
  (select bool_or(shown ? 'adjust') from public.combat_events),
  'Players see in the feed what happened to the damage'
);
select is(
  (select count(*)::int from public.combat_events where shown ->> 'adjust' = 'immune' and (shown ->> 'hit')::boolean),
  case when (current_setting('test.poison')::jsonb -> 'event' -> 'shown' ->> 'hit')::boolean then 1 else 0 end,
  '...such as a creature turning out to be immune'
);

reset role;
select * from finish();
rollback;
