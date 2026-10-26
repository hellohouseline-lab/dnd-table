-- S1a: story mode (docs/S1_PLAN.md). Chapters and scenes are the DM's alone: a scene has its read-
-- aloud, reminders, picture, music and ambience. The notebook remembers where the party is. The
-- stage can show a scene's read-aloud on parchment when the DM chooses (decision 56).

create table public.story_chapters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index story_chapters_campaign_idx on public.story_chapters (campaign_id, position);

create table public.story_scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  chapter_id uuid not null references public.story_chapters (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  place text not null default '' check (char_length(place) <= 120),
  read_aloud text not null default '' check (char_length(read_aloud) <= 8000),
  reminders text not null default '' check (char_length(reminders) <= 8000),
  image_id uuid references public.assets (id) on delete set null,
  music_id uuid references public.assets (id) on delete set null,
  ambience jsonb not null default '{}'::jsonb check (jsonb_typeof(ambience) = 'object'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index story_scenes_campaign_idx on public.story_scenes (campaign_id);
create index story_scenes_chapter_idx on public.story_scenes (chapter_id, position);
create index story_scenes_image_idx on public.story_scenes (image_id);
create index story_scenes_music_idx on public.story_scenes (music_id);

alter table public.story_chapters enable row level security;
alter table public.story_scenes enable row level security;
revoke all on public.story_chapters, public.story_scenes from anon, authenticated;
grant select, insert, update (title, position), delete on public.story_chapters to authenticated;
grant select, insert,
  update (chapter_id, title, place, read_aloud, reminders, image_id, music_id, ambience, position, updated_at),
  delete on public.story_scenes to authenticated;

create policy "Only the DM reads the story" on public.story_chapters for select to authenticated
  using (private.is_campaign_dm(campaign_id));
create policy "Only the DM writes chapters" on public.story_chapters for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));
create policy "Only the DM changes chapters" on public.story_chapters for update to authenticated
  using (private.is_campaign_dm(campaign_id)) with check (private.is_campaign_dm(campaign_id));
create policy "Only the DM removes chapters" on public.story_chapters for delete to authenticated
  using (private.is_campaign_dm(campaign_id));

create policy "Only the DM reads scenes" on public.story_scenes for select to authenticated
  using (private.is_campaign_dm(campaign_id));
create policy "Only the DM writes scenes" on public.story_scenes for insert to authenticated
  with check (
    private.is_real_user() and private.is_campaign_dm(campaign_id)
    and exists (select 1 from public.story_chapters c where c.id = chapter_id and c.campaign_id = story_scenes.campaign_id)
  );
create policy "Only the DM changes scenes" on public.story_scenes for update to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (
    private.is_campaign_dm(campaign_id)
    and exists (select 1 from public.story_chapters c where c.id = chapter_id and c.campaign_id = story_scenes.campaign_id)
  );
create policy "Only the DM removes scenes" on public.story_scenes for delete to authenticated
  using (private.is_campaign_dm(campaign_id));

-- Where the party is now, in the DM's notebook.
alter table public.dm_notebooks add column current_scene_id uuid references public.story_scenes (id) on delete set null;
create index dm_notebooks_current_scene_idx on public.dm_notebooks (current_scene_id);
grant update (current_scene_id) on public.dm_notebooks to authenticated;

-- The read-aloud on stage, for everyone, when the DM shows it.
alter table public.stage add column read_aloud text not null default '' check (char_length(read_aloud) <= 8000);
grant update (read_aloud) on public.stage to authenticated;
