-- Concentration: each hit is its own save (the next comes up once one is kept), and being
-- stunned, paralysed, petrified, incapacitated or knocked out ends it.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('c0c0c0c0-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('c0c0c0c0-0000-4000-8000-000000000002', 'cleric@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "c0c0c0c0-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Concentration test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

set local request.jwt.claims = '{"sub": "c0c0c0c0-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');
-- Constitution 30 (+10): a DC 10 save always holds, so the test knows what happens.
insert into public.characters (campaign_id, owner_id, name, class, level, max_hp, current_hp, armour_class, constitution)
  values (current_setting('test.campaign')::uuid, 'c0c0c0c0-0000-4000-8000-000000000002', 'Ada', 'Cleric', 3, 40, 40, 16, 30);
select set_config('test.ada', (select id::text from public.characters), true);

update public.characters set concentration = 'Bless' where id = current_setting('test.ada')::uuid;
set local request.jwt.claims = '{"sub": "c0c0c0c0-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Two hits before the first save: 6 damage (DC 10), then 30 (DC 15).
update public.characters set current_hp = current_hp - 6 where id = current_setting('test.ada')::uuid;
update public.characters set current_hp = current_hp - 30 where id = current_setting('test.ada')::uuid;
select is(
  (select (concentration_dc::int, concentration_queue::int[]) from public.characters where id = current_setting('test.ada')::uuid),
  (10, array[15]), 'Each hit owes its own save: the first now, the next queued'
);

set local request.jwt.claims = '{"sub": "c0c0c0c0-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ update public.characters set concentration_queue = '{}' where id = current_setting('test.ada')::uuid $$,
  '42501', null,
  'A player can''t wave the next save away'
);

-- The first save, DC 10, is kept.
select public.concentration_save(current_setting('test.ada')::uuid);
select is(
  (select (concentration_dc::int, cardinality(concentration_queue)) from public.characters where id = current_setting('test.ada')::uuid),
  (15, 0), 'Keeping one save brings up the next'
);
select is(
  (select concentration from public.characters where id = current_setting('test.ada')::uuid), 'Bless',
  '...and the spell keeps going'
);

-- A new spell starts clean.
update public.characters set concentration = 'Shield of Faith' where id = current_setting('test.ada')::uuid;
select is(
  (select (concentration_dc, cardinality(concentration_queue)) from public.characters where id = current_setting('test.ada')::uuid),
  (null::smallint, 0), 'A new concentration spell clears the saves owed'
);

-- Stunned: it ends.
set local request.jwt.claims = '{"sub": "c0c0c0c0-0000-4000-8000-000000000001", "role": "authenticated"}';
update public.characters set conditions = array['stunned'] where id = current_setting('test.ada')::uuid;
select is(
  (select concentration from public.characters where id = current_setting('test.ada')::uuid), null,
  'Being stunned ends concentration'
);

-- Poisoned or prone doesn't.
update public.characters set conditions = array['poisoned', 'prone'], concentration = 'Bless' where id = current_setting('test.ada')::uuid;
select is(
  (select concentration from public.characters where id = current_setting('test.ada')::uuid), 'Bless',
  'Poisoned or prone keeps it'
);
update public.characters set conditions = array['poisoned', 'prone', 'paralyzed'] where id = current_setting('test.ada')::uuid;
select is(
  (select concentration from public.characters where id = current_setting('test.ada')::uuid), null,
  'Paralysed ends it'
);

reset role;
select * from finish();
rollback;
