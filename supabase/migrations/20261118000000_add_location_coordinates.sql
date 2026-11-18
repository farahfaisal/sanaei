-- Store exact coordinates next to the free-text location, so distances and
-- map pins use real positions instead of guessed ones.
alter table public.user_profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.craftsman_profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
