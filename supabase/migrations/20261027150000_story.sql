-- C2d: who a character is, from the builder's Who they are step: alignment, age, height, weight,
-- eyes, skin, hair, personality, ideals, bonds, flaws, goals and backstory, all optional text. The
-- player edits their own; the DM anyone's (the same row rules as every other column).

alter table public.characters
  add column story jsonb not null default '{}'
    check (jsonb_typeof(story) = 'object' and pg_column_size(story) <= 12000);

grant update (story) on public.characters to authenticated;
