-- The DM has the final word on a requested roll. An answer arrives with no verdict: the player
-- sees their total and "waiting for the DM". The DM sees what the dice say (the total against the
-- DC) and rules each one Pass or Fail, or accepts the dice for everyone in one click. Only then do
-- passed and passed_by_dice reach anyone, so a secret DC still never does.

create function private.hold_verdict()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.request_id is not null then
    new.passed := null;
    new.passed_by_dice := null;
  end if;
  return new;
end
$$;

create trigger rolls_hold_verdict
  before insert on public.rolls
  for each row execute function private.hold_verdict();

-- The DM's ruling on one answer: pass or fail, with what the dice said kept beside it.
create or replace function public.override_roll(p_roll_id uuid, p_passed boolean)
returns public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.rolls;
  v_dc integer;
begin
  select * into v_row from public.rolls r where r.id = p_roll_id;
  if not found or not private.is_real_user() or not private.is_campaign_dm(v_row.campaign_id) then
    raise exception 'Only the DM can change a result' using errcode = '42501';
  end if;
  if v_row.request_id is null or p_passed is null then
    raise exception 'Only a requested roll has a result to change' using errcode = '22023';
  end if;
  select s.dc into v_dc from public.roll_request_secrets s where s.request_id = v_row.request_id;
  update public.rolls
  set passed = p_passed, passed_by_dice = v_row.total >= v_dc
  where id = p_roll_id
  returning * into v_row;
  return v_row;
end
$$;

-- "Go with the dice": every answer not yet ruled on passes or fails by its total.
create function public.accept_dice(p_request_id uuid)
returns setof public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_dc integer;
begin
  select r.campaign_id, s.dc into v_campaign_id, v_dc
  from public.roll_requests r join public.roll_request_secrets s on s.request_id = r.id
  where r.id = p_request_id;
  if v_campaign_id is null or not private.is_real_user() or not private.is_campaign_dm(v_campaign_id) then
    raise exception 'Only the DM can rule on a roll' using errcode = '42501';
  end if;
  return query
  update public.rolls
  set passed = total >= v_dc, passed_by_dice = total >= v_dc
  where request_id = p_request_id and passed is null
  returning *;
end
$$;

revoke execute on function public.accept_dice(uuid) from public, anon;
grant execute on function public.accept_dice(uuid) to authenticated;
