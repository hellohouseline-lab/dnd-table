-- Milestone 2: character sheets and portraits.
--
-- Rules enforced here, not just in the screens:
-- * Everyone at a table can see the party's characters (the table shows each other's HP and AC).
-- * Players create and change only their own character; the DM can create and change any in
--   their campaign. A character always stays with its campaign and its player.
-- * One character per player per campaign in Phase 1.
-- * Portraits sit in a private bucket that only people at that table can read.

-- Is this user (not necessarily the caller) at that table? Used to check a character's player.
create function private.is_member(p_campaign_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = p_user_id
  )
$$;

grant execute on function private.is_member(uuid, uuid) to authenticated;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,

  -- Who they are
  name text not null check (char_length(btrim(name)) between 1 and 60),
  race text not null default '' check (char_length(race) <= 60),
  subrace text not null default '' check (char_length(subrace) <= 60),
  class text not null default '' check (char_length(class) <= 60),
  subclass text not null default '' check (char_length(subclass) <= 60),
  background text not null default '' check (char_length(background) <= 60),
  level smallint not null default 1 check (level between 1 and 20),

  -- Ability scores, as typed in (racial bonuses included)
  strength smallint not null default 10 check (strength between 1 and 30),
  dexterity smallint not null default 10 check (dexterity between 1 and 30),
  constitution smallint not null default 10 check (constitution between 1 and 30),
  intelligence smallint not null default 10 check (intelligence between 1 and 30),
  wisdom smallint not null default 10 check (wisdom between 1 and 30),
  charisma smallint not null default 10 check (charisma between 1 and 30),

  -- Hit points, armour and speed
  max_hp smallint not null default 8 check (max_hp between 1 and 999),
  current_hp smallint not null default 8 check (current_hp between 0 and 999),
  temp_hp smallint not null default 0 check (temp_hp between 0 and 999),
  armour_class smallint not null default 10 check (armour_class between 1 and 40),
  speed smallint not null default 30 check (speed between 0 and 200),
  hit_die smallint not null default 8 check (hit_die in (6, 8, 10, 12)),
  hit_dice_used smallint not null default 0 check (hit_dice_used between 0 and 20),

  -- Proficiencies
  save_proficiencies text[] not null default '{}' check (
    save_proficiencies <@ array['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
  ),
  skill_proficiencies text[] not null default '{}' check (skill_proficiencies <@ array[
    'acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation',
    'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion',
    'sleight-of-hand', 'stealth', 'survival'
  ]),
  skill_expertise text[] not null default '{}',
  other_proficiencies text not null default '' check (char_length(other_proficiencies) <= 2000),
  languages text not null default '' check (char_length(languages) <= 500),

  -- Lists kept as JSON: attacks, features with uses, and spellcasting (slots and spells)
  attacks jsonb not null default '[]' check (jsonb_typeof(attacks) = 'array' and pg_column_size(attacks) <= 20000),
  features jsonb not null default '[]' check (jsonb_typeof(features) = 'array' and pg_column_size(features) <= 200000),
  spellcasting jsonb not null default '{}' check (
    jsonb_typeof(spellcasting) = 'object' and pg_column_size(spellcasting) <= 50000
  ),

  -- Trackers that change during play
  death_save_successes smallint not null default 0 check (death_save_successes between 0 and 3),
  death_save_failures smallint not null default 0 check (death_save_failures between 0 and 3),
  conditions text[] not null default '{}' check (conditions <@ array[
    'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed',
    'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'
  ]),
  exhaustion smallint not null default 0 check (exhaustion between 0 and 6),
  inspiration boolean not null default false,
  concentration text check (char_length(concentration) <= 80),

  portrait_path text check (char_length(portrait_path) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint characters_hp_within_max check (current_hp <= max_hp),
  -- Expertise doubles a proficiency, so it only applies to skills you're proficient in.
  constraint characters_expertise_needs_proficiency check (skill_expertise <@ skill_proficiencies),
  constraint characters_one_per_player unique (campaign_id, owner_id)
);

create index characters_owner_id_idx on public.characters (owner_id);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger characters_touch_updated_at
  before update on public.characters
  for each row execute function private.touch_updated_at();

alter table public.characters enable row level security;

-- Everything but which campaign and player a character belongs to can be changed.
revoke all on public.characters from anon, authenticated;
grant select, insert, delete on public.characters to authenticated;
grant update (
  name, race, subrace, class, subclass, background, level,
  strength, dexterity, constitution, intelligence, wisdom, charisma,
  max_hp, current_hp, temp_hp, armour_class, speed, hit_die, hit_dice_used,
  save_proficiencies, skill_proficiencies, skill_expertise, other_proficiencies, languages,
  attacks, features, spellcasting,
  death_save_successes, death_save_failures, conditions, exhaustion, inspiration, concentration,
  portrait_path
) on public.characters to authenticated;

create policy "Everyone at the table can see the party"
  on public.characters for select to authenticated
  using (private.is_campaign_member(campaign_id));

create policy "Players add their own character and the DM adds any"
  on public.characters for insert to authenticated
  with check (
    private.is_real_user()
    and private.is_member(campaign_id, owner_id)
    and (owner_id = (select auth.uid()) or private.is_campaign_dm(campaign_id))
  );

create policy "Players change their own character and the DM changes any"
  on public.characters for update to authenticated
  using (owner_id = (select auth.uid()) or private.is_campaign_dm(campaign_id))
  with check (owner_id = (select auth.uid()) or private.is_campaign_dm(campaign_id));

create policy "Players delete their own character and the DM deletes any"
  on public.characters for delete to authenticated
  using (owner_id = (select auth.uid()) or private.is_campaign_dm(campaign_id));

-- Changes reach everyone at the table straight away (the database rules above decide who hears them).
alter publication supabase_realtime add table public.characters;

-- ---------------------------------------------------------------------------------------------
-- Portraits: private bucket, files at <campaign id>/<character id>/<anything>.webp
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits', 'portraits', false, 2097152, array['image/webp', 'image/png', 'image/jpeg']);

-- Can the caller see files under this campaign's folder?
create function private.can_see_portrait(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id::text = split_part(p_object_name, '/', 1) and m.user_id = auth.uid()
  )
$$;

-- Can the caller change this character's portrait? (Its player, or the DM.)
create function private.can_change_portrait(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_real_user() and exists (
    select 1 from public.characters c
    where c.campaign_id::text = split_part(p_object_name, '/', 1)
      and c.id::text = split_part(p_object_name, '/', 2)
      and (c.owner_id = auth.uid() or private.is_campaign_dm(c.campaign_id))
  )
$$;

grant execute on function private.can_see_portrait(text) to authenticated;
grant execute on function private.can_change_portrait(text) to authenticated;

create policy "People at the table can see its portraits"
  on storage.objects for select to authenticated
  using (bucket_id = 'portraits' and private.can_see_portrait(name));

create policy "Players upload their own portrait and the DM any"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portraits' and private.can_change_portrait(name));

create policy "Players replace their own portrait and the DM any"
  on storage.objects for update to authenticated
  using (bucket_id = 'portraits' and private.can_change_portrait(name))
  with check (bucket_id = 'portraits' and private.can_change_portrait(name));

create policy "Players remove their own portrait and the DM any"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portraits' and private.can_change_portrait(name));
