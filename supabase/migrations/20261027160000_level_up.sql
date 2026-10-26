-- C2d: levelling up when the DM says so. The DM grants a level (to one character, or the whole
-- party); level_up_to then holds the level they may reach. A player can't raise their own level
-- past it, so nobody levels up early. Taking the level, the player picks everything on their own
-- screen and saves the sheet as usual; the DM can change any level, any time.

alter table public.characters
  add column level_up_to smallint check (level_up_to between 2 and 20);

create function private.check_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.level > old.level
     and not private.is_campaign_dm(new.campaign_id)
     and new.level > coalesce(old.level_up_to, old.level) then
    raise exception 'Your DM hasn''t let you level up yet' using errcode = '42501';
  end if;
  -- Reached it: nothing more to take.
  if new.level_up_to is not null and new.level >= new.level_up_to then
    new.level_up_to := null;
  end if;
  return new;
end
$$;

create trigger characters_level_check
  before update of level on public.characters
  for each row execute function private.check_level();

-- The DM lets characters go up a level (one more than they have now, at most 20).
create function public.grant_level_up(p_character_ids uuid[])
returns setof public.characters
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.characters ch
    where ch.id = any (p_character_ids)
      and not (private.is_real_user() and private.is_campaign_dm(ch.campaign_id))
  ) then
    raise exception 'Only the DM can let a character level up' using errcode = '42501';
  end if;
  return query
  update public.characters ch
  set level_up_to = least(20, greatest(coalesce(ch.level_up_to, ch.level), ch.level) + 1)
  where ch.id = any (p_character_ids) and ch.level < 20
  returning *;
end
$$;

revoke execute on function public.grant_level_up(uuid[]) from public, anon;
grant execute on function public.grant_level_up(uuid[]) to authenticated;
