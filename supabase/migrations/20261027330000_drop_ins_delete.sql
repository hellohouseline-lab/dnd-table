-- Drop-in players and deleting a table (Matt, 27 October).
-- 1. A character made after the party has levelled up starts at the party's level: the highest level
--    in the party, or the table's starting level if that's higher. As before, the builder makes them
--    at level 1 and they take each level with the level-up walk-through.
-- 2. The DM can add characters to a fight that's already going (someone who just joined, or arrived
--    late). They roll initiative and take their turns from then on.
-- 3. The DM can delete a table, with everything in it. The pictures, sounds and portraits in storage
--    are removed by the DM's browser first (storage can't be cleared from here).

create or replace function private.start_at_table_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level integer;
begin
  select greatest(
    c.starting_level,
    (select max(ch.level) from public.characters ch where ch.campaign_id = new.campaign_id)
  ) into v_level
  from public.campaigns c where c.id = new.campaign_id;
  if v_level is not null and v_level > new.level then
    new.level_up_to := v_level;
  end if;
  return new;
end
$$;

create function public.join_fight(p_encounter_id uuid, p_character_ids uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
  v_added integer;
begin
  select * into v_encounter from public.encounters e where e.id = p_encounter_id and e.status = 'active';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not (private.is_real_user() and private.is_campaign_dm(v_encounter.campaign_id)) then
    raise exception 'Only the DM adds people to a fight' using errcode = '42501';
  end if;

  insert into public.combatants (
    encounter_id, campaign_id, kind, character_id, shown_name, revealed, tiebreak, speed, reach_ft
  )
  select v_encounter.id, v_encounter.campaign_id, 'character', ch.id, left(ch.name, 60), true, ch.dexterity, ch.speed,
         case when lower(ch.attacks::text) ~ '(glaive|halberd|lance|pike|whip)' then 10 else 5 end
  from public.characters ch
  where ch.campaign_id = v_encounter.campaign_id
    and ch.id = any (coalesce(p_character_ids, '{}'))
    and not exists (
      select 1 from public.combatants c where c.encounter_id = v_encounter.id and c.character_id = ch.id
    );
  get diagnostics v_added = row_count;
  return v_added;
end
$$;

revoke execute on function public.join_fight(uuid, uuid[]) from public, anon;
grant execute on function public.join_fight(uuid, uuid[]) to authenticated;

create function public.delete_campaign(p_campaign_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (private.is_real_user() and private.is_campaign_dm(p_campaign_id)) then
    raise exception 'Only the DM can delete a table' using errcode = '42501';
  end if;
  -- Everything else hangs off the campaign and goes with it.
  delete from public.campaigns where id = p_campaign_id;
end
$$;

revoke execute on function public.delete_campaign(uuid) from public, anon;
grant execute on function public.delete_campaign(uuid) to authenticated;
