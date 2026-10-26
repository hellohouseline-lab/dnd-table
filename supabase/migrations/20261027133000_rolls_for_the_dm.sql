-- A roll for the DM. Outside a fight a player can just roll a d20 (with advantage or
-- disadvantage) without saying what it's for. It arrives on the DM's screen marked for_dm; the DM
-- says what it was (a Perception check, a Constitution save), which adds the character's bonus to
-- the total and names it in the log, and may judge it against a DC, or simply lets it go.

alter table public.rolls add column for_dm boolean not null default false;

-- for_dm is set only by roll_for_dm below, through a setting it makes for its own transaction.
create function private.mark_for_dm()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.for_dm := coalesce(current_setting('app.roll_for_dm', true), '') = 'on';
  return new;
end
$$;

create trigger rolls_mark_for_dm
  before insert on public.rolls
  for each row execute function private.mark_for_dm();

-- A player rolls a plain d20 for the DM, for their own character.
create function public.roll_for_dm(p_campaign_id uuid, p_character_id uuid, p_mode text)
returns public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.rolls;
begin
  perform set_config('app.roll_for_dm', 'on', true);
  v_row := public.throw_dice(
    p_campaign_id,
    jsonb_build_object(
      'label', 'A roll for the DM', 'kind', 'check', 'character_id', p_character_id,
      'dice', '[{"sides": 20, "count": 1}]'::jsonb, 'modifier', 0, 'parts', '[]'::jsonb,
      'mode', coalesce(p_mode, 'normal'), 'secret', false
    )
  );
  perform set_config('app.roll_for_dm', 'off', true);
  return v_row;
end
$$;

-- The DM says what a roll for the DM was: its name and kind, the character's bonus for it, and,
-- if judged, the DC and pass or fail. With no name, the DM just lets it go.
create function public.name_roll(
  p_roll_id uuid,
  p_label text,
  p_kind text,
  p_modifier integer,
  p_parts jsonb,
  p_dc integer,
  p_passed boolean
)
returns public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.rolls;
  v_total integer;
begin
  select * into v_row from public.rolls r where r.id = p_roll_id;
  if not found or not private.is_real_user() or not private.is_campaign_dm(v_row.campaign_id) then
    raise exception 'Only the DM can say what a roll was' using errcode = '42501';
  end if;
  if not v_row.for_dm then
    raise exception 'That roll has already been settled' using errcode = '22023';
  end if;
  if p_label is null then
    update public.rolls set for_dm = false where id = p_roll_id returning * into v_row;
    return v_row;
  end if;
  if p_kind not in ('check', 'save') or coalesce(p_modifier, 0) not between -50 and 50
     or (p_dc is not null and p_dc not between 1 and 40) then
    raise exception 'That isn''t a check or a save the table knows' using errcode = '22023';
  end if;
  v_total := v_row.total - v_row.modifier + coalesce(p_modifier, 0);
  update public.rolls
  set for_dm = false,
      label = left(btrim(p_label), 80),
      kind = p_kind,
      modifier = coalesce(p_modifier, 0),
      parts = coalesce(p_parts, '[]'::jsonb),
      total = v_total,
      passed = p_passed,
      passed_by_dice = case when p_dc is null then null else v_total >= p_dc end
  where id = p_roll_id
  returning * into v_row;
  return v_row;
end
$$;

revoke execute on function public.roll_for_dm(uuid, uuid, text) from public, anon;
revoke execute on function public.name_roll(uuid, text, text, integer, jsonb, integer, boolean) from public, anon;
grant execute on function public.roll_for_dm(uuid, uuid, text) to authenticated;
grant execute on function public.name_roll(uuid, text, text, integer, jsonb, integer, boolean) to authenticated;
