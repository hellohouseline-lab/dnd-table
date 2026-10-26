-- The DM's notebook, the session log, the library and the stage: who can see and change what.
-- Runs inside one transaction that is rolled back, so nothing it creates is kept.
-- Run with: npm run test:db

begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'dm@example.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'player@example.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'outsider@example.invalid');

set local role authenticated;

set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000001", "role": "authenticated"}';
select set_config('test.campaign', public.create_campaign('Stage test', 'Matt')::text, true);
select set_config('test.code', (select join_code from public.campaigns), true);
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000002", "role": "authenticated"}';
select public.join_campaign(current_setting('test.code'), 'Sam');

-- ---------------------------------------------------------------------------------------------
-- The DM sets things up
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.dm_notebooks (campaign_id, where_we_are, next_steps)
     values (current_setting('test.campaign')::uuid, 'The party reached the tavern.', '[{"id": "1", "text": "Meet the innkeeper", "done": false}]') $$,
  'The DM starts the notebook'
);
select lives_ok(
  $$ insert into public.log_events (campaign_id, kind, text, visible) values
       (current_setting('test.campaign')::uuid, 'note', 'The innkeeper is lying', false),
       (current_setting('test.campaign')::uuid, 'rest', 'The party took a long rest', true)
  $$,
  'The DM writes in the log'
);
select lives_ok(
  $$ insert into public.assets (campaign_id, kind, category, name, path, thumb_path) values
       (current_setting('test.campaign')::uuid, 'art', 'places', 'Tavern', current_setting('test.campaign') || '/tavern.webp', current_setting('test.campaign') || '/tavern-thumb.webp'),
       (current_setting('test.campaign')::uuid, 'art', 'people', 'Secret villain', current_setting('test.campaign') || '/villain.webp', null)
  $$,
  'The DM adds art to the library'
);
select lives_ok(
  $$ insert into public.assets (campaign_id, kind, mood, name, path) values
       (current_setting('test.campaign')::uuid, 'music', 'tavern', 'Merry inn', current_setting('test.campaign') || '/inn.mp3') $$,
  'The DM adds music'
);
select lives_ok(
  $$ insert into public.assets (campaign_id, kind, name, path, hotkey) values
       (current_setting('test.campaign')::uuid, 'effect', 'Door creak', current_setting('test.campaign') || '/door.mp3', 1) $$,
  'The DM adds a sound effect on key 1'
);
select throws_ok(
  $$ insert into public.assets (campaign_id, kind, name, path, hotkey) values
       (current_setting('test.campaign')::uuid, 'effect', 'Thunder', current_setting('test.campaign') || '/thunder.mp3', 1) $$,
  '23505', null,
  'Each key holds one sound effect'
);
select throws_ok(
  $$ insert into public.assets (campaign_id, kind, name, path) values
       (current_setting('test.campaign')::uuid, 'music', 'No mood', current_setting('test.campaign') || '/x.mp3') $$,
  '23514', null,
  'Music needs a mood'
);
select ok(
  private.is_dm_of_folder(current_setting('test.campaign') || '/tavern.webp'),
  'The DM can upload files into the table''s folders'
);
select ok(private.can_see_art(current_setting('test.campaign') || '/villain.webp'), 'The DM sees all their art');

-- ---------------------------------------------------------------------------------------------
-- The player, before anything is on stage
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000002", "role": "authenticated"}';

select is((select count(*)::int from public.dm_notebooks), 0, 'A player cannot read the notebook');
select throws_ok(
  $$ insert into public.dm_notebooks (campaign_id) values (current_setting('test.campaign')::uuid) $$,
  '42501', null,
  'A player cannot write a notebook'
);
select is((select count(*)::int from public.log_events), 1, 'A player sees only log entries marked visible');
select throws_ok(
  $$ insert into public.log_events (campaign_id, kind, text) values (current_setting('test.campaign')::uuid, 'note', 'Sneaky') $$,
  '42501', null,
  'A player cannot write in the log'
);
select is((select count(*)::int from public.assets where kind = 'art'), 0, 'A player cannot browse the DM''s art');
select is((select count(*)::int from public.assets where kind <> 'art'), 2, 'A player can see the sounds, to play them');
select ok(
  not private.can_see_art(current_setting('test.campaign') || '/tavern.webp'),
  'A player cannot open a picture that isn''t on stage'
);
select ok(private.can_see_portrait(current_setting('test.campaign') || '/inn.mp3'), 'A player can download the music');
select ok(
  not private.is_dm_of_folder(current_setting('test.campaign') || '/tavern.webp'),
  'A player cannot upload art or sound'
);
select throws_ok(
  $$ insert into public.assets (campaign_id, kind, mood, name, path) values
       (current_setting('test.campaign')::uuid, 'music', 'boss', 'Mine', current_setting('test.campaign') || '/mine.mp3') $$,
  '42501', null,
  'A player cannot add to the library'
);
select throws_ok(
  $$ insert into public.stage (campaign_id, scene_name) values (current_setting('test.campaign')::uuid, 'Hijack') $$,
  '42501', null,
  'A player cannot set up the stage'
);

-- ---------------------------------------------------------------------------------------------
-- The DM puts the tavern on stage and plays music
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.stage (campaign_id, scene_name, image_id, music_id, music_playing, music_started_at)
     values (current_setting('test.campaign')::uuid, 'Arrive at the tavern',
       (select id from public.assets where name = 'Tavern'), (select id from public.assets where name = 'Merry inn'), true, now()) $$,
  'The DM puts a picture on stage and plays music'
);

set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000002", "role": "authenticated"}';

select is((select scene_name from public.stage), 'Arrive at the tavern', 'A player sees the stage');
select is((select name from public.assets where kind = 'art'), 'Tavern', 'A player sees the picture on stage, and only that one');
select ok(private.can_see_art(current_setting('test.campaign') || '/tavern.webp'), 'A player can open the picture on stage');
select ok(private.can_see_art(current_setting('test.campaign') || '/tavern-thumb.webp'), '...and its thumbnail');
select ok(not private.can_see_art(current_setting('test.campaign') || '/villain.webp'), 'The rest of the art stays hidden');
update public.stage set scene_name = 'Hijacked' where campaign_id = current_setting('test.campaign')::uuid;
select is((select scene_name from public.stage), 'Arrive at the tavern', 'A player cannot change the stage');

-- ---------------------------------------------------------------------------------------------
-- Someone not at the table
-- ---------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000003", "role": "authenticated"}';

select is((select count(*)::int from public.stage), 0, 'An outsider cannot see the stage');
select is((select count(*)::int from public.assets), 0, 'An outsider cannot see the library');
select ok(not private.can_see_portrait(current_setting('test.campaign') || '/inn.mp3'), 'An outsider cannot download the music');

reset role;
select * from finish();
rollback;
