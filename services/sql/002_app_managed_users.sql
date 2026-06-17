-- ============================================================================
-- Webbina Memory — patch 002
-- Goal: let the app manage its own user identity for now (anonymous/device id),
--       BEFORE full Supabase Auth is wired in Phase 2b.
--
-- What it changes:
--   • users.id no longer requires a matching auth.users row (FK dropped).
--   • users.email becomes optional (so a device id can exist without a login).
--
-- Safe to run multiple times. When you later enable real Supabase Auth, you can
-- re-add the FK and backfill emails.
-- ============================================================================

-- 1) Drop the foreign key users.id -> auth.users(id), if present.
do $$
declare fk text;
begin
  select conname into fk
  from pg_constraint
  where conrelid = 'public.users'::regclass
    and contype = 'f';
  if fk is not null then
    execute format('alter table public.users drop constraint %I', fk);
  end if;
end $$;

-- 2) Make email optional (kept UNIQUE so real logins stay unique when present).
alter table public.users alter column email drop not null;

-- Done. public.users is now app-managed; memory writes will succeed for any id.
