-- Opening and closing a shop says so in the log, for everyone. A player's screen can't hear a shop
-- close (once closed, it's hidden from them), so the log line is how it knows to look again.

create function public.set_shop_open(p_shop_id uuid, p_open boolean)
returns public.shops
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop public.shops;
begin
  select * into v_shop from public.shops where id = p_shop_id;
  if not found or not private.is_campaign_dm(v_shop.campaign_id) then
    raise exception 'Only the DM opens and closes shops' using errcode = '42501';
  end if;
  update public.shops set open = coalesce(p_open, false), updated_at = now() where id = p_shop_id returning * into v_shop;
  insert into public.log_events (campaign_id, kind, text, visible, data)
  values (v_shop.campaign_id, 'stage',
    left(v_shop.name || case when v_shop.open then ' is open' else ' has closed' end, 500), true,
    jsonb_build_object('shop', v_shop.id));
  return v_shop;
end;
$$;

revoke execute on function public.set_shop_open(uuid, boolean) from public, anon;
grant execute on function public.set_shop_open(uuid, boolean) to authenticated;
