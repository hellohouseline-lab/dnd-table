-- Ending a turn: the DM for anyone, a player only on their own character's turn. The next in the
-- turn order goes (highest initiative first, ties to the higher Dexterity, then who joined first),
-- passing over monsters that are down; after the last, a new round starts at the top. The same
-- order as turnOrder and nextTurn in src/rules/combat.ts.
create function public.end_turn(p_encounter_id uuid)
returns public.encounters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
  v_at bigint;
  v_next uuid;
  v_round integer;
begin
  select * into v_encounter from public.encounters e where e.id = p_encounter_id and e.status = 'active';
  if not found then
    raise exception 'That fight is over' using errcode = '22023';
  end if;
  if not (
    private.is_campaign_dm(v_encounter.campaign_id)
    or exists (
      select 1 from public.combatants c join public.characters ch on ch.id = c.character_id
      where c.id = v_encounter.current_id and ch.owner_id = auth.uid()
    )
  ) then
    raise exception 'It isn''t your turn' using errcode = '42501';
  end if;

  create temporary table if not exists pg_temp.turn_order (id uuid, out boolean, n bigint) on commit drop;
  delete from pg_temp.turn_order;
  insert into pg_temp.turn_order
  select c.id, (c.kind = 'monster' and c.health = 'down'),
         row_number() over (order by c.initiative desc, c.tiebreak desc, c.created_at, c.id)
  from public.combatants c
  where c.encounter_id = p_encounter_id and c.initiative is not null;

  v_at := (select t.n from pg_temp.turn_order t where t.id = v_encounter.current_id);
  v_next := (select t.id from pg_temp.turn_order t where not t.out and t.n > coalesce(v_at, 0) order by t.n limit 1);
  v_round := v_encounter.round;
  if v_next is null then
    v_next := (select t.id from pg_temp.turn_order t where not t.out order by t.n limit 1);
    if v_at is not null and v_next is not null then
      v_round := v_round + 1;
    end if;
  end if;

  update public.encounters set current_id = v_next, round = v_round
  where id = p_encounter_id
  returning * into v_encounter;
  return v_encounter;
end
$$;

revoke execute on function public.end_turn(uuid) from public, anon;
grant execute on function public.end_turn(uuid) to authenticated;
