-- Story mode: chapters and scenes are the DM's alone; the notebook remembers the current scene;
-- the read-aloud reaches players only when the DM puts it on stage.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('6f6f6f6f-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('6f6f6f6f-0000-4000-8000-000000000002', 'wren@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub": "6f6f6f6f-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Story test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);

insert into public.story_chapters (campaign_id, title) values (current_setting('test.campaign')::uuid, 'Chapter 1: The Ember Road');
select set_config('test.chapter', (select id::text from public.story_chapters), true);
insert into public.story_scenes (campaign_id, chapter_id, title, read_aloud, reminders)
  values (current_setting('test.campaign')::uuid, current_setting('test.chapter')::uuid, 'The Tavern',
    'Smoke curls from the hearth.', 'The innkeeper knows about the mill.');
select set_config('test.scene', (select id::text from public.story_scenes), true);
select is((select count(*)::int from public.story_scenes), 1, 'The DM writes a scene');

insert into public.dm_notebooks (campaign_id, current_scene_id)
  values (current_setting('test.campaign')::uuid, current_setting('test.scene')::uuid);
select is((select current_scene_id::text from public.dm_notebooks), current_setting('test.scene'), 'The notebook knows where the party is');
insert into public.stage (campaign_id) values (current_setting('test.campaign')::uuid);

set local request.jwt.claims = '{"sub": "6f6f6f6f-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Jo');
select is((select count(*)::int from public.story_chapters), 0, 'Players can''t read the chapters');
select is((select count(*)::int from public.story_scenes), 0, '...or the scenes, read-aloud and reminders');
select throws_ok(
  $$ insert into public.story_chapters (campaign_id, title) values (current_setting('test.campaign')::uuid, 'Mine now') $$,
  '42501', null, 'Players can''t write the story'
);
update public.stage set read_aloud = 'Ha' where campaign_id = current_setting('test.campaign')::uuid;

set local request.jwt.claims = '{"sub": "6f6f6f6f-0000-4000-8000-000000000001", "role": "authenticated"}';
select is((select read_aloud from public.stage), '', 'Players can''t put words on stage');
update public.stage set read_aloud = 'Smoke curls from the hearth.' where campaign_id = current_setting('test.campaign')::uuid;

set local request.jwt.claims = '{"sub": "6f6f6f6f-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select read_aloud from public.stage), 'Smoke curls from the hearth.', 'Shown, players see the read-aloud');

set local request.jwt.claims = '{"sub": "6f6f6f6f-0000-4000-8000-000000000001", "role": "authenticated"}';
delete from public.story_chapters;
select is((select count(*)::int from public.story_scenes), 0, 'Removing a chapter removes its scenes');

select * from finish();
rollback;
