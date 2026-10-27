-- Saved campaigns: only the person who saved one can read, change or remove it, and nobody can save
-- one for someone else.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('cb000000-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('cb000000-0000-4000-8000-000000000002', 'player@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "cb000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$insert into public.campaign_presets (name, body) values ('Death Pit', '# Campaign: Death Pit')$$,
  'The DM saves a campaign'
);
select is((select count(*)::int from public.campaign_presets), 1, '...and sees it');
select throws_ok(
  $$insert into public.campaign_presets (owner_id, name, body)
    values ('cb000000-0000-4000-8000-000000000002', 'Theirs', 'x')$$,
  '42501', null, 'Nobody saves a campaign for someone else'
);

set local request.jwt.claims = '{"sub": "cb000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.campaign_presets), 0, 'Someone else can''t see it');
update public.campaign_presets set body = 'changed';
delete from public.campaign_presets;

set local request.jwt.claims = '{"sub": "cb000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select is((select body from public.campaign_presets), '# Campaign: Death Pit', '...or change it');
select is((select count(*)::int from public.campaign_presets), 1, '...or remove it');

select * from finish();
rollback;
