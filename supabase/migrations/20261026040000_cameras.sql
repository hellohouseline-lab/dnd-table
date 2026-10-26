-- Milestone 7: cameras and voice, through VDO.Ninja built into the app.
--
-- Each person at a table has a camera address (the stream ID their camera is sent under) and each
-- table has a camera password, which VDO.Ninja needs as well before anyone can watch. Both are made
-- here at random, so nobody visits vdo.ninja or pastes a link.
--
-- Rules enforced here, not just in the screens:
-- * Only people at the table can read them: the existing rules on these two tables already say so.
-- * Nobody can choose their own: only the columns granted in the first migration can be changed,
--   so a player can't take someone else's camera address.
-- * Only the DM can swap the camera password, which cuts off any camera link that has leaked.

alter table public.campaign_members
  add column camera_id text not null unique
    default ('dnd' || encode(extensions.gen_random_bytes(9), 'hex'))
    check (camera_id ~ '^[a-z0-9]{8,40}$');

alter table public.campaigns
  add column camera_key text not null
    default encode(extensions.gen_random_bytes(12), 'hex')
    check (camera_key ~ '^[a-f0-9]{24}$');

-- Swaps the table's camera password. Everyone's camera reconnects with the new one by itself. DM only.
create function public.renew_camera_key(p_campaign_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the DM can make new camera links' using errcode = '42501';
  end if;

  update public.campaigns
  set camera_key = encode(extensions.gen_random_bytes(12), 'hex')
  where id = p_campaign_id;
end
$$;

revoke execute on function public.renew_camera_key(uuid) from public, anon;
grant execute on function public.renew_camera_key(uuid) to authenticated;
