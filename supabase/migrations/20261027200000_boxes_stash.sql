-- I1b: opening boxes and the party stash (docs/I1_PLAN.md, decision 44).
--   * The DM's own numbers for how full boxes are, kept in the notebook (DM-only).
--   * The DM puts a box's finds on the table: they go into the party stash for everyone to see.
--   * Anyone takes an item from the stash for their own character; anyone can split its coins
--     evenly across the party, with what won't share staying in the stash.

alter table public.dm_notebooks add column box_settings jsonb not null default '{}'::jsonb;
grant update (box_settings) on public.dm_notebooks to authenticated;

-- The DM puts things (and coins, in copper) on the table.
create function public.put_on_table(p_campaign_id uuid, p_items jsonb, p_copper integer)
returns public.party_stash
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_items jsonb := private.clean_items(p_items);
  v_copper integer := greatest(0, coalesce(p_copper, 0));
  v_stash public.party_stash;
begin
  if not private.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the DM can put things on the table' using errcode = '42501';
  end if;
  if jsonb_array_length(v_items) = 0 and v_copper = 0 then
    raise exception 'Nothing to put on the table' using errcode = '22023';
  end if;
  if v_copper > 10000000 then
    raise exception 'That''s too much to carry' using errcode = '22023';
  end if;
  insert into public.party_stash (campaign_id, items, wallet)
  values (p_campaign_id, private.merge_items('[]'::jsonb, v_items), private.coins_for(v_copper))
  on conflict (campaign_id) do update
    set items = private.merge_items(public.party_stash.items, v_items),
        wallet = private.add_wallets(public.party_stash.wallet, private.coins_for(v_copper)),
        updated_at = now()
  returning * into v_stash;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (p_campaign_id, 'gift',
    left('On the table for the party: ' || concat_ws(' and ', private.items_words(v_items), private.coin_words(v_copper)), 500),
    true,
    jsonb_build_object('stash', true,
      'to', coalesce((select jsonb_agg(id) from public.characters where campaign_id = p_campaign_id), '[]'::jsonb),
      'items', v_items, 'copper', v_copper));
  return v_stash;
end;
$$;

-- Someone takes an item (or some of a stack) from the stash for their own character.
create function public.take_from_stash(p_character_id uuid, p_item_id text, p_quantity integer, p_proficient boolean)
returns public.characters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_character public.characters;
  v_stash public.party_stash;
  v_item jsonb;
  v_quantity integer;
  v_moved jsonb;
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or not (v_character.owner_id = (select auth.uid()) or private.is_campaign_dm(v_character.campaign_id)) then
    raise exception 'You can only take things for your own character' using errcode = '42501';
  end if;
  select * into v_stash from public.party_stash where campaign_id = v_character.campaign_id for update;
  select e into v_item from jsonb_array_elements(coalesce(v_stash.items, '[]'::jsonb)) e where e ->> 'id' = p_item_id;
  if v_item is null then
    raise exception 'Someone has taken that already' using errcode = '22023';
  end if;
  v_quantity := least(greatest(1, coalesce(p_quantity, 1)), coalesce((v_item ->> 'quantity')::integer, 1));
  v_moved := private.clean_items(jsonb_build_array(v_item || jsonb_build_object('quantity', v_quantity)));

  update public.party_stash
  set items = coalesce((
        select jsonb_agg(case when e ->> 'id' = p_item_id
          then e || jsonb_build_object('quantity', (e ->> 'quantity')::integer - v_quantity) else e end)
        from jsonb_array_elements(items) e
        where not (e ->> 'id' = p_item_id and (e ->> 'quantity')::integer <= v_quantity)
      ), '[]'::jsonb),
      updated_at = now()
  where campaign_id = v_character.campaign_id;

  update public.characters
  set inventory = private.merge_items(inventory, v_moved),
      attacks = case when p_proficient is not null then private.add_attack(attacks, v_moved -> 0, p_proficient) else attacks end
  where id = p_character_id
  returning * into v_character;

  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_character.campaign_id, 'gift',
    left(v_character.name || ' took ' || private.items_words(v_moved) || ' from the party stash', 500), true,
    jsonb_build_object('from_stash', true, 'by', v_character.id, 'items', v_moved, 'copper', 0));
  return v_character;
end;
$$;

-- Anyone at the table shares the stash's coins evenly across every character in the party.
create function public.split_stash(p_campaign_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stash public.party_stash;
  v_ids uuid[];
  v_total integer;
  v_each integer;
begin
  if not private.is_campaign_member(p_campaign_id) then
    raise exception 'Only people at the table can share out the stash' using errcode = '42501';
  end if;
  select * into v_stash from public.party_stash where campaign_id = p_campaign_id for update;
  select array_agg(id) into v_ids from public.characters where campaign_id = p_campaign_id;
  v_total := coalesce(private.wallet_copper(v_stash.wallet), 0);
  if v_ids is null or v_total = 0 then
    raise exception 'There are no coins in the stash' using errcode = '22023';
  end if;
  v_each := v_total / cardinality(v_ids);
  if v_each = 0 then
    raise exception 'Too few coins to share' using errcode = '22023';
  end if;
  update public.characters set wallet = private.add_wallets(wallet, private.coins_for(v_each)) where id = any(v_ids);
  update public.party_stash
  set wallet = private.coins_for(v_total - v_each * cardinality(v_ids)), updated_at = now()
  where campaign_id = p_campaign_id;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (p_campaign_id, 'gift',
    left('The stash''s coins are shared out: ' || private.coin_words(v_each) || ' each', 500), true,
    jsonb_build_object('to', to_jsonb(v_ids), 'copper', v_each));
  return v_each;
end;
$$;

revoke execute on function public.put_on_table(uuid, jsonb, integer) from public, anon;
grant execute on function public.put_on_table(uuid, jsonb, integer) to authenticated;
revoke execute on function public.take_from_stash(uuid, text, integer, boolean) from public, anon;
grant execute on function public.take_from_stash(uuid, text, integer, boolean) to authenticated;
revoke execute on function public.split_stash(uuid) from public, anon;
grant execute on function public.split_stash(uuid) to authenticated;
