-- private.kept_sum only adds up numbers it's given (no table access), so signed-in users may call
-- it. The database tests use it to check totals as a player would see them.
grant execute on function private.kept_sum(jsonb) to authenticated;
