-- C2e: the table's starting level and gold. Gold (in gp) goes into every new character's purse on
-- top of their background's. A character made below the starting level may level up to it straight
-- away: the builder makes them at level 1, then they take each level with the level-up walk-through.

alter table public.campaigns
  add column starting_gold integer not null default 0 check (starting_gold between 0 and 100000);

grant update (starting_gold) on public.campaigns to authenticated;

create function private.start_at_table_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level integer;
begin
  select c.starting_level into v_level from public.campaigns c where c.id = new.campaign_id;
  if v_level is not null and v_level > new.level then
    new.level_up_to := v_level;
  end if;
  return new;
end
$$;

create trigger characters_start_at_table_level
  before insert on public.characters
  for each row execute function private.start_at_table_level();
