-- S1c (docs/S1_PLAN.md section 3): the DM's people. An NPC has a portrait, a role, a voice, what
-- they want, know and hide, and how they feel about the party; scenes list who's there. All of it
-- is the DM's alone. Show an NPC puts only their portrait, name and role on stage for everyone.
-- Also (Matt's ask): the DM takes things away from a character.

create table public.npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  role text not null default '' check (char_length(role) <= 80),
  place text not null default '' check (char_length(place) <= 120),
  portrait_id uuid references public.assets (id) on delete set null,
  voice text not null default '' check (char_length(voice) <= 500),
  wants text not null default '' check (char_length(wants) <= 1000),
  knows text not null default '' check (char_length(knows) <= 2000),
  secrets text not null default '' check (char_length(secrets) <= 2000),
  attitude text not null default 'neutral' check (attitude in ('friendly', 'warm', 'neutral', 'wary', 'hostile')),
  shop_id uuid references public.shops (id) on delete set null,
  created_at timestamptz not null default now()
);

create index npcs_campaign_idx on public.npcs (campaign_id, name);
create index npcs_portrait_idx on public.npcs (portrait_id);
create index npcs_shop_idx on public.npcs (shop_id);

alter table public.npcs enable row level security;
revoke all on public.npcs from anon, authenticated;
grant select, insert,
  update (name, role, place, portrait_id, voice, wants, knows, secrets, attitude, shop_id),
  delete on public.npcs to authenticated;

create policy "Only the DM reads their people" on public.npcs for select to authenticated
  using (private.is_campaign_dm(campaign_id));
create policy "Only the DM makes people" on public.npcs for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));
create policy "Only the DM changes people" on public.npcs for update to authenticated
  using (private.is_campaign_dm(campaign_id)) with check (private.is_campaign_dm(campaign_id));
create policy "Only the DM removes people" on public.npcs for delete to authenticated
  using (private.is_campaign_dm(campaign_id));

-- Who's in each scene.
alter table public.story_scenes add column people jsonb not null default '[]'::jsonb check (jsonb_typeof(people) = 'array');
grant update (people) on public.story_scenes to authenticated;

-- The person on stage: only what players may see.
alter table public.stage
  add column npc_name text not null default '' check (char_length(npc_name) <= 80),
  add column npc_role text not null default '' check (char_length(npc_role) <= 80),
  add column npc_image_id uuid references public.assets (id) on delete set null;
create index stage_npc_image_id_idx on public.stage (npc_image_id);
grant update (npc_name, npc_role, npc_image_id) on public.stage to authenticated;

-- Players may see a shown person's portrait, as they may the picture or map on stage.
create function private.on_stage_npc(p_campaign_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.npc_image_id from public.stage s where s.campaign_id = p_campaign_id
$$;

grant execute on function private.on_stage_npc(uuid) to authenticated;

drop policy "The DM sees the library; players hear the sounds and see what's on stage" on public.assets;
create policy "The DM sees the library; players hear the sounds and see what's on stage"
  on public.assets for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or (
      private.is_campaign_member(campaign_id)
      and (
        kind <> 'art'
        or id = private.on_stage_image(campaign_id)
        or id = private.on_stage_map(campaign_id)
        or id = private.on_stage_npc(campaign_id)
      )
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
    join public.assets a on a.id = s.image_id or (a.id = s.map_id and s.mode = 'map') or a.id = s.npc_image_id
    join public.campaign_members m on m.campaign_id = s.campaign_id and m.user_id = auth.uid()
    where s.campaign_id::text = split_part(p_object_name, '/', 1)
      and p_object_name in (a.path, a.thumb_path)
  )
$$;

-- The DM takes something (or some of a stack) away from a character.
create function public.take_items(p_character_id uuid, p_item_id text, p_quantity integer)
returns public.characters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_character public.characters;
  v_item jsonb;
  v_quantity integer;
  v_inventory jsonb;
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or not private.is_campaign_dm(v_character.campaign_id) then
    raise exception 'Only the DM can take things away' using errcode = '42501';
  end if;
  select e into v_item from jsonb_array_elements(v_character.inventory) e where e ->> 'id' = p_item_id;
  if v_item is null then
    raise exception '% doesn''t have that', v_character.name using errcode = '22023';
  end if;
  v_quantity := least(greatest(1, coalesce(p_quantity, 1)), coalesce((v_item ->> 'quantity')::integer, 1));
  v_inventory := private.inventory_without(v_character.inventory, p_item_id, v_quantity);
  update public.characters
  set inventory = v_inventory,
      attacks = private.attacks_still_carried(attacks, v_inventory, v_item)
  where id = p_character_id
  returning * into v_character;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_character.campaign_id, 'gift',
    left(v_character.name || ' no longer has ' ||
      case when v_quantity > 1 then v_quantity || ' × ' else '' end || (v_item ->> 'name'), 500),
    true, jsonb_build_object('from', v_character.id, 'copper', 0));
  return v_character;
end;
$$;

revoke execute on function public.take_items(uuid, text, integer) from public, anon;
grant execute on function public.take_items(uuid, text, integer) to authenticated;
