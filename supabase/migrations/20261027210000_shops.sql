-- I1c: shops (docs/I1_PLAN.md, decisions 40, 41 and 46).
--   * The book prices of the free rules' gear (and our bits and bobs), for selling back.
--   * Shops: the DM stocks them; players see one only while it's open. The DM's note on the
--     shopkeeper stays the DM's.
--   * Buying takes the coins (change made) and puts the thing in your pack; selling gives half the
--     book price (a magic item only where the shop stocks it, for half its price). Every sale is
--     recorded so the DM can undo it.
--   * A table setting: whether players may add gear for free on Change your character.

create table public.srd_prices (
  index text primary key,
  -- Copper, for one bundle (arrows come 20 to a bundle).
  cost integer not null check (cost >= 0),
  bundle integer not null default 1 check (bundle >= 1)
);

alter table public.srd_prices enable row level security;
revoke all on public.srd_prices from anon, authenticated;
grant select on public.srd_prices to authenticated;
create policy "Anyone signed in reads the price list" on public.srd_prices for select to authenticated using (true);

insert into public.srd_prices (index, cost, bundle) values
  ('club', 10, 1),
  ('dagger', 200, 1),
  ('greatclub', 20, 1),
  ('handaxe', 500, 1),
  ('javelin', 50, 1),
  ('light-hammer', 200, 1),
  ('mace', 500, 1),
  ('quarterstaff', 20, 1),
  ('sickle', 100, 1),
  ('spear', 100, 1),
  ('crossbow-light', 2500, 1),
  ('dart', 5, 1),
  ('shortbow', 2500, 1),
  ('sling', 10, 1),
  ('battleaxe', 1000, 1),
  ('flail', 1000, 1),
  ('glaive', 2000, 1),
  ('greataxe', 3000, 1),
  ('greatsword', 5000, 1),
  ('halberd', 2000, 1),
  ('lance', 1000, 1),
  ('longsword', 1500, 1),
  ('maul', 1000, 1),
  ('morningstar', 1500, 1),
  ('pike', 500, 1),
  ('rapier', 2500, 1),
  ('scimitar', 2500, 1),
  ('shortsword', 1000, 1),
  ('trident', 500, 1),
  ('war-pick', 500, 1),
  ('warhammer', 1500, 1),
  ('whip', 200, 1),
  ('blowgun', 1000, 1),
  ('crossbow-hand', 7500, 1),
  ('crossbow-heavy', 5000, 1),
  ('longbow', 5000, 1),
  ('net', 100, 1),
  ('padded-armor', 500, 1),
  ('leather-armor', 1000, 1),
  ('studded-leather-armor', 4500, 1),
  ('hide-armor', 1000, 1),
  ('chain-shirt', 5000, 1),
  ('scale-mail', 5000, 1),
  ('breastplate', 40000, 1),
  ('half-plate-armor', 75000, 1),
  ('ring-mail', 3000, 1),
  ('chain-mail', 7500, 1),
  ('splint-armor', 20000, 1),
  ('plate-armor', 150000, 1),
  ('shield', 1000, 1),
  ('abacus', 200, 1),
  ('acid-vial', 2500, 1),
  ('alchemists-fire-flask', 5000, 1),
  ('arrow', 100, 20),
  ('blowgun-needle', 100, 50),
  ('crossbow-bolt', 100, 20),
  ('sling-bullet', 4, 20),
  ('amulet', 500, 1),
  ('antitoxin-vial', 5000, 1),
  ('crystal', 1000, 1),
  ('orb', 2000, 1),
  ('rod', 1000, 1),
  ('staff', 500, 1),
  ('wand', 1000, 1),
  ('backpack', 200, 1),
  ('ball-bearings-bag-of-1000', 100, 1),
  ('barrel', 200, 1),
  ('basket', 40, 1),
  ('bedroll', 100, 1),
  ('bell', 100, 1),
  ('blanket', 50, 1),
  ('block-and-tackle', 100, 1),
  ('book', 2500, 1),
  ('bottle-glass', 200, 1),
  ('bucket', 5, 1),
  ('caltrops', 5, 1),
  ('candle', 1, 1),
  ('case-crossbow-bolt', 100, 1),
  ('case-map-or-scroll', 100, 1),
  ('chain-10-feet', 500, 1),
  ('chalk-1-piece', 1, 1),
  ('chest', 500, 1),
  ('clothes-common', 50, 1),
  ('clothes-costume', 500, 1),
  ('clothes-fine', 1500, 1),
  ('clothes-travelers', 200, 1),
  ('component-pouch', 2500, 1),
  ('crowbar', 200, 1),
  ('sprig-of-mistletoe', 100, 1),
  ('totem', 100, 1),
  ('wooden-staff', 500, 1),
  ('yew-wand', 1000, 1),
  ('emblem', 500, 1),
  ('fishing-tackle', 100, 1),
  ('flask-or-tankard', 2, 1),
  ('grappling-hook', 200, 1),
  ('hammer', 100, 1),
  ('hammer-sledge', 200, 1),
  ('holy-water-flask', 2500, 1),
  ('hourglass', 2500, 1),
  ('hunting-trap', 500, 1),
  ('ink-1-ounce-bottle', 1000, 1),
  ('ink-pen', 2, 1),
  ('jug-or-pitcher', 2, 1),
  ('climbers-kit', 2500, 1),
  ('disguise-kit', 2500, 1),
  ('forgery-kit', 1500, 1),
  ('herbalism-kit', 500, 1),
  ('healers-kit', 500, 1),
  ('mess-kit', 20, 1),
  ('poisoners-kit', 5000, 1),
  ('ladder-10-foot', 10, 1),
  ('lamp', 50, 1),
  ('lantern-bullseye', 1000, 1),
  ('lantern-hooded', 500, 1),
  ('lock', 1000, 1),
  ('magnifying-glass', 10000, 1),
  ('manacles', 200, 1),
  ('mirror-steel', 500, 1),
  ('oil-flask', 10, 1),
  ('paper-one-sheet', 20, 1),
  ('parchment-one-sheet', 10, 1),
  ('perfume-vial', 500, 1),
  ('pick-miners', 200, 1),
  ('piton', 5, 1),
  ('poison-basic-vial', 10000, 1),
  ('pole-10-foot', 5, 1),
  ('pot-iron', 200, 1),
  ('pouch', 50, 1),
  ('quiver', 100, 1),
  ('ram-portable', 400, 1),
  ('rations-1-day', 50, 1),
  ('reliquary', 500, 1),
  ('robes', 100, 1),
  ('rope-hempen-50-feet', 100, 1),
  ('rope-silk-50-feet', 1000, 1),
  ('sack', 1, 1),
  ('scale-merchants', 500, 1),
  ('sealing-wax', 50, 1),
  ('shovel', 200, 1),
  ('signal-whistle', 5, 1),
  ('signet-ring', 500, 1),
  ('soap', 2, 1),
  ('spellbook', 5000, 1),
  ('spike-iron', 10, 1),
  ('spyglass', 100000, 1),
  ('tent-two-person', 200, 1),
  ('tinderbox', 50, 1),
  ('torch', 1, 1),
  ('vial', 100, 1),
  ('waterskin', 20, 1),
  ('whetstone', 1, 1),
  ('burglars-pack', 1600, 1),
  ('diplomats-pack', 3900, 1),
  ('dungeoneers-pack', 1200, 1),
  ('entertainers-pack', 4000, 1),
  ('explorers-pack', 1000, 1),
  ('priests-pack', 1900, 1),
  ('scholars-pack', 4000, 1),
  ('alchemists-supplies', 5000, 1),
  ('brewers-supplies', 2000, 1),
  ('calligraphers-supplies', 1000, 1),
  ('carpenters-tools', 800, 1),
  ('cartographers-tools', 1500, 1),
  ('cobblers-tools', 500, 1),
  ('cooks-utensils', 100, 1),
  ('glassblowers-tools', 3000, 1),
  ('jewelers-tools', 2500, 1),
  ('leatherworkers-tools', 500, 1),
  ('masons-tools', 1000, 1),
  ('painters-supplies', 1000, 1),
  ('potters-tools', 1000, 1),
  ('smiths-tools', 2000, 1),
  ('tinkers-tools', 5000, 1),
  ('weavers-tools', 100, 1),
  ('woodcarvers-tools', 100, 1),
  ('dice-set', 10, 1),
  ('playing-card-set', 50, 1),
  ('bagpipes', 3000, 1),
  ('drum', 600, 1),
  ('dulcimer', 2500, 1),
  ('flute', 200, 1),
  ('lute', 3500, 1),
  ('lyre', 3000, 1),
  ('horn', 300, 1),
  ('pan-flute', 1200, 1),
  ('shawm', 200, 1),
  ('viol', 3000, 1),
  ('navigators-tools', 2500, 1),
  ('thieves-tools', 2500, 1),
  ('camel', 5000, 1),
  ('donkey', 800, 1),
  ('mule', 800, 1),
  ('elephant', 20000, 1),
  ('horse-draft', 5000, 1),
  ('horse-riding', 7500, 1),
  ('mastiff', 2500, 1),
  ('pony', 3000, 1),
  ('warhorse', 40000, 1),
  ('barding-padded', 2000, 1),
  ('barding-leather', 4000, 1),
  ('barding-studded-leather', 18000, 1),
  ('barding-hide', 4000, 1),
  ('barding-chain-shirt', 20000, 1),
  ('barding-scale-mail', 20000, 1),
  ('barding-breastplate', 160000, 1),
  ('barding-half-plate', 300000, 1),
  ('barding-ring-mail', 1200, 1),
  ('barding-chain-mail', 30000, 1),
  ('barding-splint', 80000, 1),
  ('barding-plate', 600000, 1),
  ('bit-and-bridle', 200, 1),
  ('carriage', 10000, 1),
  ('cart', 1500, 1),
  ('chariot', 25000, 1),
  ('animal-feed-1-day', 5, 1),
  ('saddle-exotic', 6000, 1),
  ('saddle-military', 2000, 1),
  ('saddle-pack', 500, 1),
  ('saddle-riding', 1000, 1),
  ('saddlebags', 400, 1),
  ('sled', 2000, 1),
  ('stabling-1-day', 50, 1),
  ('wagon', 3500, 1),
  ('galley', 3000000, 1),
  ('keelboat', 300000, 1),
  ('longship', 1000000, 1),
  ('rowboat', 5000, 1),
  ('sailing-ship', 1000000, 1),
  ('warship', 2500000, 1),
  ('bits-fork', 1, 1),
  ('bits-knife', 1, 1),
  ('bits-wooden-bowl', 1, 1),
  ('bits-string', 1, 1),
  ('bits-twine', 1, 1),
  ('bits-candle-stub', 1, 1),
  ('bits-comb', 2, 1),
  ('bits-button', 1, 1),
  ('bits-buttons', 2, 1),
  ('bits-needle', 1, 1),
  ('bits-thimble', 2, 1),
  ('bits-dice', 5, 1),
  ('bits-cards', 5, 1),
  ('bits-pipe', 2, 1),
  ('bits-tobacco', 5, 1),
  ('bits-key', 1, 1),
  ('bits-nails', 1, 1),
  ('bits-horseshoe', 1, 1),
  ('bits-chalk', 1, 1),
  ('bits-cheese', 1, 1),
  ('bits-bottle', 1, 1),
  ('bits-wine', 10, 1),
  ('bits-toy', 2, 1),
  ('bits-doll', 1, 1),
  ('bits-bell', 5, 1),
  ('bits-spectacles', 10, 1),
  ('bits-locket', 5, 1),
  ('bits-silver-ring', 1000, 1),
  ('bits-copper-bracelet', 200, 1),
  ('bits-pearl', 1000, 1),
  ('bits-agate', 1000, 1),
  ('bits-gold-tooth', 500, 1)
;

alter table public.campaigns add column players_add_gear boolean not null default true;
grant update (players_add_gear) on public.campaigns to authenticated;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  keeper text not null default '' check (char_length(keeper) <= 60),
  kind text not null check (kind in ('general', 'blacksmith', 'alchemist', 'fletcher', 'merchant')),
  markup integer not null default 100 check (markup between 25 and 400),
  buys boolean not null default true,
  open boolean not null default false,
  stock jsonb not null default '[]'::jsonb check (jsonb_typeof(stock) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shops_campaign_idx on public.shops (campaign_id, created_at);

alter table public.shops enable row level security;
revoke all on public.shops from anon, authenticated;
grant select, insert, update (name, keeper, kind, markup, buys, open, stock), delete on public.shops to authenticated;

create policy "The DM sees every shop; players, the open ones"
  on public.shops for select to authenticated
  using (private.is_campaign_dm(campaign_id) or (open and private.is_campaign_member(campaign_id)));
create policy "Only the DM makes shops"
  on public.shops for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));
create policy "Only the DM changes shops"
  on public.shops for update to authenticated
  using (private.is_campaign_dm(campaign_id)) with check (private.is_campaign_dm(campaign_id));
create policy "Only the DM closes a shop for good"
  on public.shops for delete to authenticated
  using (private.is_campaign_dm(campaign_id));

alter publication supabase_realtime add table public.shops;

-- The DM's note on the shopkeeper, for playing them.
create table public.shop_notes (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500)
);

alter table public.shop_notes enable row level security;
revoke all on public.shop_notes from anon, authenticated;
grant select, insert, update (note), delete on public.shop_notes to authenticated;
create policy "Only the DM reads shopkeeper notes"
  on public.shop_notes for select to authenticated using (private.is_campaign_dm(campaign_id));
create policy "Only the DM writes shopkeeper notes"
  on public.shop_notes for insert to authenticated
  with check (private.is_real_user() and private.is_campaign_dm(campaign_id));
create policy "Only the DM changes shopkeeper notes"
  on public.shop_notes for update to authenticated
  using (private.is_campaign_dm(campaign_id)) with check (private.is_campaign_dm(campaign_id));
create policy "Only the DM removes shopkeeper notes"
  on public.shop_notes for delete to authenticated using (private.is_campaign_dm(campaign_id));

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete set null,
  character_id uuid not null references public.characters (id) on delete cascade,
  kind text not null check (kind in ('buy', 'sell')),
  -- The pack line that moved, and the shelf line it came from or went to.
  item jsonb not null,
  stock_id text,
  -- Bundles bought, or items sold.
  quantity integer not null check (quantity >= 1),
  copper integer not null check (copper >= 0),
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

create index sales_campaign_idx on public.sales (campaign_id, created_at desc);
create index sales_character_idx on public.sales (character_id);
create index sales_shop_idx on public.sales (shop_id);

alter table public.sales enable row level security;
revoke all on public.sales from anon, authenticated;
grant select on public.sales to authenticated;
create policy "The DM sees every sale; a player, their own"
  on public.sales for select to authenticated
  using (
    private.is_campaign_dm(campaign_id)
    or exists (select 1 from public.characters ch where ch.id = character_id and ch.owner_id = (select auth.uid()))
  );

alter publication supabase_realtime add table public.sales;

-- What a shelf line costs here.
create function private.line_price(p_line jsonb, p_markup integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce((p_line ->> 'price')::integer, round(coalesce((p_line ->> 'cost')::integer, 0) * p_markup / 100.0)::integer)
$$;

-- A pack less some of one line, and the hand less a weapon's card if none is left.
create function private.inventory_without(p_inventory jsonb, p_item_id text, p_quantity integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(case when e ->> 'id' = p_item_id
      then e || jsonb_build_object('quantity', (e ->> 'quantity')::integer - p_quantity) else e end)
    from jsonb_array_elements(p_inventory) e
    where not (e ->> 'id' = p_item_id and (e ->> 'quantity')::integer <= p_quantity)
  ), '[]'::jsonb)
$$;

create function private.attacks_still_carried(p_attacks jsonb, p_inventory jsonb, p_item jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when exists (
      select 1 from jsonb_array_elements(p_inventory) e
      where e ->> 'item' is not distinct from p_item ->> 'item'
        and coalesce(e ->> 'bonus', '0') = coalesce(p_item ->> 'bonus', '0')
    ) then p_attacks
    else coalesce((
      select jsonb_agg(a) from jsonb_array_elements(p_attacks) a
      where not (a ->> 'weapon' is not distinct from p_item ->> 'item'
        and coalesce((a ->> 'magicBonus')::integer, 0) = coalesce((p_item ->> 'bonus')::integer, 0))
    ), '[]'::jsonb)
  end
$$;

-- Buy some bundles of a shelf line for your character.
create function public.buy_item(p_shop_id uuid, p_stock_id text, p_bundles integer, p_character_id uuid, p_proficient boolean)
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
  v_price integer;
  v_total integer;
  v_after jsonb;
  v_moved jsonb;
  v_sale public.sales;
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
  if (v_line ->> 'quantity') is not null and (v_line ->> 'quantity')::integer < v_bundles then
    raise exception 'They only have % left', (v_line ->> 'quantity') using errcode = '22023';
  end if;
  if (v_line ->> 'price') is null and coalesce((v_line ->> 'cost')::integer, 0) = 0 and (v_line ->> 'magic') is not null then
    raise exception 'That isn''t for sale yet' using errcode = '22023';
  end if;
  v_price := private.line_price(v_line, v_shop.markup);
  v_total := v_price * v_bundles;
  v_after := private.pay(v_character.wallet, v_total);
  if v_after is null then
    raise exception 'That costs %, and you have %', coalesce(private.coin_words(v_total), 'nothing'),
      coalesce(private.coin_words(private.wallet_copper(v_character.wallet)), 'no coins') using errcode = '22023';
  end if;

  v_moved := private.clean_items(jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'item', v_line -> 'item',
    'name', regexp_replace(v_line ->> 'name', ' \(\d+\)$', ''),
    'quantity', v_bundles * coalesce((v_line ->> 'bundle')::integer, 1),
    'weight', v_line -> 'weight',
    'uses', case when v_line ->> 'item' = 'healers-kit' then 10 end,
    'magic', v_line -> 'magic',
    'bonus', v_line -> 'bonus',
    'attune', v_line -> 'attune',
    'note', v_line -> 'note'
  ))));

  update public.characters
  set inventory = private.merge_items(inventory, v_moved),
      wallet = v_after,
      attacks = case when p_proficient is not null then private.add_attack(attacks, v_moved -> 0, p_proficient) else attacks end
  where id = v_character.id;
  if (v_line ->> 'quantity') is not null then
    update public.shops
    set stock = (select jsonb_agg(case when e ->> 'id' = p_stock_id
          then e || jsonb_build_object('quantity', (e ->> 'quantity')::integer - v_bundles) else e end)
        from jsonb_array_elements(stock) e),
        updated_at = now()
    where id = v_shop.id;
  end if;

  insert into public.sales (campaign_id, shop_id, character_id, kind, item, stock_id, quantity, copper)
  values (v_shop.campaign_id, v_shop.id, v_character.id, 'buy', v_moved -> 0, p_stock_id, v_bundles, v_total)
  returning * into v_sale;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_shop.campaign_id, 'gift',
    left(v_character.name || ' bought ' || private.items_words(v_moved) || ' for ' || coalesce(private.coin_words(v_total), 'nothing'), 500),
    true, jsonb_build_object('shop', v_shop.id, 'by', v_character.id, 'copper', v_total));
  return v_sale;
end;
$$;

-- Sell some of something from your pack to an open shop that buys.
create function public.sell_item(p_shop_id uuid, p_character_id uuid, p_item_id text, p_quantity integer)
returns public.sales
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop public.shops;
  v_character public.characters;
  v_item jsonb;
  v_quantity integer;
  v_each integer;
  v_line jsonb;
  v_book integer;
  v_bundle integer := 1;
  v_moved jsonb;
  v_inventory jsonb;
  v_stock_id text;
  v_sale public.sales;
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or not (v_character.owner_id = (select auth.uid()) or private.is_campaign_dm(v_character.campaign_id)) then
    raise exception 'You can only sell your own things' using errcode = '42501';
  end if;
  select * into v_shop from public.shops where id = p_shop_id and campaign_id = v_character.campaign_id for update;
  if not found or not v_shop.open then
    raise exception 'The shop is closed' using errcode = '22023';
  end if;
  if not v_shop.buys then
    raise exception 'This shop doesn''t buy' using errcode = '22023';
  end if;
  select e into v_item from jsonb_array_elements(v_character.inventory) e where e ->> 'id' = p_item_id;
  if v_item is null then
    raise exception 'You don''t have that' using errcode = '22023';
  end if;
  if coalesce((v_item ->> 'worn')::boolean, false) then
    raise exception 'Take it off first' using errcode = '22023';
  end if;
  v_quantity := least(greatest(1, coalesce(p_quantity, 1)), coalesce((v_item ->> 'quantity')::integer, 0));
  if v_quantity <= 0 then
    raise exception 'There''s none left' using errcode = '22023';
  end if;

  if (v_item ->> 'magic') is not null then
    select e into v_line from jsonb_array_elements(v_shop.stock) e
    where e ->> 'magic' = v_item ->> 'magic' and coalesce(e ->> 'bonus', '0') = coalesce(v_item ->> 'bonus', '0')
    limit 1;
    if v_line is null then
      raise exception 'This shop doesn''t buy that' using errcode = '22023';
    end if;
    v_bundle := coalesce((v_line ->> 'bundle')::integer, 1);
    v_each := private.line_price(v_line, v_shop.markup) / v_bundle / 2;
  else
    select cost, bundle into v_book, v_bundle from public.srd_prices where index = v_item ->> 'item';
    if v_book is null or v_book = 0 then
      raise exception 'This shop doesn''t buy that' using errcode = '22023';
    end if;
    v_each := v_book / v_bundle / 2;
    select e into v_line from jsonb_array_elements(v_shop.stock) e
    where e ->> 'item' = v_item ->> 'item' and e ->> 'magic' is null and coalesce((e ->> 'bundle')::integer, 1) = 1
    limit 1;
  end if;

  v_moved := private.clean_items(jsonb_build_array(v_item || jsonb_build_object('quantity', v_quantity)));
  v_inventory := private.inventory_without(v_character.inventory, p_item_id, v_quantity);
  update public.characters
  set inventory = v_inventory,
      attacks = private.attacks_still_carried(attacks, v_inventory, v_item),
      wallet = private.add_wallets(wallet, private.coins_for(v_each * v_quantity))
  where id = v_character.id;

  -- It goes on the shop's shelves: one more of a line it has, or a new line at the book price.
  if v_line is not null and coalesce((v_line ->> 'bundle')::integer, 1) = 1 then
    v_stock_id := v_line ->> 'id';
    if (v_line ->> 'quantity') is not null then
      update public.shops
      set stock = (select jsonb_agg(case when e ->> 'id' = v_stock_id
            then e || jsonb_build_object('quantity', (e ->> 'quantity')::integer + v_quantity) else e end)
          from jsonb_array_elements(stock) e),
          updated_at = now()
      where id = v_shop.id;
    end if;
  elsif v_book is not null and v_bundle = 1 then
    v_stock_id := v_moved -> 0 ->> 'id';
    update public.shops
    set stock = stock || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'id', v_stock_id, 'item', v_item ->> 'item', 'name', v_item ->> 'name', 'cost', v_book, 'price', null,
          'quantity', v_quantity, 'bundle', 1, 'weight', v_item -> 'weight', 'note', v_item -> 'note'))),
        updated_at = now()
    where id = v_shop.id;
  end if;

  insert into public.sales (campaign_id, shop_id, character_id, kind, item, stock_id, quantity, copper)
  values (v_shop.campaign_id, v_shop.id, v_character.id, 'sell', v_moved -> 0, v_stock_id, v_quantity, v_each * v_quantity)
  returning * into v_sale;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_shop.campaign_id, 'gift',
    left(v_character.name || ' sold ' || private.items_words(v_moved) || ' for ' || coalesce(private.coin_words(v_each * v_quantity), 'nothing'), 500),
    true, jsonb_build_object('shop', v_shop.id, 'by', v_character.id, 'copper', v_each * v_quantity));
  return v_sale;
end;
$$;

-- The DM undoes a sale: the thing and the coins go back where they came from.
create function public.undo_sale(p_sale_id uuid)
returns public.sales
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_character public.characters;
  v_item_id text;
  v_inventory jsonb;
  v_after jsonb;
  v_delta integer;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or not private.is_campaign_dm(v_sale.campaign_id) then
    raise exception 'Only the DM can undo a sale' using errcode = '42501';
  end if;
  if v_sale.undone then
    raise exception 'That sale is undone already' using errcode = '22023';
  end if;
  select * into v_character from public.characters where id = v_sale.character_id for update;

  if v_sale.kind = 'buy' then
    select e ->> 'id' into v_item_id from jsonb_array_elements(v_character.inventory) e
    where e ->> 'item' is not distinct from v_sale.item ->> 'item' and e ->> 'name' = v_sale.item ->> 'name'
      and e ->> 'magic' is not distinct from v_sale.item ->> 'magic'
      and coalesce(e ->> 'bonus', '0') = coalesce(v_sale.item ->> 'bonus', '0')
      and (e ->> 'quantity')::integer >= (v_sale.item ->> 'quantity')::integer
    limit 1;
    if v_item_id is null then
      raise exception '% doesn''t have all of it any more', v_character.name using errcode = '22023';
    end if;
    v_inventory := private.inventory_without(v_character.inventory, v_item_id, (v_sale.item ->> 'quantity')::integer);
    update public.characters
    set inventory = v_inventory,
        attacks = private.attacks_still_carried(attacks, v_inventory, v_sale.item),
        wallet = private.add_wallets(wallet, private.coins_for(v_sale.copper))
    where id = v_character.id;
    v_delta := v_sale.quantity;
  else
    v_after := private.pay(v_character.wallet, v_sale.copper);
    if v_after is null then
      raise exception '% has spent the money', v_character.name using errcode = '22023';
    end if;
    update public.characters
    set inventory = private.merge_items(inventory, jsonb_build_array(v_sale.item)), wallet = v_after
    where id = v_character.id;
    v_delta := -v_sale.quantity;
  end if;

  if v_sale.shop_id is not null and v_sale.stock_id is not null then
    update public.shops
    set stock = (select jsonb_agg(case when e ->> 'id' = v_sale.stock_id and (e ->> 'quantity') is not null
          then e || jsonb_build_object('quantity', greatest(0, (e ->> 'quantity')::integer + v_delta)) else e end)
        from jsonb_array_elements(stock) e),
        updated_at = now()
    where id = v_sale.shop_id and jsonb_array_length(stock) > 0;
  end if;

  update public.sales set undone = true where id = p_sale_id returning * into v_sale;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_sale.campaign_id, 'gift',
    left('Undone: ' || v_character.name || case when v_sale.kind = 'buy' then ' didn''t buy ' else ' didn''t sell ' end
      || (v_sale.item ->> 'name'), 500),
    true, jsonb_build_object('by', v_character.id, 'copper', 0));
  return v_sale;
end;
$$;

revoke execute on function public.buy_item(uuid, text, integer, uuid, boolean) from public, anon;
grant execute on function public.buy_item(uuid, text, integer, uuid, boolean) to authenticated;
revoke execute on function public.sell_item(uuid, uuid, text, integer) from public, anon;
grant execute on function public.sell_item(uuid, uuid, text, integer) to authenticated;
revoke execute on function public.undo_sale(uuid) from public, anon;
grant execute on function public.undo_sale(uuid) to authenticated;
