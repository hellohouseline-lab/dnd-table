-- Saved campaigns: a campaign file the DM keeps to start any table from (Paste your notes, then
-- Save as a preset). A bought adventure can't go in this public repository, so it lives here, where
-- only the person who saved it can read it. Not tied to one table.

create table public.campaign_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  body text not null check (char_length(body) between 1 and 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

alter table public.campaign_presets enable row level security;
revoke all on public.campaign_presets from anon, authenticated;
grant select, insert, update (name, body, updated_at), delete on public.campaign_presets to authenticated;

create policy "Only you see your saved campaigns"
  on public.campaign_presets for select to authenticated
  using (owner_id = auth.uid());

create policy "You save campaigns for yourself"
  on public.campaign_presets for insert to authenticated
  with check (owner_id = auth.uid() and private.is_real_user());

create policy "You change your own saved campaigns"
  on public.campaign_presets for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "You remove your own saved campaigns"
  on public.campaign_presets for delete to authenticated
  using (owner_id = auth.uid());
