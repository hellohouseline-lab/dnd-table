-- Fixes from Matt's first C1 test.
--
-- 1. End turn failed from the website (but not when tried directly in the database), so Next turn
--    bounced back to the same person. end_turn worked out the order in a temporary table; through
--    the website's pooled connections that is fragile. The order now comes from a plain query.
-- 2. Before the first turn (while everyone rolls initiative), players can put their miniature where
--    they think their character is. Once turns begin, the usual rule applies: your turn, your movement.

-- The fight's turn order: highest initiative first, ties to the higher Dexterity, then who joined
-- first. `is_out` marks monsters that are down, which are passed over. Same as turnOrder in src/rules/combat.ts.
create function private.turn_order(p_encounter_id uuid)
returns table (id uuid, is_out boolean, n bigint)
language sql
stable
set search_path = ''
as $$
  select c.id, (c.kind = 'monster' and c.health = 'down'),
         row_number() over (order by c.initiative desc, c.tiebreak desc, c.created_at, c.id)
  from public.combatants c
  where c.encounter_id = p_encounter_id and c.initiative is not null
$$;

revoke execute on function private.turn_order(uuid) from public;

create or replace function public.end_turn(p_encounter_id uuid)
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

  v_at := (select t.n from private.turn_order(p_encounter_id) t where t.id = v_encounter.current_id);
  v_next := (
    select t.id from private.turn_order(p_encounter_id) t
    where not t.is_out and t.n > coalesce(v_at, 0)
    order by t.n limit 1
  );
  v_round := v_encounter.round;
  if v_next is null then
    v_next := (select t.id from private.turn_order(p_encounter_id) t where not t.is_out order by t.n limit 1);
    if v_at is not null and v_next is not null then
      v_round := v_round + 1;
    end if;
  end if;

  if v_next is not null then
    perform private.fresh_turn(v_next);
  end if;
  update public.encounters set current_id = v_next, round = v_round
  where id = p_encounter_id
  returning * into v_encounter;
  return v_encounter;
end
$$;

create or replace function public.move_token(p_token_id uuid, p_x integer, p_y integer)
returns public.tokens
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token public.tokens;
  v_dm boolean;
  v_combatant public.combatants;
  v_current uuid;
  v_feet integer;
  v_left integer;
begin
  select * into v_token from public.tokens t where t.id = p_token_id;
  if not found or not private.is_campaign_member(v_token.campaign_id) then
    raise exception 'That miniature isn''t at this table' using errcode = '42501';
  end if;
  if p_x not between 0 and 500 or p_y not between 0 and 500 then
    raise exception 'That square is off the map' using errcode = '22023';
  end if;
  v_dm := private.is_campaign_dm(v_token.campaign_id);

  -- The fighter this miniature stands for, in the fight going on now, and whose turn it is
  -- (none yet while everyone is still rolling initiative).
  select c.* into v_combatant
  from public.combatants c
  join public.encounters e on e.id = c.encounter_id and e.status = 'active'
  where (v_token.character_id is not null and c.character_id = v_token.character_id)
     or (v_token.combatant_id is not null and c.id = v_token.combatant_id)
  limit 1;
  if found then
    select e.current_id into v_current from public.encounters e where e.id = v_combatant.encounter_id;
  end if;
  v_feet := 5 * greatest(abs(p_x - v_token.x), abs(p_y - v_token.y));

  if not v_dm then
    if not private.is_real_user() or v_token.character_id is null or not exists (
      select 1 from public.characters ch where ch.id = v_token.character_id and ch.owner_id = auth.uid()
    ) then
      raise exception 'You can only move your own miniature' using errcode = '42501';
    end if;
    if v_token.hidden or v_token.map_id is distinct from private.on_stage_map(v_token.campaign_id) then
      raise exception 'That map isn''t on stage' using errcode = '42501';
    end if;
    if not coalesce((select s.players_move_tokens from public.stage s where s.campaign_id = v_token.campaign_id), true) then
      raise exception 'The DM is moving the miniatures for now' using errcode = '42501';
    end if;
    -- In a fight that has begun: only on your turn, and only as far as your movement left.
    if v_combatant.id is not null and v_current is not null then
      if v_current is distinct from v_combatant.id then
        raise exception 'Wait for your turn to move' using errcode = '42501';
      end if;
      v_left := private.speed_of(v_combatant) + v_combatant.extra_feet - v_combatant.feet_moved;
      if v_feet > v_left then
        raise exception 'You can move % more feet this turn', greatest(v_left, 0) using errcode = '22023';
      end if;
    end if;
  end if;

  if v_combatant.id is not null and v_current = v_combatant.id then
    update public.combatants set feet_moved = least(2000, feet_moved + v_feet) where id = v_combatant.id;
  end if;
  update public.tokens set x = p_x, y = p_y where id = p_token_id returning * into v_token;
  return v_token;
end
$$;
