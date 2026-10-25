-- An attack's damage can be flat, with no dice: an unarmed strike deals 1 + Strength modifier.
-- Same function as in 20261025233500_rolls.sql apart from the damage dice.

create or replace function public.throw_dice(p_campaign_id uuid, p_roll jsonb)
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
      -- No damage dice means flat damage, such as an unarmed strike's 1 + Strength modifier.
      v_damage_dice := case
        when coalesce(jsonb_array_length(p_roll -> 'damage' -> 'dice'), 0) = 0 then '[]'::jsonb
        else private.throw_dice_groups(p_roll -> 'damage' -> 'dice', case when v_natural = 20 then 2 else 1 end)
      end;
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
