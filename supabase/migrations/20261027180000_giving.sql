-- I1a: giving items and coins (docs/I1_PLAN.md). Every move happens here, so nothing is lost or
-- doubled and nobody writes to someone else's sheet:
--   * the DM gives items and coins to a character, takes coins (making change), or splits coins
--     across the party, with what can't be shared going to the party stash (decision 38);
--   * a player hands an item or coins to another character, outside a fight (decision 45).
-- Each gift is written to the log for everyone, which is how the receiving screen shows the card
-- arriving. Coins are paid from the smallest first, breaking a bigger coin when needed, with
-- change in the fewest gold, silver and copper coins (decision 39), as in src/rules/money.ts.

-- The log says what was given and to whom.
alter table public.log_events drop constraint log_events_kind_check;
alter table public.log_events add constraint log_events_kind_check
  check (kind in ('note', 'damage', 'heal', 'rest', 'condition', 'stage', 'gift'));
alter table public.log_events add column data jsonb not null default '{}'::jsonb;

-- What the party holds together: coins that wouldn't split, and (in I1b) loot put on the table.
create table public.party_stash (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  wallet jsonb not null default '{"cp": 0, "sp": 0, "ep": 0, "gp": 0, "pp": 0}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.party_stash enable row level security;
revoke all on public.party_stash from anon, authenticated;
grant select on public.party_stash to authenticated;

create policy "Everyone at the table sees the party stash"
  on public.party_stash for select to authenticated
  using (private.is_campaign_member(campaign_id));

alter publication supabase_realtime add table public.party_stash;

-- Coins.

create function private.wallet_copper(p_wallet jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce((p_wallet ->> 'cp')::integer, 0) + 10 * coalesce((p_wallet ->> 'sp')::integer, 0)
    + 50 * coalesce((p_wallet ->> 'ep')::integer, 0) + 100 * coalesce((p_wallet ->> 'gp')::integer, 0)
    + 1000 * coalesce((p_wallet ->> 'pp')::integer, 0)
$$;

-- An amount in the fewest gold, silver and copper coins.
create function private.coins_for(p_copper integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('cp', p_copper % 10, 'sp', (p_copper % 100) / 10, 'ep', 0, 'gp', p_copper / 100, 'pp', 0)
$$;

create function private.add_wallets(p_a jsonb, p_b jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_object_agg(coin, coalesce((p_a ->> coin)::integer, 0) + coalesce((p_b ->> coin)::integer, 0))
  from unnest(array['cp', 'sp', 'ep', 'gp', 'pp']) coin
$$;

-- "12 gp 5 sp" for an amount.
create function private.coin_words(p_copper integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(concat_ws(' ',
    case when p_copper / 100 > 0 then (p_copper / 100) || ' gp' end,
    case when (p_copper % 100) / 10 > 0 then ((p_copper % 100) / 10) || ' sp' end,
    case when p_copper % 10 > 0 then (p_copper % 10) || ' cp' end), '')
$$;

-- Pays from a purse, or null if it can't cover the amount.
create function private.pay(p_wallet jsonb, p_copper integer)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_coins text[] := array['cp', 'sp', 'ep', 'gp', 'pp'];
  v_values integer[] := array[1, 10, 50, 100, 1000];
  v_left jsonb := private.add_wallets(p_wallet, '{}'::jsonb);
  v_owed integer := p_copper;
  v_have integer;
  v_used integer;
begin
  if p_copper <= 0 then
    return v_left;
  end if;
  if private.wallet_copper(v_left) < p_copper then
    return null;
  end if;
  for i in 1 .. 5 loop
    v_have := (v_left ->> v_coins[i])::integer;
    v_used := least(v_have, v_owed / v_values[i]);
    v_left := jsonb_set(v_left, array[v_coins[i]], to_jsonb(v_have - v_used));
    v_owed := v_owed - v_used * v_values[i];
  end loop;
  if v_owed = 0 then
    return v_left;
  end if;
  -- Break the smallest coin that covers what's still owed.
  for i in 1 .. 5 loop
    v_have := (v_left ->> v_coins[i])::integer;
    if v_have > 0 and v_values[i] >= v_owed then
      v_left := jsonb_set(v_left, array[v_coins[i]], to_jsonb(v_have - 1));
      return private.add_wallets(v_left, private.coins_for(v_values[i] - v_owed));
    end if;
  end loop;
  return null;
end;
$$;

-- Items.

-- Gifts made safe: a name, how many, and only the parts a pack line has. Each gets a new id.
create function private.clean_items(p_items jsonb)
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
    'attuned', case when (i ->> 'attune')::boolean then false end
  ))), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
  where jsonb_typeof(i) = 'object' and char_length(btrim(coalesce(i ->> 'name', ''))) > 0
$$;

-- Adds items to a pack: one more of something already carried (the same thing, the same +1), or
-- a new line. Items that need attuning always get their own line.
create function private.merge_items(p_inventory jsonb, p_items jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_inventory jsonb := coalesce(p_inventory, '[]'::jsonb);
  v_item jsonb;
  v_at integer;
begin
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_at := null;
    if not coalesce((v_item ->> 'attune')::boolean, false) then
      select e.n - 1 into v_at
      from jsonb_array_elements(v_inventory) with ordinality as e (x, n)
      where e.x ->> 'item' is not distinct from v_item ->> 'item'
        and e.x ->> 'name' = v_item ->> 'name'
        and e.x ->> 'magic' is not distinct from v_item ->> 'magic'
        and coalesce(e.x ->> 'bonus', '0') = coalesce(v_item ->> 'bonus', '0')
      limit 1;
    end if;
    if v_at is null then
      v_inventory := v_inventory || jsonb_build_array(v_item);
    else
      v_inventory := jsonb_set(v_inventory, array[v_at::text, 'quantity'],
        to_jsonb(coalesce((v_inventory -> v_at ->> 'quantity')::integer, 0) + (v_item ->> 'quantity')::integer));
    end if;
  end loop;
  return v_inventory;
end;
$$;

-- A weapon's card for the hand, unless one for the same weapon and +1 is there already.
create function private.add_attack(p_attacks jsonb, p_item jsonb, p_proficient boolean)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_item ->> 'item' is null or exists (
      select 1 from jsonb_array_elements(coalesce(p_attacks, '[]'::jsonb)) a
      where a ->> 'weapon' = p_item ->> 'item'
        and coalesce((a ->> 'magicBonus')::integer, 0) = coalesce((p_item ->> 'bonus')::integer, 0)
    ) then coalesce(p_attacks, '[]'::jsonb)
    else coalesce(p_attacks, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'weapon-' || (p_item ->> 'item') || coalesce('-' || (p_item ->> 'bonus'), ''),
      'name', p_item ->> 'name',
      'weapon', p_item ->> 'item',
      'proficient', coalesce(p_proficient, false),
      'magicBonus', coalesce((p_item ->> 'bonus')::integer, 0),
      'ability', 'strength',
      'damageDice', '',
      'damageType', ''
    ))
  end
$$;

-- "a Potion of Healing", "3 × Torch".
create function private.items_words(p_items jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(
    case when (i ->> 'quantity')::integer > 1 then (i ->> 'quantity') || ' × ' || (i ->> 'name') else i ->> 'name' end,
    ', ')
  from jsonb_array_elements(p_items) i
$$;

-- The DM gives things to a character: items (weapons named in p_weapons get a card in the hand,
-- with whether they're trained) and coins.
create function public.give_items(p_character_id uuid, p_items jsonb, p_weapons jsonb, p_copper integer)
returns public.characters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_character public.characters;
  v_items jsonb := private.clean_items(p_items);
  v_attacks jsonb;
  v_item jsonb;
  v_copper integer := greatest(0, coalesce(p_copper, 0));
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or not private.is_campaign_dm(v_character.campaign_id) then
    raise exception 'Only the DM can give things' using errcode = '42501';
  end if;
  if jsonb_array_length(v_items) = 0 and v_copper = 0 then
    raise exception 'Nothing to give' using errcode = '22023';
  end if;
  if v_copper > 10000000 then
    raise exception 'That''s too much to carry' using errcode = '22023';
  end if;

  v_attacks := v_character.attacks;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce(p_weapons, '{}'::jsonb) ? (v_item ->> 'item') then
      v_attacks := private.add_attack(v_attacks, v_item, (p_weapons ->> (v_item ->> 'item'))::boolean);
    end if;
  end loop;

  update public.characters
  set inventory = private.merge_items(inventory, v_items),
      attacks = v_attacks,
      wallet = private.add_wallets(wallet, private.coins_for(v_copper))
  where id = p_character_id
  returning * into v_character;

  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_character.campaign_id, 'gift',
    left(v_character.name || ' got ' || concat_ws(' and ', private.items_words(v_items), private.coin_words(v_copper)), 500),
    true,
    jsonb_build_object('to', jsonb_build_array(v_character.id), 'items', v_items, 'copper', v_copper));
  return v_character;
end;
$$;

-- The DM takes coins from a character (a fine, a toll), making change.
create function public.take_coins(p_character_id uuid, p_copper integer)
returns public.characters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_character public.characters;
  v_after jsonb;
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or not private.is_campaign_dm(v_character.campaign_id) then
    raise exception 'Only the DM can take coins' using errcode = '42501';
  end if;
  if coalesce(p_copper, 0) <= 0 then
    raise exception 'Nothing to take' using errcode = '22023';
  end if;
  v_after := private.pay(v_character.wallet, p_copper);
  if v_after is null then
    raise exception '% only has %', v_character.name,
      coalesce(private.coin_words(private.wallet_copper(v_character.wallet)), 'no coins') using errcode = '22023';
  end if;
  update public.characters set wallet = v_after where id = p_character_id returning * into v_character;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_character.campaign_id, 'gift', left(v_character.name || ' paid ' || private.coin_words(p_copper), 500), true,
    jsonb_build_object('from', v_character.id, 'copper', p_copper));
  return v_character;
end;
$$;

-- The DM shares coins evenly between some characters; what won't share goes to the party stash.
create function public.split_coins(p_campaign_id uuid, p_character_ids uuid[], p_copper integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_each integer;
  v_left integer;
begin
  if not private.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the DM can share out coins' using errcode = '42501';
  end if;
  select array_agg(id) into v_ids from public.characters
  where campaign_id = p_campaign_id and id = any(p_character_ids);
  if v_ids is null then
    raise exception 'Pick who shares it' using errcode = '22023';
  end if;
  if coalesce(p_copper, 0) <= 0 or p_copper > 10000000 then
    raise exception 'Say how much to share' using errcode = '22023';
  end if;
  v_each := p_copper / cardinality(v_ids);
  v_left := p_copper - v_each * cardinality(v_ids);

  update public.characters set wallet = private.add_wallets(wallet, private.coins_for(v_each)) where id = any(v_ids);
  if v_left > 0 then
    insert into public.party_stash (campaign_id, wallet) values (p_campaign_id, private.coins_for(v_left))
    on conflict (campaign_id) do update
      set wallet = private.add_wallets(public.party_stash.wallet, excluded.wallet), updated_at = now();
  end if;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (p_campaign_id, 'gift',
    left(private.coin_words(p_copper) || ' shared out: ' || coalesce(private.coin_words(v_each), 'nothing') || ' each'
      || case when v_left > 0 then ', ' || private.coin_words(v_left) || ' to the party stash' else '' end, 500),
    true,
    jsonb_build_object('to', to_jsonb(v_ids), 'copper', v_each));
  return v_each;
end;
$$;

-- A player hands an item (or some of a stack) and coins to another character in the party,
-- outside a fight. Armour has to come off first.
create function public.hand_over(
  p_from uuid, p_to uuid, p_item_id text, p_quantity integer, p_coins jsonb, p_proficient boolean
)
returns public.characters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_from public.characters;
  v_to public.characters;
  v_item jsonb;
  v_moved jsonb := '[]'::jsonb;
  v_quantity integer;
  v_coins jsonb := private.add_wallets(coalesce(p_coins, '{}'::jsonb), '{}'::jsonb);
  v_copper integer;
  v_inventory jsonb;
  v_attacks jsonb;
begin
  select * into v_from from public.characters where id = p_from;
  if not found or not (v_from.owner_id = (select auth.uid()) or private.is_campaign_dm(v_from.campaign_id)) then
    raise exception 'You can only hand over your own things' using errcode = '42501';
  end if;
  select * into v_to from public.characters where id = p_to and campaign_id = v_from.campaign_id;
  if not found or v_to.id = v_from.id then
    raise exception 'Pick someone else in the party' using errcode = '22023';
  end if;
  if exists (select 1 from public.encounters where campaign_id = v_from.campaign_id and status = 'active') then
    raise exception 'Hand things over when the fight is over' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each_text(v_coins) c where c.value::integer < 0) then
    raise exception 'Coins can''t be less than none' using errcode = '22023';
  end if;
  v_copper := private.wallet_copper(v_coins);
  if exists (
    select 1 from unnest(array['cp', 'sp', 'ep', 'gp', 'pp']) coin
    where coalesce((v_coins ->> coin)::integer, 0) > coalesce((v_from.wallet ->> coin)::integer, 0)
  ) then
    raise exception 'You don''t have those coins' using errcode = '22023';
  end if;

  v_inventory := v_from.inventory;
  v_attacks := v_from.attacks;
  if p_item_id is not null then
    select e into v_item from jsonb_array_elements(v_from.inventory) e where e ->> 'id' = p_item_id;
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
    v_moved := private.clean_items(jsonb_build_array(v_item || jsonb_build_object('quantity', v_quantity)));
    -- Keep its uses (a healer's kit) and attunement need; it arrives unattuned.
    v_inventory := coalesce((
      select jsonb_agg(case when e ->> 'id' = p_item_id
        then e || jsonb_build_object('quantity', (e ->> 'quantity')::integer - v_quantity) else e end)
      from jsonb_array_elements(v_from.inventory) e
      where not (e ->> 'id' = p_item_id and (e ->> 'quantity')::integer <= v_quantity)
    ), '[]'::jsonb);
    -- No longer carrying that weapon: its card leaves the hand.
    if not exists (
      select 1 from jsonb_array_elements(v_inventory) e
      where e ->> 'item' is not distinct from v_item ->> 'item'
        and coalesce(e ->> 'bonus', '0') = coalesce(v_item ->> 'bonus', '0')
    ) then
      v_attacks := coalesce((
        select jsonb_agg(a) from jsonb_array_elements(v_from.attacks) a
        where not (a ->> 'weapon' is not distinct from v_item ->> 'item'
          and coalesce((a ->> 'magicBonus')::integer, 0) = coalesce((v_item ->> 'bonus')::integer, 0))
      ), '[]'::jsonb);
    end if;
  end if;
  if jsonb_array_length(v_moved) = 0 and v_copper = 0 then
    raise exception 'Nothing to hand over' using errcode = '22023';
  end if;

  update public.characters
  set inventory = v_inventory,
      attacks = v_attacks,
      wallet = private.add_wallets(wallet, (select jsonb_object_agg(key, -value::integer) from jsonb_each_text(v_coins)))
  where id = v_from.id;

  update public.characters
  set inventory = private.merge_items(inventory, v_moved),
      attacks = case when p_proficient is not null and jsonb_array_length(v_moved) > 0
        then private.add_attack(attacks, v_moved -> 0, p_proficient) else attacks end,
      wallet = private.add_wallets(wallet, v_coins)
  where id = v_to.id
  returning * into v_to;

  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_from.campaign_id, 'gift',
    left(v_from.name || ' gave ' || v_to.name || ' ' || concat_ws(' and ', private.items_words(v_moved),
      nullif(concat_ws(' ',
        case when (v_coins ->> 'pp')::integer > 0 then (v_coins ->> 'pp') || ' pp' end,
        case when (v_coins ->> 'gp')::integer > 0 then (v_coins ->> 'gp') || ' gp' end,
        case when (v_coins ->> 'ep')::integer > 0 then (v_coins ->> 'ep') || ' ep' end,
        case when (v_coins ->> 'sp')::integer > 0 then (v_coins ->> 'sp') || ' sp' end,
        case when (v_coins ->> 'cp')::integer > 0 then (v_coins ->> 'cp') || ' cp' end), '')), 500),
    true,
    jsonb_build_object('to', jsonb_build_array(v_to.id), 'from', v_from.id, 'items', v_moved, 'copper', v_copper));
  return v_to;
end;
$$;

revoke execute on function public.give_items(uuid, jsonb, jsonb, integer) from public, anon;
grant execute on function public.give_items(uuid, jsonb, jsonb, integer) to authenticated;
revoke execute on function public.take_coins(uuid, integer) from public, anon;
grant execute on function public.take_coins(uuid, integer) to authenticated;
revoke execute on function public.split_coins(uuid, uuid[], integer) from public, anon;
grant execute on function public.split_coins(uuid, uuid[], integer) to authenticated;
revoke execute on function public.hand_over(uuid, uuid, text, integer, jsonb, boolean) from public, anon;
grant execute on function public.hand_over(uuid, uuid, text, integer, jsonb, boolean) to authenticated;
