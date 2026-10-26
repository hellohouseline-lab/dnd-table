-- C2c: what a character carries and the coins in their purse. The inventory is a list of items
-- ({ id, item, name, quantity, weight, worn, uses }), item being the SRD index or null for one typed
-- in; the wallet holds copper, silver, electrum, gold and platinum pieces. Players change their own
-- (the same row rules as every other column); the DM changes anyone's.

alter table public.characters
  add column inventory jsonb not null default '[]'
    check (jsonb_typeof(inventory) = 'array' and pg_column_size(inventory) <= 20000),
  add column wallet jsonb not null default '{"cp": 0, "sp": 0, "ep": 0, "gp": 0, "pp": 0}'
    check (jsonb_typeof(wallet) = 'object' and pg_column_size(wallet) <= 400);

grant update (inventory, wallet) on public.characters to authenticated;
