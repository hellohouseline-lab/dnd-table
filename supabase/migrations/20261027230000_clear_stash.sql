-- The DM tidies the party stash: takes one thing out (it's gone, as if left behind), or clears
-- the lot, coins and all. The log says so, so nobody wonders where it went.

create function public.remove_from_stash(p_campaign_id uuid, p_item_id text)
returns public.party_stash
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stash public.party_stash;
  v_item jsonb;
begin
  if not private.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the DM can tidy the stash' using errcode = '42501';
  end if;
  select * into v_stash from public.party_stash where campaign_id = p_campaign_id for update;
  select e into v_item from jsonb_array_elements(coalesce(v_stash.items, '[]'::jsonb)) e where e ->> 'id' = p_item_id;
  if v_item is null then
    raise exception 'That''s not in the stash' using errcode = '22023';
  end if;
  update public.party_stash
  set items = coalesce((select jsonb_agg(e) from jsonb_array_elements(items) e where e ->> 'id' <> p_item_id), '[]'::jsonb),
      updated_at = now()
  where campaign_id = p_campaign_id
  returning * into v_stash;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (p_campaign_id, 'gift', left('Taken out of the party stash: ' || private.items_words(jsonb_build_array(v_item)), 500),
    true, jsonb_build_object('copper', 0));
  return v_stash;
end;
$$;

create function public.clear_stash(p_campaign_id uuid)
returns public.party_stash
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stash public.party_stash;
begin
  if not private.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the DM can tidy the stash' using errcode = '42501';
  end if;
  update public.party_stash
  set items = '[]'::jsonb, wallet = '{"cp": 0, "sp": 0, "ep": 0, "gp": 0, "pp": 0}'::jsonb, updated_at = now()
  where campaign_id = p_campaign_id
  returning * into v_stash;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (p_campaign_id, 'gift', 'The party stash is cleared', true, jsonb_build_object('copper', 0));
  return v_stash;
end;
$$;

revoke execute on function public.remove_from_stash(uuid, text) from public, anon;
grant execute on function public.remove_from_stash(uuid, text) to authenticated;
revoke execute on function public.clear_stash(uuid) from public, anon;
grant execute on function public.clear_stash(uuid) to authenticated;
