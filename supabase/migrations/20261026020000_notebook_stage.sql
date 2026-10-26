-- Milestone 5: the DM's notebook, the session log, the stage, and the library of art and sound.
--
-- Rules enforced here, not just in the screens:
-- * The notebook is the DM's alone: players can't read it.
-- * The session log is written by the DM's screens. Players see only entries marked visible.
-- * Only the DM adds to the library, changes the stage or uploads files.
-- * Players hear every sound in the library (their browsers have to download it to play it), but
--   see only the one picture that is on stage now, never the rest of the DM's art.

-- ---------------------------------------------------------------------------------------------
-- The DM's notebook
-- ---------------------------------------------------------------------------------------------

create table public.dm_notebooks (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  where_we_are text not null default '' check (char_length(where_we_are) <= 4000),
  -- [{"id": "...", "text": "Hear the rumour about the ruins", "done": false}]
  next_steps jsonb not null default '[]' check (jsonb_typeof(next_steps) = 'array' and pg_column_size(next_steps) <= 20000),
  -- [{"id": "...", "name": "Silver key", "holder": "Rogue has it"}]
  key_items jsonb not null default '[]' check (jsonb_typeof(key_items) = 'array' and pg_column_size(key_items) <= 20000),
  updated_at timestamptz not null default now()
);

create trigger dm_notebooks_touch_updated_at
  before update on public.dm_notebooks
  for each row execute function private.touch_updated_at();

alter table public.dm_notebooks enable row level security;
revoke all on public.dm_notebooks from anon, authenticated;
grant select, insert on public.dm_notebooks to authenticated;
grant update (where_we_are, next_steps, key_items) on public.dm_notebooks to authenticated;

create policy "Only the DM reads the notebook"
  on public.dm_notebooks for select to authenticated
  using (private.is_campaign_dm(campaign_id));

create policy "Only the DM starts the notebook"
  on public.dm_notebooks for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

create policy "Only the DM writes in the notebook"
  on public.dm_notebooks for update to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

-- ---------------------------------------------------------------------------------------------
-- The session log (rolls have their own table; this is notes, damage, healing and rests)
-- ---------------------------------------------------------------------------------------------

create table public.log_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('note', 'damage', 'heal', 'rest', 'condition', 'stage')),
  text text not null check (char_length(btrim(text)) between 1 and 500),
  -- Shown to players (for the recap later). Notes stay the DM's.
  visible boolean not null default false,
  created_at timestamptz not null default now()
);

create index log_events_campaign_created_idx on public.log_events (campaign_id, created_at desc);
create index log_events_author_id_idx on public.log_events (author_id);

alter table public.log_events enable row level security;
revoke all on public.log_events from anon, authenticated;
grant select, insert, delete on public.log_events to authenticated;

create policy "The DM reads the whole log; players only what's marked visible"
  on public.log_events for select to authenticated
  using (private.is_campaign_dm(campaign_id) or (visible and private.is_campaign_member(campaign_id)));

create policy "Only the DM writes in the log"
  on public.log_events for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id) and author_id = (select auth.uid()));

create policy "Only the DM removes log entries"
  on public.log_events for delete to authenticated
  using (private.is_campaign_dm(campaign_id));

-- ---------------------------------------------------------------------------------------------
-- The library: art (places, moments, people, maps) and sound (music by mood, ambience, effects)
-- ---------------------------------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('art', 'music', 'ambience', 'effect')),
  category text check (category in ('places', 'moments', 'people', 'maps')),
  mood text check (mood in ('tavern', 'travel', 'tension', 'combat', 'boss', 'camp')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- The file in the 'art' or 'audio' bucket, and for art a small thumbnail.
  path text not null check (char_length(path) <= 200),
  thumb_path text check (char_length(thumb_path) <= 200),
  size_bytes integer not null default 0 check (size_bytes >= 0),
  -- Licensed for streaming (such as Envato Elements), so it's safe to play on everyone's channel.
  stream_safe boolean not null default true,
  credit text not null default '' check (char_length(credit) <= 200),
  -- Sound effects sit on keys 1 to 9.
  hotkey smallint check (hotkey between 1 and 9),
  created_at timestamptz not null default now(),
  constraint assets_art_has_category check ((kind = 'art') = (category is not null)),
  constraint assets_music_has_mood check ((kind = 'music') = (mood is not null)),
  constraint assets_hotkeys_for_effects check (hotkey is null or kind = 'effect')
);

create index assets_campaign_kind_idx on public.assets (campaign_id, kind);
create unique index assets_one_effect_per_key on public.assets (campaign_id, hotkey) where hotkey is not null;

-- ---------------------------------------------------------------------------------------------
-- The stage: what everyone sees and hears now
-- ---------------------------------------------------------------------------------------------

create table public.stage (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  -- The one-line "Scene now" in the DM's header.
  scene_name text not null default '' check (char_length(scene_name) <= 80),
  image_id uuid references public.assets (id) on delete set null,
  music_id uuid references public.assets (id) on delete set null,
  music_playing boolean not null default false,
  -- While playing, the track (looping) started at music_started_at; while paused, it stopped at
  -- music_position seconds in. Every browser plays its own copy from the same point.
  music_started_at timestamptz,
  music_position real not null default 0 check (music_position >= 0),
  music_volume real not null default 0.8 check (music_volume between 0 and 1),
  -- Ambience loops and their levels, 0 to 1: {"<asset id>": 0.6}
  ambience jsonb not null default '{}' check (jsonb_typeof(ambience) = 'object' and pg_column_size(ambience) <= 4000),
  updated_at timestamptz not null default now()
);

create index stage_image_id_idx on public.stage (image_id);
create index stage_music_id_idx on public.stage (music_id);

create trigger stage_touch_updated_at
  before update on public.stage
  for each row execute function private.touch_updated_at();

-- The picture on stage at a table, for the rules below. Security definer so the asset rules can
-- look at the stage without the stage rules getting in the way.
create function private.on_stage_image(p_campaign_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.image_id from public.stage s where s.campaign_id = p_campaign_id
$$;

grant execute on function private.on_stage_image(uuid) to authenticated;

alter table public.assets enable row level security;
alter table public.stage enable row level security;

revoke all on public.assets, public.stage from anon, authenticated;
grant select, insert, delete on public.assets to authenticated;
grant update (name, category, mood, stream_safe, credit, hotkey) on public.assets to authenticated;
grant select, insert on public.stage to authenticated;
grant update (
  scene_name, image_id, music_id, music_playing, music_started_at, music_position, music_volume, ambience
) on public.stage to authenticated;

create policy "The DM sees the library; players hear the sounds and see what's on stage"
  on public.assets for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or (
      private.is_campaign_member(campaign_id)
      and (kind <> 'art' or id = private.on_stage_image(campaign_id))
    )
  );

create policy "Only the DM adds to the library"
  on public.assets for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

create policy "Only the DM changes the library"
  on public.assets for update to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

create policy "Only the DM removes from the library"
  on public.assets for delete to authenticated
  using (private.is_campaign_dm(campaign_id));

create policy "Everyone at the table sees the stage"
  on public.stage for select to authenticated
  using (private.is_campaign_member(campaign_id));

create policy "Only the DM sets up the stage"
  on public.stage for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

create policy "Only the DM changes the stage"
  on public.stage for update to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

-- The stage and the log reach everyone allowed to see them straight away.
alter publication supabase_realtime add table public.stage, public.log_events, public.assets;

-- ---------------------------------------------------------------------------------------------
-- Files: art and audio buckets, files at <campaign id>/<anything>
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('art', 'art', false, 8388608, array['image/webp', 'image/jpeg', 'image/png']),
  ('audio', 'audio', false, 15728640, array['audio/mpeg', 'audio/ogg']);

-- Is the caller the DM of the campaign whose folder this file is in?
create function private.is_dm_of_folder(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_real_user() and exists (
    select 1 from public.campaigns c
    where c.id::text = split_part(p_object_name, '/', 1) and c.dm_id = auth.uid()
  )
$$;

-- Can the caller see this picture? The DM, any of their art; players, only the picture on stage.
create function private.can_see_art(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_dm_of_folder(p_object_name) or exists (
    select 1
    from public.stage s
    join public.assets a on a.id = s.image_id
    join public.campaign_members m on m.campaign_id = s.campaign_id and m.user_id = auth.uid()
    where s.campaign_id::text = split_part(p_object_name, '/', 1)
      and p_object_name in (a.path, a.thumb_path)
  )
$$;

grant execute on function private.is_dm_of_folder(text) to authenticated;
grant execute on function private.can_see_art(text) to authenticated;

create policy "The DM sees their art, players only what's on stage"
  on storage.objects for select to authenticated
  using (bucket_id = 'art' and private.can_see_art(name));

-- (The same rule as portraits: anyone at the table whose folder it is.)
create policy "Everyone at the table can play its sounds"
  on storage.objects for select to authenticated
  using (bucket_id = 'audio' and private.can_see_portrait(name));

create policy "Only the DM uploads art and sound"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('art', 'audio') and private.is_dm_of_folder(name));

create policy "Only the DM replaces art and sound"
  on storage.objects for update to authenticated
  using (bucket_id in ('art', 'audio') and private.is_dm_of_folder(name))
  with check (bucket_id in ('art', 'audio') and private.is_dm_of_folder(name));

create policy "Only the DM removes art and sound"
  on storage.objects for delete to authenticated
  using (bucket_id in ('art', 'audio') and private.is_dm_of_folder(name));

-- ---------------------------------------------------------------------------------------------
-- The server's clock, so every browser can start the music from the same moment
-- ---------------------------------------------------------------------------------------------

create function public.server_time()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now()
$$;

revoke execute on function public.server_time() from public, anon;
grant execute on function public.server_time() to authenticated;
