-- Milestone 4: the DM asks for a roll, the players roll it, the server judges pass or fail.
--
-- Rules enforced here, not just in the screens:
-- * Only the DM asks. Everyone at the table sees what was asked and of whom, but never a DC the DM
--   kept secret: the DC lives in roll_request_secrets, which only the DM can read.
-- * Each character asked answers once, through throw_dice. The server throws the d20, judges it
--   against the DC and saves the verdict, so a secret DC never reaches a player's browser.
-- * The DM can turn a pass into a fail or back (to reward good roleplay), and closes the request.
-- * One open request per table at a time; asking again closes the last one.

create table public.roll_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- A skill check (Perception), a plain ability check (Strength) or a saving throw.
  kind text not null check (kind in ('skill', 'ability', 'save')),
  ability text not null check (
    ability in ('strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma')
  ),
  skill text check (skill in (
    'acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation',
    'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion',
    'sleight-of-hand', 'stealth', 'survival'
  )),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  -- What it's for, in plain words, shown on the player's prompt.
  plain text not null default '' check (char_length(plain) <= 200),
  character_ids uuid[] not null check (cardinality(character_ids) between 1 and 12),
  -- The DC when the DM chose to tell players; null when it's kept secret.
  shown_dc smallint check (shown_dc between 1 and 40),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint roll_requests_skill_for_skill_checks check ((kind = 'skill') = (skill is not null))
);

create index roll_requests_campaign_created_idx on public.roll_requests (campaign_id, created_at desc);
create unique index roll_requests_one_open on public.roll_requests (campaign_id) where status = 'open';

create table public.roll_request_secrets (
  request_id uuid primary key references public.roll_requests (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  dc smallint not null check (dc between 1 and 40)
);

create index roll_request_secrets_campaign_id_idx on public.roll_request_secrets (campaign_id);

alter table public.roll_requests enable row level security;
alter table public.roll_request_secrets enable row level security;

-- Both are written only by the functions below.
revoke all on public.roll_requests, public.roll_request_secrets from anon, authenticated;
grant select on public.roll_requests, public.roll_request_secrets to authenticated;

create policy "Everyone at the table sees what the DM asked"
  on public.roll_requests for select to authenticated
  using (private.is_campaign_member(campaign_id));

create policy "Only the DM sees the DC"
  on public.roll_request_secrets for select to authenticated
  using (private.is_campaign_dm(campaign_id));

-- Answers to a request, judged by the server. passed_by_dice is what the dice said; passed is the
-- final word, which the DM can change.
alter table public.rolls
  add column request_id uuid references public.roll_requests (id) on delete set null,
  add column passed boolean,
  add column passed_by_dice boolean;

create unique index rolls_one_answer_each on public.rolls (request_id, character_id) where request_id is not null;

-- Requests reach everyone at the table straight away. (Secrets are never sent.)
alter publication supabase_realtime add table public.roll_requests;

-- ---------------------------------------------------------------------------------------------
-- Asking, answering, overriding and closing
-- ---------------------------------------------------------------------------------------------

-- The DM asks some or all of the characters at the table to roll.
-- p_request: {"kind": "save", "ability": "constitution", "skill": null, "label": "Constitution saving throw",
--             "plain": "Steel yourself against poison, sickness or exhaustion.",
--             "character_ids": ["..."], "dc": 15, "dc_shown": false}
create function public.ask_for_roll(p_campaign_id uuid, p_request jsonb)
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

  insert into public.roll_requests (campaign_id, kind, ability, skill, label, plain, character_ids, shown_dc)
  values (
    p_campaign_id,
    p_request ->> 'kind',
    p_request ->> 'ability',
    nullif(p_request ->> 'skill', ''),
    btrim(coalesce(p_request ->> 'label', '')),
    coalesce(p_request ->> 'plain', ''),
    v_ids,
    case when coalesce((p_request ->> 'dc_shown')::boolean, false) then v_dc end
  )
  returning * into v_row;

  insert into public.roll_request_secrets (request_id, campaign_id, dc) values (v_row.id, p_campaign_id, v_dc);
  return v_row;
end
$$;

-- The DM turns a requested roll's pass into a fail, or back.
create function public.override_roll(p_roll_id uuid, p_passed boolean)
returns public.rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.rolls;
begin
  select * into v_row from public.rolls r where r.id = p_roll_id;
  if not found or not private.is_real_user() or not private.is_campaign_dm(v_row.campaign_id) then
    raise exception 'Only the DM can change a result' using errcode = '42501';
  end if;
  if v_row.request_id is null or p_passed is null then
    raise exception 'Only a requested roll has a result to change' using errcode = '22023';
  end if;
  update public.rolls set passed = p_passed where id = p_roll_id returning * into v_row;
  return v_row;
end
$$;

-- "Done, play on": the DM closes the request and everyone's prompt goes away.
create function public.close_roll_request(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  select r.campaign_id into v_campaign_id from public.roll_requests r where r.id = p_request_id;
  if v_campaign_id is null or not private.is_real_user() or not private.is_campaign_dm(v_campaign_id) then
    raise exception 'Only the DM can close a roll' using errcode = '42501';
  end if;
  update public.roll_requests set status = 'closed', closed_at = coalesce(closed_at, now()) where id = p_request_id;
end
$$;

revoke execute on function public.ask_for_roll(uuid, jsonb) from public, anon;
revoke execute on function public.override_roll(uuid, boolean) from public, anon;
revoke execute on function public.close_roll_request(uuid) from public, anon;
grant execute on function public.ask_for_roll(uuid, jsonb) to authenticated;
grant execute on function public.override_roll(uuid, boolean) to authenticated;
grant execute on function public.close_roll_request(uuid) to authenticated;

-- throw_dice, now also answering roll requests and judging them against the DC. Otherwise the same
-- as in 20261025235500_flat_damage.sql, except that a character's roll uses its player's dice look.
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
  v_label text := btrim(coalesce(p_roll ->> 'label', ''));
  v_secret boolean := coalesce((p_roll ->> 'secret')::boolean, false);
  v_request_id uuid := nullif(p_roll ->> 'request_id', '')::uuid;
  v_request public.roll_requests;
  v_dc integer;
  v_passed boolean;
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

  -- An answer to the DM's roll request: one d20 for one of the characters asked, once each.
  if v_request_id is not null then
    select * into v_request from public.roll_requests r where r.id = v_request_id and r.campaign_id = p_campaign_id;
    if not found then
      raise exception 'That roll request is not at this table' using errcode = '42501';
    end if;
    if v_request.status <> 'open' then
      raise exception 'The DM has already closed this roll' using errcode = '22023';
    end if;
    if v_character_id is null or not (v_character_id = any (v_request.character_ids)) then
      raise exception 'The DM did not ask that character to roll' using errcode = '42501';
    end if;
    if not v_one_d20 or jsonb_typeof(p_roll -> 'damage') = 'object' then
      raise exception 'A requested roll is a single d20' using errcode = '22023';
    end if;
    if exists (select 1 from public.rolls r where r.request_id = v_request_id and r.character_id = v_character_id) then
      raise exception 'That character has already rolled' using errcode = '23505';
    end if;
    v_kind := case when v_request.kind = 'save' then 'save' else 'check' end;
    v_label := v_request.label;
    v_secret := false;
    select s.dc into v_dc from public.roll_request_secrets s where s.request_id = v_request_id;
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

  -- A character's roll comes in its player's dice, even when the DM rolls it for them.
  select m.dice_style into v_style
  from public.campaign_members m
  where m.campaign_id = p_campaign_id
    and m.user_id = coalesce((select c.owner_id from public.characters c where c.id = v_character_id), caller);

  -- On checks and saves the total decides: a natural 20 or 1 doesn't pass or fail by itself.
  if v_dc is not null then
    v_passed := private.kept_sum(v_dice) + v_modifier >= v_dc;
  end if;

  insert into public.rolls (
    campaign_id, roller_id, character_id, label, kind, mode, dice, modifier, parts, total, natural_d20,
    damage, secret, style, request_id, passed, passed_by_dice
  ) values (
    p_campaign_id, caller, v_character_id, v_label, v_kind, v_mode, v_dice,
    v_modifier, v_parts, private.kept_sum(v_dice) + v_modifier, v_natural, v_damage,
    v_secret, coalesce(v_style, '{}'), v_request_id, v_passed, v_passed
  )
  returning * into v_row;
  return v_row;
end
$$;
