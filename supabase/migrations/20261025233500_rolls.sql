-- Milestone 3: dice and the roll log.
--
-- Rules enforced here, not just in the screens:
-- * The server throws the dice. A browser asks for a roll (which dice, what bonus) and gets the
--   numbers back, so nobody can pick their own result. Every screen then animates those numbers.
-- * Everyone at the table sees each other's rolls, except secret ones: a secret roll is seen only
--   by the person who rolled it and the DM.
-- * Nobody edits or deletes a roll. (The DM's override arrives with the roll flow in milestone 4.)

-- Each person's dice look (material, colour, number colour), shown to everyone with their rolls.
alter table public.campaign_members
  add column dice_style jsonb not null default '{}'
  check (jsonb_typeof(dice_style) = 'object' and pg_column_size(dice_style) <= 500);

grant update (dice_style) on public.campaign_members to authenticated;

create table public.rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  roller_id uuid not null references auth.users (id) on delete cascade,
  character_id uuid references public.characters (id) on delete set null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  kind text not null check (kind in ('free', 'check', 'save', 'attack', 'initiative')),
  mode text not null default 'normal' check (mode in ('normal', 'advantage', 'disadvantage')),
  -- Every die thrown, in order: [{"sides": 20, "value": 14, "dropped": false}, ...]
  dice jsonb not null check (jsonb_typeof(dice) = 'array' and pg_column_size(dice) <= 8000),
  modifier smallint not null default 0,
  -- What makes up the modifier, for the log: [{"label": "Wisdom", "value": 1}, ...]
  parts jsonb not null default '[]' check (jsonb_typeof(parts) = 'array' and pg_column_size(parts) <= 2000),
  total integer not null,
  -- The d20 that counts, for natural 20 and natural 1 moments. Null unless the roll is one d20.
  natural_d20 smallint check (natural_d20 between 1 and 20),
  -- An attack's damage, thrown with it:
  -- {"dice": [...], "modifier": 3, "total": 9, "type": "slashing", "critical": false}
  damage jsonb check (damage is null or (jsonb_typeof(damage) = 'object' and pg_column_size(damage) <= 8000)),
  secret boolean not null default false,
  -- The roller's dice look at the time, so every screen draws the same dice.
  style jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index rolls_campaign_created_idx on public.rolls (campaign_id, created_at desc);
create index rolls_roller_id_idx on public.rolls (roller_id);
create index rolls_character_id_idx on public.rolls (character_id);

alter table public.rolls enable row level security;

-- Rolls are only ever added by throw_dice below; nobody can write to the table directly.
revoke all on public.rolls from anon, authenticated;
grant select on public.rolls to authenticated;

create policy "Everyone at the table sees the rolls; secret ones only the roller and the DM"
  on public.rolls for select to authenticated
  using (
    private.is_campaign_member(campaign_id)
    and (not secret or roller_id = (select auth.uid()) or private.is_campaign_dm(campaign_id))
  );

-- New rolls reach everyone at the table straight away (the rule above decides who hears them).
alter publication supabase_realtime add table public.rolls;

-- ---------------------------------------------------------------------------------------------
-- Throwing dice
-- ---------------------------------------------------------------------------------------------

-- One fair die. Four secure random bytes, throwing away the few values at the very top that
-- would make low numbers slightly more likely.
create function private.random_die(p_sides integer)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  span constant bigint := 4294967296;
  fair_below constant bigint := span - (span % p_sides);
  bytes bytea;
  n bigint;
begin
  loop
    bytes := extensions.gen_random_bytes(4);
    n := get_byte(bytes, 0)::bigint * 16777216 + get_byte(bytes, 1) * 65536 + get_byte(bytes, 2) * 256
      + get_byte(bytes, 3);
    exit when n < fair_below;
  end loop;
  return 1 + (n % p_sides)::integer;
end
$$;

-- Throws groups of dice, [{"sides": 6, "count": 2}, ...], each count multiplied by p_times
-- (2 for a critical hit). Returns every die: [{"sides": 6, "value": 4, "dropped": false}, ...].
create function private.throw_dice_groups(p_groups jsonb, p_times integer)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  grp jsonb;
  sides integer;
  dice_count integer;
  thrown integer := 0;
  result jsonb := '[]';
begin
  if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups) not between 1 and 8 then
    raise exception 'Pick between one and eight kinds of dice' using errcode = '22023';
  end if;
  for grp in select value from jsonb_array_elements(p_groups) loop
    sides := (grp ->> 'sides')::integer;
    dice_count := (grp ->> 'count')::integer;
    if sides is null or sides not in (4, 6, 8, 10, 12, 20, 100) then
      raise exception 'Dice can have 4, 6, 8, 10, 12, 20 or 100 sides' using errcode = '22023';
    end if;
    if dice_count is null or dice_count not between 1 and 20 then
      raise exception 'Roll between 1 and 20 of each die' using errcode = '22023';
    end if;
    thrown := thrown + dice_count * p_times;
    if thrown > 40 then
      raise exception 'At most 40 dice at once' using errcode = '22023';
    end if;
    for i in 1..(dice_count * p_times) loop
      result := result || jsonb_build_array(
        jsonb_build_object('sides', sides, 'value', private.random_die(sides), 'dropped', false)
      );
    end loop;
  end loop;
  return result;
end
$$;

-- The sum of the dice that count.
create function private.kept_sum(p_dice jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((d ->> 'value')::integer), 0)::integer
  from jsonb_array_elements(p_dice) d
  where not coalesce((d ->> 'dropped')::boolean, false)
$$;

revoke execute on function private.random_die(integer) from public;
revoke execute on function private.throw_dice_groups(jsonb, integer) from public;
revoke execute on function private.kept_sum(jsonb) from public;

-- Throws the dice for a check, save, attack, initiative or free roll, saves the roll and returns it.
-- The same rules live in src/rules/dice.ts (settleRoll), which has the unit tests.
--
-- p_roll:
--   {"label": "Perception check", "kind": "check", "character_id": null, "secret": false,
--    "dice": [{"sides": 20, "count": 1}], "modifier": 3, "parts": [{"label": "Wisdom", "value": 1}],
--    "mode": "normal" | "advantage" | "disadvantage",
--    "damage": {"dice": [{"sides": 8, "count": 1}], "modifier": 3, "type": "slashing"}}
--
-- * Advantage and disadvantage throw a second d20 and drop the lower or the higher one.
-- * An attack's damage is thrown with it. A natural 20 doubles the damage dice (a critical hit);
--   a natural 1 always misses, so no damage is thrown. Damage never goes below 0.
create function public.throw_dice(p_campaign_id uuid, p_roll jsonb)
returns public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  v_character_id uuid := nullif(p_roll ->> 'character_id', '')::uuid;
  v_kind text := coalesce(p_roll ->> 'kind', 'free');
  v_mode text := coalesce(p_roll ->> 'mode', 'normal');
  v_modifier integer := coalesce((p_roll ->> 'modifier')::integer, 0);
  v_parts jsonb := coalesce(p_roll -> 'parts', '[]');
  v_one_d20 boolean;
  v_dice jsonb;
  v_first integer;
  v_second integer;
  v_keep_first boolean;
  v_natural integer;
  v_damage jsonb;
  v_damage_dice jsonb;
  v_damage_modifier integer;
  v_style jsonb;
  v_row public.rolls;
begin
  if not private.is_real_user() or not private.is_campaign_member(p_campaign_id) then
    raise exception 'Only people at this table can roll here' using errcode = '42501';
  end if;
  if v_character_id is not null and not exists (
    select 1 from public.characters c
    where c.id = v_character_id
      and c.campaign_id = p_campaign_id
      and (c.owner_id = caller or private.is_campaign_dm(p_campaign_id))
  ) then
    raise exception 'You can only roll for your own character' using errcode = '42501';
  end if;
  if v_mode not in ('normal', 'advantage', 'disadvantage') then
    raise exception 'Unknown roll mode' using errcode = '22023';
  end if;
  if v_modifier not between -50 and 50 then
    raise exception 'The bonus must be between -50 and 50' using errcode = '22023';
  end if;

  v_one_d20 := jsonb_typeof(p_roll -> 'dice') = 'array'
    and jsonb_array_length(p_roll -> 'dice') = 1
    and (p_roll -> 'dice' -> 0 ->> 'sides') = '20'
    and (p_roll -> 'dice' -> 0 ->> 'count') = '1';
  if v_mode <> 'normal' and not v_one_d20 then
    raise exception 'Advantage and disadvantage need a single d20' using errcode = '22023';
  end if;

  v_dice := private.throw_dice_groups(p_roll -> 'dice', 1);
  if v_mode <> 'normal' then
    v_first := (v_dice -> 0 ->> 'value')::integer;
    v_second := private.random_die(20);
    v_keep_first := case when v_mode = 'advantage' then v_first >= v_second else v_first <= v_second end;
    v_dice := jsonb_build_array(
      jsonb_build_object('sides', 20, 'value', v_first, 'dropped', not v_keep_first),
      jsonb_build_object('sides', 20, 'value', v_second, 'dropped', v_keep_first)
    );
  end if;
  if v_one_d20 then
    v_natural := (select (d ->> 'value')::integer from jsonb_array_elements(v_dice) d
                  where not (d ->> 'dropped')::boolean limit 1);
  end if;

  if jsonb_typeof(p_roll -> 'damage') = 'object' then
    if v_kind <> 'attack' or not v_one_d20 then
      raise exception 'Only an attack roll can carry damage' using errcode = '22023';
    end if;
    v_damage_modifier := coalesce((p_roll -> 'damage' ->> 'modifier')::integer, 0);
    if v_damage_modifier not between -50 and 50 then
      raise exception 'The damage bonus must be between -50 and 50' using errcode = '22023';
    end if;
    if v_natural <> 1 then
      v_damage_dice := private.throw_dice_groups(p_roll -> 'damage' -> 'dice', case when v_natural = 20 then 2 else 1 end);
      v_damage := jsonb_build_object(
        'dice', v_damage_dice,
        'modifier', v_damage_modifier,
        'total', greatest(0, private.kept_sum(v_damage_dice) + v_damage_modifier),
        'type', left(coalesce(p_roll -> 'damage' ->> 'type', ''), 30),
        'critical', v_natural = 20
      );
    end if;
  end if;

  select m.dice_style into v_style
  from public.campaign_members m
  where m.campaign_id = p_campaign_id and m.user_id = caller;

  insert into public.rolls (
    campaign_id, roller_id, character_id, label, kind, mode, dice, modifier, parts, total, natural_d20,
    damage, secret, style
  ) values (
    p_campaign_id, caller, v_character_id, btrim(coalesce(p_roll ->> 'label', '')), v_kind, v_mode, v_dice,
    v_modifier, v_parts, private.kept_sum(v_dice) + v_modifier, v_natural, v_damage,
    coalesce((p_roll ->> 'secret')::boolean, false), coalesce(v_style, '{}')
  )
  returning * into v_row;
  return v_row;
end
$$;

revoke execute on function public.throw_dice(uuid, jsonb) from public, anon;
grant execute on function public.throw_dice(uuid, jsonb) to authenticated;
