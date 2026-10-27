-- S1b, decision 57: Tell players the outcome. Ticked (the default), a requested roll works as
-- before: the DM rules and everyone sees Passed or Failed. Unticked, players see only their total;
-- the DM's ruling (and what the dice said) goes to a DM-only table instead of the roll itself, so
-- it never reaches a player's browser.

alter table public.roll_requests add column outcome_shown boolean not null default true;

create table public.roll_verdicts (
  roll_id uuid primary key references public.rolls (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  request_id uuid not null references public.roll_requests (id) on delete cascade,
  passed boolean not null,
  passed_by_dice boolean
);

create index roll_verdicts_campaign_idx on public.roll_verdicts (campaign_id);
create index roll_verdicts_request_idx on public.roll_verdicts (request_id);

alter table public.roll_verdicts enable row level security;
revoke all on public.roll_verdicts from anon, authenticated;
grant select on public.roll_verdicts to authenticated;
create policy "Only the DM sees hidden verdicts" on public.roll_verdicts for select to authenticated
  using (private.is_campaign_dm(campaign_id));

alter publication supabase_realtime add table public.roll_verdicts;

-- Asking, now with whether players are told the outcome.
create or replace function public.ask_for_roll(p_campaign_id uuid, p_request jsonb)
returns public.roll_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_dc integer := (p_request ->> 'dc')::integer;
  v_row public.roll_requests;
begin
  if not private.is_real_user() or not private.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the DM can ask for a roll' using errcode = '42501';
  end if;
  if v_dc is null or v_dc not between 1 and 40 then
    raise exception 'The DC must be between 1 and 40' using errcode = '22023';
  end if;
  select array_agg(distinct value::uuid) into v_ids
  from jsonb_array_elements_text(coalesce(p_request -> 'character_ids', '[]'));
  if v_ids is null then
    raise exception 'Pick at least one character to roll' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_ids) as asked (character_id)
    where not exists (
      select 1 from public.characters c where c.id = asked.character_id and c.campaign_id = p_campaign_id
    )
  ) then
    raise exception 'Only characters at this table can be asked' using errcode = '22023';
  end if;

  update public.roll_requests set status = 'closed', closed_at = now()
  where campaign_id = p_campaign_id and status = 'open';

  insert into public.roll_requests (campaign_id, kind, ability, skill, label, plain, character_ids, shown_dc, outcome_shown)
  values (
    p_campaign_id,
    p_request ->> 'kind',
    p_request ->> 'ability',
    nullif(p_request ->> 'skill', ''),
    btrim(coalesce(p_request ->> 'label', '')),
    coalesce(p_request ->> 'plain', ''),
    v_ids,
    case when coalesce((p_request ->> 'dc_shown')::boolean, false) then v_dc end,
    coalesce((p_request ->> 'outcome_shown')::boolean, true)
  )
  returning * into v_row;

  insert into public.roll_request_secrets (request_id, campaign_id, dc) values (v_row.id, p_campaign_id, v_dc);
  return v_row;
end
$$;

-- The DM's ruling on one answer: on the roll for everyone, or in the DM's own table when hidden.
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
  v_shown boolean;
begin
  select * into v_row from public.rolls r where r.id = p_roll_id;
  if not found or not private.is_real_user() or not private.is_campaign_dm(v_row.campaign_id) then
    raise exception 'Only the DM can change a result' using errcode = '42501';
  end if;
  if v_row.request_id is null or p_passed is null then
    raise exception 'Only a requested roll has a result to change' using errcode = '22023';
  end if;
  select s.dc into v_dc from public.roll_request_secrets s where s.request_id = v_row.request_id;
  select q.outcome_shown into v_shown from public.roll_requests q where q.id = v_row.request_id;
  if coalesce(v_shown, true) then
    update public.rolls
    set passed = p_passed, passed_by_dice = v_row.total >= v_dc
    where id = p_roll_id
    returning * into v_row;
  else
    insert into public.roll_verdicts (roll_id, campaign_id, request_id, passed, passed_by_dice)
    values (v_row.id, v_row.campaign_id, v_row.request_id, p_passed, v_row.total >= v_dc)
    on conflict (roll_id) do update set passed = excluded.passed, passed_by_dice = excluded.passed_by_dice;
  end if;
  return v_row;
end
$$;

-- "Go with the dice", the same way.
create or replace function public.accept_dice(p_request_id uuid)
returns setof public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_dc integer;
  v_shown boolean;
begin
  select r.campaign_id, s.dc, r.outcome_shown into v_campaign_id, v_dc, v_shown
  from public.roll_requests r join public.roll_request_secrets s on s.request_id = r.id
  where r.id = p_request_id;
  if v_campaign_id is null or not private.is_real_user() or not private.is_campaign_dm(v_campaign_id) then
    raise exception 'Only the DM can rule on a roll' using errcode = '42501';
  end if;
  if coalesce(v_shown, true) then
    return query
    update public.rolls
    set passed = total >= v_dc, passed_by_dice = total >= v_dc
    where request_id = p_request_id and passed is null
    returning *;
  else
    insert into public.roll_verdicts (roll_id, campaign_id, request_id, passed, passed_by_dice)
    select r.id, r.campaign_id, r.request_id, r.total >= v_dc, r.total >= v_dc
    from public.rolls r
    where r.request_id = p_request_id
      and not exists (select 1 from public.roll_verdicts v where v.roll_id = r.id);
    return query select * from public.rolls where request_id = p_request_id;
  end if;
end
$$;
