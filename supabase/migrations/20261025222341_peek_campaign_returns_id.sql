-- peek_campaign also gives the campaign's id, but only to someone already at that table,
-- so an invite link they open again takes them straight there. Everyone else still gets
-- just the name, the DM's name, the party size and the level.

drop function public.peek_campaign(text);

create function public.peek_campaign(p_code text)
returns table (campaign_id uuid, name text, dm_name text, party_size smallint, starting_level smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when private.is_campaign_member(c.id) then c.id end,
    c.name, m.display_name, c.party_size, c.starting_level
  from public.campaigns c
  join public.campaign_members m on m.campaign_id = c.id and m.role = 'dm'
  where c.join_code = private.normalise_join_code(p_code)
    and private.is_real_user()
$$;

revoke execute on function public.peek_campaign(text) from public, anon;
grant execute on function public.peek_campaign(text) to authenticated;
