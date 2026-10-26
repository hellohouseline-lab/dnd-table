-- Concentration, the rest of the 2014 rules:
--   * each time a concentrating caster takes damage they make a separate save (DC 10 or half the
--     damage, whichever is higher). A hit while one save is still owed queues the next, and once
--     the first is kept the next comes up by itself;
--   * being incapacitated ends it: incapacitated, paralysed, petrified, stunned or unconscious.

alter table public.characters
  add column concentration_queue smallint[] not null default '{}'
    check (cardinality(concentration_queue) <= 20);

create or replace function private.on_hit_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lost integer;
  v_dc smallint;
begin
  v_lost := (old.current_hp + old.temp_hp) - (new.current_hp + new.temp_hp);
  if new.current_hp = 0 and old.current_hp > 0 and not ('unconscious' = any (new.conditions)) then
    new.conditions := array_append(new.conditions, 'unconscious');
  elsif new.current_hp > 0 and old.current_hp = 0 then
    new.death_save_successes := 0;
    new.death_save_failures := 0;
    new.stable := false;
    new.dead := false;
    new.conditions := array_remove(new.conditions, 'unconscious');
  end if;

  if new.current_hp = 0 then
    new.concentration := null;
    new.effects := coalesce(
      (select jsonb_agg(e) from jsonb_array_elements(new.effects) e where not coalesce((e ->> 'endsWhenDown')::boolean, false)),
      '[]'
    );
  elsif new.conditions && array['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'] then
    -- Incapacitated: the concentration ends.
    new.concentration := null;
  elsif v_lost > 0 and new.concentration is not null and new.concentration is not distinct from old.concentration then
    v_dc := least(99, greatest(10, v_lost / 2));
    if old.concentration_dc is null and new.concentration_dc is null then
      new.concentration_dc := v_dc;
    else
      new.concentration_queue := array_append(new.concentration_queue, v_dc);
    end if;
  end if;

  if new.concentration is distinct from old.concentration then
    new.concentration_dc := null;
    new.concentration_queue := '{}';
    delete from public.areas a where a.character_id = old.id and a.concentration;
  elsif new.concentration is not null and new.concentration_dc is null and cardinality(new.concentration_queue) > 0 then
    -- A save kept: the next one owed comes up.
    new.concentration_dc := new.concentration_queue[1];
    new.concentration_queue := new.concentration_queue[2:];
  end if;
  return new;
end
$$;
