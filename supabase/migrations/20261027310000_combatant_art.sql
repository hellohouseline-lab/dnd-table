-- Ready-made portraits on monsters' miniatures. When the DM adds a monster from the free rules that
-- has one (a goblin, a zombie), its key goes on the creature's row, which everyone in the fight can
-- read, so players' maps show the picture too. The pictures themselves are served from the site
-- (public/art/tokens); only the key is stored. Players never add combatants, so only the DM sets it.

alter table public.combatants
  add column art text check (art ~ '^[a-z0-9-]{1,40}$');
