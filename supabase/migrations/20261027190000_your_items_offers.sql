-- I1a+ (docs/I1_PLAN.md, decisions 51 and 52):
--   * Your items: things the DM makes once (a name, a description, tags, key item or not) and
--     gives whenever. Only the DM can see them; a player sees one only once it's in their pack.
--   * Items carry a note (what a DM's item or an odd find is), kept when given or handed over.
--   * Offers: the DM offers coins for something a player carries; the player sells or says no.

create table public.dm_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  type text not null default 'other' check (type in (
    'weapons', 'armour', 'potions', 'rings', 'amulets', 'cloaks', 'boots-gloves', 'belts', 'headwear',
    'bags', 'wands', 'staffs-rods', 'scrolls', 'tools', 'gear', 'other')),
  rarity text check (rarity in ('Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary')),
  key boolean not null default false,
  created_at timestamptz not null default now()
);

create index dm_items_campaign_idx on public.dm_items (campaign_id, created_at);

alter table public.dm_items enable row level security;
revoke all on public.dm_items from anon, authenticated;
grant select, insert, update (name, description, type, rarity, key), delete on public.dm_items to authenticated;

create policy "Only the DM sees their own items"
  on public.dm_items for select to authenticated
  using (private.is_campaign_dm(campaign_id));
create policy "Only the DM makes items"
  on public.dm_items for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));
create policy "Only the DM changes their items"
  on public.dm_items for update to authenticated
  using (private.is_campaign_dm(campaign_id))
  with check (private.is_campaign_dm(campaign_id));
create policy "Only the DM throws their items away"
  on public.dm_items for delete to authenticated
  using (private.is_campaign_dm(campaign_id));

-- Gifts keep their note.
create or replace function private.clean_items(p_items jsonb)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', left(replace(gen_random_uuid()::text, '-', ''), 8),
    'item', case when jsonb_typeof(i -> 'item') = 'string' then left(i ->> 'item', 80) end,
    'name', left(btrim(i ->> 'name'), 60),
    'quantity', greatest(1, least(999, coalesce((i ->> 'quantity')::integer, 1))),
    'weight', greatest(0, least(1000, coalesce((i ->> 'weight')::numeric, 0))),
    'worn', false,
    'uses', case when jsonb_typeof(i -> 'uses') = 'number' then greatest(0, (i ->> 'uses')::integer) end,
    'magic', case when jsonb_typeof(i -> 'magic') = 'string' then left(i ->> 'magic', 80) end,
    'bonus', case when (i ->> 'bonus')::integer between 1 and 3 then (i ->> 'bonus')::integer end,
    'attune', case when (i ->> 'attune')::boolean then true end,
    'attuned', case when (i ->> 'attune')::boolean then false end,
    'note', case when jsonb_typeof(i -> 'note') = 'string' and btrim(i ->> 'note') <> '' then left(i ->> 'note', 1000) end
  ))), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
  where jsonb_typeof(i) = 'object' and char_length(btrim(coalesce(i ->> 'name', ''))) > 0
$$;

-- Offers.

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  item_id text not null,
  item_name text not null,
  quantity integer not null check (quantity between 1 and 999),
  copper integer not null check (copper between 0 and 10000000),
  status text not null default 'open' check (status in ('open', 'sold', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index offers_campaign_idx on public.offers (campaign_id, created_at desc);
create index offers_character_idx on public.offers (character_id);

alter table public.offers enable row level security;
revoke all on public.offers from anon, authenticated;
grant select on public.offers to authenticated;

create policy "The DM sees every offer; a player, the ones for their character"
  on public.offers for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or exists (select 1 from public.characters ch where ch.id = character_id and ch.owner_id = (select auth.uid()))
  );

alter publication supabase_realtime add table public.offers;

-- The DM offers coins (in copper) for some of something a character carries.
create function public.make_offer(p_character_id uuid, p_item_id text, p_quantity integer, p_copper integer)
returns public.offers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_character public.characters;
  v_item jsonb;
  v_offer public.offers;
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or not private.is_campaign_dm(v_character.campaign_id) then
    raise exception 'Only the DM can make offers' using errcode = '42501';
  end if;
  select e into v_item from jsonb_array_elements(v_character.inventory) e where e ->> 'id' = p_item_id;
  if v_item is null then
    raise exception '% doesn''t have that', v_character.name using errcode = '22023';
  end if;
  if coalesce(p_copper, -1) < 0 or p_copper > 10000000 then
    raise exception 'Say how much you''ll pay' using errcode = '22023';
  end if;
  -- One open offer for a thing at a time: a new one replaces it.
  update public.offers set status = 'withdrawn', answered_at = now()
  where character_id = p_character_id and item_id = p_item_id and status = 'open';
  insert into public.offers (campaign_id, character_id, item_id, item_name, quantity, copper)
  values (v_character.campaign_id, p_character_id, p_item_id, left(v_item ->> 'name', 60),
    least(greatest(1, coalesce(p_quantity, 1)), coalesce((v_item ->> 'quantity')::integer, 1)), p_copper)
  returning * into v_offer;
  return v_offer;
end;
$$;

create function public.withdraw_offer(p_offer_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.offers set status = 'withdrawn', answered_at = now()
  where id = p_offer_id and status = 'open' and private.is_campaign_dm(campaign_id);
end;
$$;

-- The player sells (the thing leaves their pack and the coins arrive) or says no.
create function public.answer_offer(p_offer_id uuid, p_sell boolean)
returns public.offers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_character public.characters;
  v_item jsonb;
  v_inventory jsonb;
  v_attacks jsonb;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'That offer has gone' using errcode = '22023';
  end if;
  select * into v_character from public.characters where id = v_offer.character_id;
  if v_character.owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the player can answer an offer for their things' using errcode = '42501';
  end if;
  if v_offer.status <> 'open' then
    raise exception 'That offer has gone' using errcode = '22023';
  end if;

  if not coalesce(p_sell, false) then
    update public.offers set status = 'declined', answered_at = now() where id = p_offer_id returning * into v_offer;
    return v_offer;
  end if;

  select e into v_item from jsonb_array_elements(v_character.inventory) e where e ->> 'id' = v_offer.item_id;
  if v_item is null or coalesce((v_item ->> 'quantity')::integer, 0) < v_offer.quantity then
    raise exception 'You don''t have that any more' using errcode = '22023';
  end if;
  if coalesce((v_item ->> 'worn')::boolean, false) then
    raise exception 'Take it off first' using errcode = '22023';
  end if;

  v_inventory := coalesce((
    select jsonb_agg(case when e ->> 'id' = v_offer.item_id
      then e || jsonb_build_object('quantity', (e ->> 'quantity')::integer - v_offer.quantity) else e end)
    from jsonb_array_elements(v_character.inventory) e
    where not (e ->> 'id' = v_offer.item_id and (e ->> 'quantity')::integer <= v_offer.quantity)
  ), '[]'::jsonb);
  v_attacks := v_character.attacks;
  if not exists (
    select 1 from jsonb_array_elements(v_inventory) e
    where e ->> 'item' is not distinct from v_item ->> 'item'
      and coalesce(e ->> 'bonus', '0') = coalesce(v_item ->> 'bonus', '0')
  ) then
    v_attacks := coalesce((
      select jsonb_agg(a) from jsonb_array_elements(v_character.attacks) a
      where not (a ->> 'weapon' is not distinct from v_item ->> 'item'
        and coalesce((a ->> 'magicBonus')::integer, 0) = coalesce((v_item ->> 'bonus')::integer, 0))
    ), '[]'::jsonb);
  end if;

  update public.characters
  set inventory = v_inventory, attacks = v_attacks,
      wallet = private.add_wallets(wallet, private.coins_for(v_offer.copper))
  where id = v_character.id;
  update public.offers set status = 'sold', answered_at = now() where id = p_offer_id returning * into v_offer;

  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_offer.campaign_id, 'gift',
    left(v_character.name || ' sold ' || case when v_offer.quantity > 1 then v_offer.quantity || ' × ' else '' end
      || v_offer.item_name || ' for ' || coalesce(private.coin_words(v_offer.copper), 'nothing'), 500),
    true,
    jsonb_build_object('from', v_character.id, 'copper', v_offer.copper));
  return v_offer;
end;
$$;

revoke execute on function public.make_offer(uuid, text, integer, integer) from public, anon;
grant execute on function public.make_offer(uuid, text, integer, integer) to authenticated;
revoke execute on function public.withdraw_offer(uuid) from public, anon;
grant execute on function public.withdraw_offer(uuid) to authenticated;
revoke execute on function public.answer_offer(uuid, boolean) from public, anon;
grant execute on function public.answer_offer(uuid, boolean) to authenticated;
