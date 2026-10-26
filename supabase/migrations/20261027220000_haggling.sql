-- Haggling (Matt's ask after I1c): a player offers their own price for something on a shop's
-- shelves, perhaps after a Persuasion check. The DM agrees (the sale goes through at that price),
-- says no, or names a counter-price for the player to take or leave.

create table public.haggles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  stock_id text not null,
  item_name text not null,
  bundles integer not null check (bundles between 1 and 999),
  -- The shop's price for them all, the player's offer, and the DM's counter-price (copper).
  asking integer not null check (asking >= 0),
  offer integer not null check (offer between 0 and 10000000),
  counter integer check (counter between 0 and 10000000),
  -- Whether they're trained with it, if it's a weapon, for its card in their hand.
  proficient boolean,
  status text not null default 'open' check (status in ('open', 'countered', 'agreed', 'refused', 'withdrawn')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index haggles_campaign_idx on public.haggles (campaign_id, created_at desc);
create index haggles_character_idx on public.haggles (character_id);
create index haggles_shop_idx on public.haggles (shop_id);

alter table public.haggles enable row level security;
revoke all on public.haggles from anon, authenticated;
grant select on public.haggles to authenticated;
create policy "The DM sees every haggle; a player, their own"
  on public.haggles for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or exists (select 1 from public.characters ch where ch.id = character_id and ch.owner_id = (select auth.uid()))
  );

alter publication supabase_realtime add table public.haggles;

-- Buying a shelf line for a set total: shared by buying at the shop's price and by a haggle.
create function private.buy_line(p_shop public.shops, p_line jsonb, p_bundles integer, p_character public.characters,
  p_total integer, p_proficient boolean)
returns public.sales
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_after jsonb;
  v_moved jsonb;
  v_sale public.sales;
begin
  if (p_line ->> 'quantity') is not null and (p_line ->> 'quantity')::integer < p_bundles then
    raise exception 'They only have % left', (p_line ->> 'quantity') using errcode = '22023';
  end if;
  v_after := private.pay(p_character.wallet, p_total);
  if v_after is null then
    raise exception 'That costs %, and you have %', coalesce(private.coin_words(p_total), 'nothing'),
      coalesce(private.coin_words(private.wallet_copper(p_character.wallet)), 'no coins') using errcode = '22023';
  end if;

  v_moved := private.clean_items(jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'item', p_line -> 'item',
    'name', regexp_replace(p_line ->> 'name', ' \(\d+\)$', ''),
    'quantity', p_bundles * coalesce((p_line ->> 'bundle')::integer, 1),
    'weight', p_line -> 'weight',
    'uses', case when p_line ->> 'item' = 'healers-kit' then 10 end,
    'magic', p_line -> 'magic',
    'bonus', p_line -> 'bonus',
    'attune', p_line -> 'attune',
    'note', p_line -> 'note'
  ))));

  update public.characters
  set inventory = private.merge_items(inventory, v_moved),
      wallet = v_after,
      attacks = case when p_proficient is not null then private.add_attack(attacks, v_moved -> 0, p_proficient) else attacks end
  where id = p_character.id;
  if (p_line ->> 'quantity') is not null then
    update public.shops
    set stock = (select jsonb_agg(case when e ->> 'id' = p_line ->> 'id'
          then e || jsonb_build_object('quantity', (e ->> 'quantity')::integer - p_bundles) else e end)
        from jsonb_array_elements(stock) e),
        updated_at = now()
    where id = p_shop.id;
  end if;

  insert into public.sales (campaign_id, shop_id, character_id, kind, item, stock_id, quantity, copper)
  values (p_shop.campaign_id, p_shop.id, p_character.id, 'buy', v_moved -> 0, p_line ->> 'id', p_bundles, p_total)
  returning * into v_sale;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (p_shop.campaign_id, 'gift',
    left(p_character.name || ' bought ' || private.items_words(v_moved) || ' for ' || coalesce(private.coin_words(p_total), 'nothing'), 500),
    true, jsonb_build_object('shop', p_shop.id, 'by', p_character.id, 'copper', p_total));
  return v_sale;
end;
$$;

-- Buying at the shop's price now goes through the shared step.
create or replace function public.buy_item(p_shop_id uuid, p_stock_id text, p_bundles integer, p_character_id uuid, p_proficient boolean)
returns public.sales
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop public.shops;
  v_character public.characters;
  v_line jsonb;
  v_bundles integer := greatest(1, coalesce(p_bundles, 1));
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or not (v_character.owner_id = (select auth.uid()) or private.is_campaign_dm(v_character.campaign_id)) then
    raise exception 'You can only buy for your own character' using errcode = '42501';
  end if;
  select * into v_shop from public.shops where id = p_shop_id and campaign_id = v_character.campaign_id for update;
  if not found or not v_shop.open then
    raise exception 'The shop is closed' using errcode = '22023';
  end if;
  select e into v_line from jsonb_array_elements(v_shop.stock) e where e ->> 'id' = p_stock_id;
  if v_line is null then
    raise exception 'That''s not on the shelves any more' using errcode = '22023';
  end if;
  if (v_line ->> 'price') is null and coalesce((v_line ->> 'cost')::integer, 0) = 0 and (v_line ->> 'magic') is not null then
    raise exception 'That isn''t for sale yet' using errcode = '22023';
  end if;
  return private.buy_line(v_shop, v_line, v_bundles, v_character, private.line_price(v_line, v_shop.markup) * v_bundles, p_proficient);
end;
$$;

-- A player offers their own price for some bundles of a shelf line.
create function public.haggle(p_shop_id uuid, p_stock_id text, p_bundles integer, p_character_id uuid, p_offer integer,
  p_proficient boolean)
returns public.haggles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop public.shops;
  v_character public.characters;
  v_line jsonb;
  v_bundles integer := greatest(1, coalesce(p_bundles, 1));
  v_haggle public.haggles;
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or v_character.owner_id is distinct from (select auth.uid()) then
    raise exception 'You can only haggle for your own character' using errcode = '42501';
  end if;
  select * into v_shop from public.shops where id = p_shop_id and campaign_id = v_character.campaign_id;
  if not found or not v_shop.open then
    raise exception 'The shop is closed' using errcode = '22023';
  end if;
  select e into v_line from jsonb_array_elements(v_shop.stock) e where e ->> 'id' = p_stock_id;
  if v_line is null then
    raise exception 'That''s not on the shelves any more' using errcode = '22023';
  end if;
  if coalesce(p_offer, -1) < 0 then
    raise exception 'Say what you''ll pay' using errcode = '22023';
  end if;
  -- One open haggle for a thing at a time: a new offer replaces it.
  update public.haggles set status = 'withdrawn', answered_at = now()
  where character_id = p_character_id and stock_id = p_stock_id and status in ('open', 'countered');
  insert into public.haggles (campaign_id, shop_id, character_id, stock_id, item_name, bundles, asking, offer, proficient)
  values (v_shop.campaign_id, v_shop.id, v_character.id, p_stock_id, v_line ->> 'name', v_bundles,
    private.line_price(v_line, v_shop.markup) * v_bundles, p_offer, p_proficient)
  returning * into v_haggle;
  return v_haggle;
end;
$$;

-- The DM agrees (the sale goes through at the offer), says no, or names a counter-price.
create function public.answer_haggle(p_haggle_id uuid, p_agree boolean, p_counter integer)
returns public.haggles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_haggle public.haggles;
  v_shop public.shops;
  v_character public.characters;
  v_line jsonb;
begin
  select * into v_haggle from public.haggles where id = p_haggle_id for update;
  if not found or not private.is_campaign_dm(v_haggle.campaign_id) then
    raise exception 'Only the DM can answer' using errcode = '42501';
  end if;
  if v_haggle.status <> 'open' then
    raise exception 'That offer has been answered' using errcode = '22023';
  end if;
  if p_counter is not null then
    update public.haggles set status = 'countered', counter = greatest(0, p_counter), answered_at = now()
    where id = p_haggle_id returning * into v_haggle;
    return v_haggle;
  end if;
  if not coalesce(p_agree, false) then
    update public.haggles set status = 'refused', answered_at = now() where id = p_haggle_id returning * into v_haggle;
    return v_haggle;
  end if;
  select * into v_shop from public.shops where id = v_haggle.shop_id for update;
  select * into v_character from public.characters where id = v_haggle.character_id;
  select e into v_line from jsonb_array_elements(v_shop.stock) e where e ->> 'id' = v_haggle.stock_id;
  if v_line is null then
    raise exception 'That''s not on the shelves any more' using errcode = '22023';
  end if;
  perform private.buy_line(v_shop, v_line, v_haggle.bundles, v_character, v_haggle.offer, v_haggle.proficient);
  update public.haggles set status = 'agreed', answered_at = now() where id = p_haggle_id returning * into v_haggle;
  return v_haggle;
end;
$$;

-- The player takes the DM's counter-price (the sale goes through) or leaves it.
create function public.take_counter(p_haggle_id uuid, p_take boolean)
returns public.haggles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_haggle public.haggles;
  v_shop public.shops;
  v_character public.characters;
  v_line jsonb;
begin
  select * into v_haggle from public.haggles where id = p_haggle_id for update;
  if not found then
    raise exception 'That offer has gone' using errcode = '22023';
  end if;
  select * into v_character from public.characters where id = v_haggle.character_id;
  if v_character.owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the player can answer' using errcode = '42501';
  end if;
  if v_haggle.status <> 'countered' then
    raise exception 'That offer has gone' using errcode = '22023';
  end if;
  if not coalesce(p_take, false) then
    update public.haggles set status = 'withdrawn', answered_at = now() where id = p_haggle_id returning * into v_haggle;
    return v_haggle;
  end if;
  select * into v_shop from public.shops where id = v_haggle.shop_id for update;
  if not v_shop.open then
    raise exception 'The shop is closed' using errcode = '22023';
  end if;
  select e into v_line from jsonb_array_elements(v_shop.stock) e where e ->> 'id' = v_haggle.stock_id;
  if v_line is null then
    raise exception 'That''s not on the shelves any more' using errcode = '22023';
  end if;
  perform private.buy_line(v_shop, v_line, v_haggle.bundles, v_character, v_haggle.counter, v_haggle.proficient);
  update public.haggles set status = 'agreed', answered_at = now() where id = p_haggle_id returning * into v_haggle;
  return v_haggle;
end;
$$;

revoke execute on function public.haggle(uuid, text, integer, uuid, integer, boolean) from public, anon;
grant execute on function public.haggle(uuid, text, integer, uuid, integer, boolean) to authenticated;
revoke execute on function public.answer_haggle(uuid, boolean, integer) from public, anon;
grant execute on function public.answer_haggle(uuid, boolean, integer) to authenticated;
revoke execute on function public.take_counter(uuid, boolean) from public, anon;
grant execute on function public.take_counter(uuid, boolean) to authenticated;
