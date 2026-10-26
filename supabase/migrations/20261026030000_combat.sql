-- Milestone 6: fights, turn order, battle maps and tokens.
--
-- Rules enforced here, not just in the screens:
-- * Everyone at the table sees the turn order, but a monster's real name, hit points and armour
--   class live in combatant_secrets, which only the DM can read. Until the DM reveals a monster,
--   players see it as "Unknown creature".
-- * A monster's health reaches players only as a word (healthy, bloodied, near death, down).
-- * Initiative is thrown by the server (roll_initiative), never typed in by a player.
-- * Players see a battle map and its tokens only while it is on stage, and never a hidden token.
-- * Players move only their own character's token, and only while the DM allows it.

-- ---------------------------------------------------------------------------------------------
-- Battle maps on the stage
-- ---------------------------------------------------------------------------------------------

alter table public.stage
  add column map_id uuid references public.assets (id) on delete set null,
  -- What everyone sees: the scene picture, or the battle map.
  add column mode text not null default 'scene' check (mode in ('scene', 'map')),
  add column players_move_tokens boolean not null default true;

create index stage_map_id_idx on public.stage (map_id);
grant update (map_id, mode, players_move_tokens) on public.stage to authenticated;

-- Where the grid sits on a map picture: the size of one 5-foot square, and where the first starts.
alter table public.assets
  add column grid_size smallint not null default 70 check (grid_size between 10 and 400),
  add column grid_offset_x smallint not null default 0 check (grid_offset_x between -400 and 400),
  add column grid_offset_y smallint not null default 0 check (grid_offset_y between -400 and 400);

grant update (grid_size, grid_offset_x, grid_offset_y) on public.assets to authenticated;

-- The battle map players can see: only while it is on stage.
create function private.on_stage_map(p_campaign_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.map_id from public.stage s where s.campaign_id = p_campaign_id and s.mode = 'map'
$$;

grant execute on function private.on_stage_map(uuid) to authenticated;

drop policy "The DM sees the library; players hear the sounds and see what's on stage" on public.assets;
create policy "The DM sees the library; players hear the sounds and see what's on stage"
  on public.assets for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or (
      private.is_campaign_member(campaign_id)
      and (kind <> 'art' or id = private.on_stage_image(campaign_id) or id = private.on_stage_map(campaign_id))
    )
  );

create or replace function private.can_see_art(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_dm_of_folder(p_object_name) or exists (
    select 1
    from public.stage s
    join public.assets a on a.id = s.image_id or (a.id = s.map_id and s.mode = 'map')
    join public.campaign_members m on m.campaign_id = s.campaign_id and m.user_id = auth.uid()
    where s.campaign_id::text = split_part(p_object_name, '/', 1)
      and p_object_name in (a.path, a.thumb_path)
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- Fights
-- ---------------------------------------------------------------------------------------------

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  round smallint not null default 1 check (round between 1 and 999),
  -- Whose turn it is; null until everyone has initiative and the DM starts the first turn.
  current_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index encounters_campaign_idx on public.encounters (campaign_id, started_at desc);
create unique index encounters_one_active on public.encounters (campaign_id) where status = 'active';

create table public.combatants (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('character', 'monster')),
  character_id uuid references public.characters (id) on delete cascade,
  -- What players see: a character's name, or "Unknown creature" for a monster until revealed.
  shown_name text not null check (char_length(btrim(shown_name)) between 1 and 60),
  revealed boolean not null default false,
  initiative smallint check (initiative between -10 and 60),
  -- Breaks ties in initiative: the higher Dexterity goes first.
  tiebreak smallint not null default 10,
  -- A monster's health in words; characters show their real hit points instead.
  health text not null default 'healthy' check (health in ('healthy', 'bloodied', 'near-death', 'down')),
  conditions text[] not null default '{}' check (conditions <@ array[
    'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed',
    'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'
  ]),
  created_at timestamptz not null default now(),
  constraint combatants_character_or_monster check ((kind = 'character') = (character_id is not null))
);

create index combatants_encounter_idx on public.combatants (encounter_id);
create index combatants_campaign_idx on public.combatants (campaign_id);
create index combatants_character_idx on public.combatants (character_id);
create unique index combatants_one_per_character on public.combatants (encounter_id, character_id) where character_id is not null;

alter table public.encounters
  add constraint encounters_current_fkey foreign key (current_id) references public.combatants (id) on delete set null;
create index encounters_current_idx on public.encounters (current_id);

-- A monster's real name and numbers, for the DM only.
create table public.combatant_secrets (
  combatant_id uuid primary key references public.combatants (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- The SRD monster it came from, for its stat block.
  monster text check (char_length(monster) <= 80),
  hp smallint not null default 1 check (hp between 0 and 9999),
  max_hp smallint not null default 1 check (max_hp between 1 and 9999),
  ac smallint not null default 10 check (ac between 1 and 40)
);

create index combatant_secrets_campaign_idx on public.combatant_secrets (campaign_id);

-- ---------------------------------------------------------------------------------------------
-- Tokens on battle maps
-- ---------------------------------------------------------------------------------------------

create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  map_id uuid not null references public.assets (id) on delete cascade,
  character_id uuid references public.characters (id) on delete cascade,
  combatant_id uuid references public.combatants (id) on delete cascade,
  -- Grid squares from the top left of the map.
  x smallint not null default 0 check (x between 0 and 500),
  y smallint not null default 0 check (y between 0 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint tokens_belong_to_someone check (num_nonnulls(character_id, combatant_id) = 1)
);

create index tokens_campaign_map_idx on public.tokens (campaign_id, map_id);
create index tokens_map_idx on public.tokens (map_id);
create index tokens_character_idx on public.tokens (character_id);
create index tokens_combatant_idx on public.tokens (combatant_id);
create unique index tokens_one_per_character_per_map on public.tokens (map_id, character_id) where character_id is not null;

-- Only the DM hides or shows a token, or moves it to another map.
create function private.guard_token_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_campaign_dm(old.campaign_id)
     and (new.hidden is distinct from old.hidden or new.map_id is distinct from old.map_id) then
    raise exception 'Only the DM can hide a token or move it to another map' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger tokens_guard_change
  before update on public.tokens
  for each row execute function private.guard_token_change();

-- Can the caller move this token? The DM any; a player their own character's, while allowed.
create function private.can_move_token(p_campaign_id uuid, p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_campaign_dm(p_campaign_id) or (
    private.is_real_user()
    and p_character_id is not null
    and exists (select 1 from public.characters c where c.id = p_character_id and c.owner_id = auth.uid())
    and coalesce((select s.players_move_tokens from public.stage s where s.campaign_id = p_campaign_id), true)
  )
$$;

grant execute on function private.can_move_token(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Who can see and change what
-- ---------------------------------------------------------------------------------------------

alter table public.encounters enable row level security;
alter table public.combatants enable row level security;
alter table public.combatant_secrets enable row level security;
alter table public.tokens enable row level security;

revoke all on public.encounters, public.combatants, public.combatant_secrets, public.tokens from anon, authenticated;
grant select, insert, delete on public.encounters, public.combatants, public.combatant_secrets, public.tokens to authenticated;
grant update (status, round, current_id, ended_at) on public.encounters to authenticated;
grant update (shown_name, revealed, initiative, tiebreak, health, conditions) on public.combatants to authenticated;
grant update (name, hp, max_hp, ac) on public.combatant_secrets to authenticated;
grant update (x, y, hidden, map_id) on public.tokens to authenticated;

create policy "Everyone at the table sees the fight"
  on public.encounters for select to authenticated
  using (private.is_campaign_member(campaign_id));

create policy "Only the DM starts, runs and ends a fight"
  on public.encounters for all to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

create policy "Everyone at the table sees the turn order"
  on public.combatants for select to authenticated
  using (private.is_campaign_member(campaign_id));

create policy "Only the DM adds, changes and removes combatants"
  on public.combatants for all to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

create policy "Only the DM knows a monster's secrets"
  on public.combatant_secrets for all to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

create policy "The DM sees every token; players those on the map on stage, unless hidden"
  on public.tokens for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or (private.is_campaign_member(campaign_id) and not hidden and map_id = private.on_stage_map(campaign_id))
  );

create policy "Only the DM places and removes tokens"
  on public.tokens for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));

create policy "Only the DM removes tokens"
  on public.tokens for delete to authenticated
  using (private.is_campaign_dm(campaign_id));

create policy "The DM moves any token; players their own, while allowed"
  on public.tokens for update to authenticated
  using (private.can_move_token(campaign_id, character_id) and (not hidden or private.is_campaign_dm(campaign_id)))
  with check (private.can_move_token(campaign_id, character_id));

alter publication supabase_realtime add table public.encounters, public.combatants, public.tokens;

-- ---------------------------------------------------------------------------------------------
-- Initiative, thrown by the server
-- ---------------------------------------------------------------------------------------------

-- Throws initiative for one combatant in the active fight and puts it in the turn order. Players
-- roll for their own character; the DM for anyone (monsters in secret, behind the screen).
-- p_roll is an ordinary roll for throw_dice: one d20 with the initiative bonus.
create function public.roll_initiative(p_combatant_id uuid, p_roll jsonb)
returns public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.combatants;
  v_dm boolean;
  v_roll public.rolls;
  v_dexterity integer;
begin
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where c.id = p_combatant_id;
  if not found then
    raise exception 'That fight is over, or it isn''t at this table' using errcode = '22023';
  end if;
  v_dm := private.is_campaign_dm(v_combatant.campaign_id);

  if v_combatant.kind = 'monster' and not v_dm then
    raise exception 'Only the DM rolls for monsters' using errcode = '42501';
  end if;
  if v_combatant.initiative is not null and not v_dm then
    raise exception 'You have already rolled initiative' using errcode = '23505';
  end if;
  if (p_roll -> 'dice') is distinct from '[{"sides": 20, "count": 1}]'::jsonb then
    raise exception 'Initiative is a single d20' using errcode = '22023';
  end if;

  -- throw_dice checks that the caller may roll for this character.
  v_roll := public.throw_dice(
    v_combatant.campaign_id,
    p_roll
      - 'damage' - 'request_id'
      || jsonb_build_object(
        'kind', 'initiative',
        'label', 'Initiative',
        'character_id', v_combatant.character_id,
        'secret', v_combatant.kind = 'monster'
      )
  );

  if v_combatant.kind = 'character' then
    select c.dexterity into v_dexterity from public.characters c where c.id = v_combatant.character_id;
  end if;

  update public.combatants
  set initiative = v_roll.total, tiebreak = coalesce(v_dexterity, tiebreak)
  where id = p_combatant_id;
  return v_roll;
end
$$;

revoke execute on function public.roll_initiative(uuid, jsonb) from public, anon;
grant execute on function public.roll_initiative(uuid, jsonb) to authenticated;
