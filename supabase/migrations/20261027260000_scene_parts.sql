-- S1b: what a scene holds besides its words (docs/S1_PLAN.md section 2): planned rolls, choices
-- that lead to other scenes, things to hand out (one of the DM's items, a box, a shop to open),
-- and a fight ready to start. Kept as lists on the scene, still the DM's alone.

alter table public.story_scenes
  add column rolls jsonb not null default '[]'::jsonb check (jsonb_typeof(rolls) = 'array'),
  add column choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array'),
  add column things jsonb not null default '[]'::jsonb check (jsonb_typeof(things) = 'array'),
  add column fight jsonb check (fight is null or jsonb_typeof(fight) = 'object');

grant update (rolls, choices, things, fight) on public.story_scenes to authenticated;
