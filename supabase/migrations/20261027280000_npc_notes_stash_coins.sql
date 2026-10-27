-- Matt's asks after S1c:
--   * Notes on each NPC: a running record of what's happened with them (met at the tavern, lied
--     about the mill), the DM's alone like the rest of the card.
--   * The DM adds coins to the party stash or takes them out (with change made).

alter table public.npcs add column history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array');
grant update (history) on public.npcs to authenticated;

create function public.stash_coins(p_campaign_id uuid, p_copper integer)
returns public.party_stash
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stash public.party_stash;
  v_after jsonb;
begin
  if not private.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the DM can change the stash''s coins' using errcode = '42501';
  end if;
  if coalesce(p_copper, 0) = 0 or abs(p_copper) > 10000000 then
    raise exception 'Say how much' using errcode = '22023';
  end if;
  insert into public.party_stash (campaign_id) values (p_campaign_id) on conflict (campaign_id) do nothing;
  select * into v_stash from public.party_stash where campaign_id = p_campaign_id for update;
  if p_copper > 0 then
    v_after := private.add_wallets(v_stash.wallet, private.coins_for(p_copper));
  else
    v_after := private.pay(v_stash.wallet, -p_copper);
    if v_after is null then
      raise exception 'The stash only has %', coalesce(private.coin_words(private.wallet_copper(v_stash.wallet)), 'no coins')
        using errcode = '22023';
    end if;
  end if;
  update public.party_stash set wallet = v_after, updated_at = now() where campaign_id = p_campaign_id
  returning * into v_stash;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (p_campaign_id, 'gift',
    left(case when p_copper > 0 then private.coin_words(p_copper) || ' put in the party stash'
      else private.coin_words(-p_copper) || ' taken from the party stash' end, 500),
    true, jsonb_build_object('copper', 0));
  return v_stash;
end;
$$;

revoke execute on function public.stash_coins(uuid, integer) from public, anon;
grant execute on function public.stash_coins(uuid, integer) to authenticated;
