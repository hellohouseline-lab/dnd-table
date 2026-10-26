-- No two creatures in one square (Matt's T1 test): a player can't end a move where someone already
-- stands, or move through a living enemy's square on the way (straight line from start to finish).
-- Friends' squares can be passed through, as the 2014 rules allow. The DM's own moves aren't held
-- to this (their screen asks first instead).

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
  v_steps integer;
  v_i integer;
  v_blocker text;
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
    -- Nobody ends a move in a square that's taken (a hidden creature's square doesn't count, so it
    -- isn't given away).
    if exists (
      select 1 from public.tokens t
      where t.map_id = v_token.map_id and t.id <> v_token.id and t.x = p_x and t.y = p_y and not t.hidden
    ) then
      raise exception 'Someone is already in that square' using errcode = '22023';
    end if;
    -- You can move through a friend's square, but not an enemy's (2014 rules), unless it's down.
    v_steps := greatest(abs(p_x - v_token.x), abs(p_y - v_token.y));
    for v_i in 1 .. greatest(v_steps - 1, 0) loop
      select c.shown_name into v_blocker
      from public.tokens t
      join public.combatants c on c.id = t.combatant_id and c.kind = 'monster' and c.health <> 'down'
      where t.map_id = v_token.map_id and not t.hidden
        and t.x = round(v_token.x + (p_x - v_token.x) * v_i::numeric / v_steps)
        and t.y = round(v_token.y + (p_y - v_token.y) * v_i::numeric / v_steps)
      limit 1;
      if v_blocker is not null then
        raise exception 'You can''t move through %''s square', v_blocker using errcode = '22023';
      end if;
    end loop;
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
    -- Walking away from someone without Disengaging gives them a chance to strike.
    if not v_combatant.disengaged then
      perform private.open_opportunities(v_combatant, v_token, p_x, p_y);
    end if;
  end if;
  update public.tokens set x = p_x, y = p_y where id = p_token_id returning * into v_token;
  return v_token;
end
$$;

