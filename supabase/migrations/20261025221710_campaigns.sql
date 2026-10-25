-- Milestone 1: campaigns, the people at each table, and who may use each table's live channel.
--
-- Rules enforced here, not just in the screens:
-- * You only see a campaign, and the people in it, if you are at that table.
-- * Campaigns are created and joined only through the functions below, and only by people who
--   signed in with their email. Anonymous guest logins (used later by OBS overlays) can do neither.
-- * Only the DM changes the campaign or its join code. Players change only their own row.

-- Helpers live in a schema the website's API does not expose, so they can't be called directly.
create schema if not exists private;
grant usage on schema private to authenticated;

-- True for someone signed in with their email; false for nobody and for anonymous guests.
create function private.is_real_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  dm_id uuid not null references auth.users (id) on delete cascade,
  party_size smallint not null default 4 check (party_size between 1 and 8),
  starting_level smallint not null default 1 check (starting_level between 1 and 20),
  -- Six characters with no look-alikes (no I, O, 0 or 1), so it's easy to read out on a call.
  join_code text not null unique check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('dm', 'player')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  here_tonight boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index campaign_members_user_id_idx on public.campaign_members (user_id);
create unique index campaign_members_one_dm on public.campaign_members (campaign_id) where role = 'dm';

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;

-- Security definer so the table rules below can look up membership without looping back into themselves.
create function private.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = auth.uid()
  )
$$;

create function private.is_campaign_dm(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = p_campaign_id and c.dm_id = auth.uid()
  )
$$;

-- Nobody signed out gets anything. Signed-in people read through the rules below, and may only
-- change the columns granted here; everything else goes through the functions further down.
revoke all on public.campaigns, public.campaign_members from anon, authenticated;
grant select, delete on public.campaigns to authenticated;
grant update (name, party_size, starting_level) on public.campaigns to authenticated;
grant select, delete on public.campaign_members to authenticated;
grant update (display_name, here_tonight) on public.campaign_members to authenticated;

grant execute on function private.is_real_user() to authenticated;
grant execute on function private.is_campaign_member(uuid) to authenticated;
grant execute on function private.is_campaign_dm(uuid) to authenticated;

-- campaigns

create policy "Members can see their campaigns"
  on public.campaigns for select to authenticated
  using (private.is_campaign_member(id));

create policy "The DM can change the campaign"
  on public.campaigns for update to authenticated
  using (dm_id = (select auth.uid()))
  with check (dm_id = (select auth.uid()));

create policy "The DM can delete the campaign"
  on public.campaigns for delete to authenticated
  using (dm_id = (select auth.uid()));

-- campaign_members

create policy "Members can see who else is at the table"
  on public.campaign_members for select to authenticated
  using (private.is_campaign_member(campaign_id));

create policy "Members change their own row and the DM changes any"
  on public.campaign_members for update to authenticated
  using (user_id = (select auth.uid()) or private.is_campaign_dm(campaign_id))
  with check (user_id = (select auth.uid()) or private.is_campaign_dm(campaign_id));

create policy "The DM can remove players and players can leave"
  on public.campaign_members for delete to authenticated
  using (role = 'player' and (user_id = (select auth.uid()) or private.is_campaign_dm(campaign_id)));

-- ---------------------------------------------------------------------------------------------
-- Join codes
-- ---------------------------------------------------------------------------------------------

-- A fresh, unused code. 32 letters and digits, picked with secure random bytes (256 is a
-- multiple of 32, so every character is equally likely).
create function private.new_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.campaigns where join_code = code);
  end loop;
  return code;
end
$$;

revoke execute on function private.new_join_code() from public;

-- What people type is forgiving: 'k7q-m2p' and 'K7Q M2P' both mean K7QM2P.
create function private.normalise_join_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

grant execute on function private.normalise_join_code(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Functions the website calls
-- ---------------------------------------------------------------------------------------------

-- Starts a campaign with the caller as its DM. Returns the new campaign's id.
create function public.create_campaign(
  p_name text,
  p_dm_name text,
  p_party_size integer default 4,
  p_starting_level integer default 1
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_real_user() then
    raise exception 'Sign in with your email to start a campaign' using errcode = '42501';
  end if;

  insert into public.campaigns (name, dm_id, party_size, starting_level, join_code)
  values (btrim(p_name), auth.uid(), p_party_size, p_starting_level, private.new_join_code())
  returning id into v_id;

  insert into public.campaign_members (campaign_id, user_id, role, display_name)
  values (v_id, auth.uid(), 'dm', btrim(p_dm_name));

  return v_id;
end
$$;

-- Lets someone with a join code see which table it opens before they join.
create function public.peek_campaign(p_code text)
returns table (name text, dm_name text, party_size smallint, starting_level smallint, already_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, m.display_name, c.party_size, c.starting_level, private.is_campaign_member(c.id)
  from public.campaigns c
  join public.campaign_members m on m.campaign_id = c.id and m.role = 'dm'
  where c.join_code = private.normalise_join_code(p_code)
    and private.is_real_user()
$$;

-- Joins the table that the code belongs to, as a player. Joining twice is harmless.
create function public.join_campaign(p_code text, p_display_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_real_user() then
    raise exception 'Sign in with your email to join a table' using errcode = '42501';
  end if;

  select id into v_id from public.campaigns where join_code = private.normalise_join_code(p_code);
  if v_id is null then
    raise exception 'That code doesn''t match a table' using errcode = 'P0002';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role, display_name)
  values (v_id, auth.uid(), 'player', btrim(p_display_name))
  on conflict (campaign_id, user_id) do nothing;

  return v_id;
end
$$;

-- Swaps the join code for a new one, so the old code and invite link stop working. DM only.
create function public.renew_join_code(p_campaign_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the DM can change the join code' using errcode = '42501';
  end if;

  v_code := private.new_join_code();
  update public.campaigns set join_code = v_code where id = p_campaign_id;
  return v_code;
end
$$;

revoke execute on function public.create_campaign(text, text, integer, integer) from public, anon;
revoke execute on function public.peek_campaign(text) from public, anon;
revoke execute on function public.join_campaign(text, text) from public, anon;
revoke execute on function public.renew_join_code(uuid) from public, anon;
grant execute on function public.create_campaign(text, text, integer, integer) to authenticated;
grant execute on function public.peek_campaign(text) to authenticated;
grant execute on function public.join_campaign(text, text) to authenticated;
grant execute on function public.renew_join_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Live channel: one private channel per campaign, named 'campaign:<campaign id>'
-- ---------------------------------------------------------------------------------------------

-- Only people at the table may listen or send (presence now; dice, pings and sounds later).
-- Any other topic, including DM-only ones added later, is refused until a rule allows it.
create function private.can_use_campaign_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_topic like 'campaign:%'
     and exists (
       select 1 from public.campaign_members m
       where m.campaign_id::text = substr(p_topic, length('campaign:') + 1)
         and m.user_id = auth.uid()
     )
$$;

grant execute on function private.can_use_campaign_topic(text) to authenticated;

create policy "Campaign members can listen on their table's channel"
  on realtime.messages for select to authenticated
  using (private.can_use_campaign_topic((select realtime.topic())));

create policy "Campaign members can send on their table's channel"
  on realtime.messages for insert to authenticated
  with check (private.can_use_campaign_topic((select realtime.topic())));
