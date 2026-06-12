-- ============================================================================
-- Webbina Memory — Supabase schema (PostgreSQL)
-- Migration 001
-- Run in Supabase SQL editor, or via supabase db push.
-- ============================================================================
-- Notes
--  • All user-owned tables carry user_id (auth.users) and have RLS enabled so
--    a user can only read/write their own rows.
--  • Passport numbers are sensitive. Store them encrypted at rest (pgcrypto /
--    Supabase Vault) — the `number_enc` column holds ciphertext, never plaintext.
--  • updated_at is maintained by a trigger.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── updated_at trigger helper ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ── users ───────────────────────────────────────────────────────────────────
-- Mirror of auth.users with app-level profile fields.
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text unique not null,
  full_name   text,
  locale      text not null default 'fr-FR',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── travel_profiles ─────────────────────────────────────────────────────────
-- Logistics habits Webbina reuses ("Premium au départ de Marseille").
create table if not exists public.travel_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  home_airport        text,                       -- IATA, e.g. 'MRS'
  home_city           text,                       -- 'Marseille'
  preferred_cabin     text check (preferred_cabin in
                        ('ECONOMY','PREMIUM_ECONOMY','BUSINESS','FIRST')),
  preferred_airlines  text[] not null default '{}',
  typical_budget      numeric(10,2),
  budget_currency     text not null default 'EUR',
  pace                text check (pace in ('relaxed','balanced','intense')),
  -- Webbina's auto-generated natural-language summary of this traveller.
  preference_summary  text,
  summary_updated_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id)
);

-- ── travelers ────────────────────────────────────────────────────────────────
-- The people a user habitually travels with (family members).
create table if not exists public.travelers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  full_name   text not null,
  relation    text,                               -- 'self','partner','child',...
  birthdate   date,
  is_default  boolean not null default false,     -- part of the usual party
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── passports ────────────────────────────────────────────────────────────────
-- One per traveler. Number stored encrypted (ciphertext only).
create table if not exists public.passports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  traveler_id   uuid references public.travelers (id) on delete set null,
  holder_name   text not null,
  nationality   text not null,                    -- ISO 3166-1 alpha-2
  number_enc    text,                             -- ciphertext (pgcrypto/Vault)
  number_last4  text,                             -- for display ('•••• 1234')
  issued_on     date,
  expires_on    date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── trip_preferences ─────────────────────────────────────────────────────────
-- Tastes (climate, interests, things to avoid). One row per user.
create table if not exists public.trip_preferences (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  interests       text[] not null default '{}',   -- 'beach','culture','nature'...
  climates        text[] not null default '{}',   -- 'warm','mild','snow'
  avoid           text[] not null default '{}',   -- 'long_haul','red_eye'...
  travels_with_children boolean not null default false,
  accessibility   text[] not null default '{}',
  dietary         text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id)
);

-- ── saved_trips ──────────────────────────────────────────────────────────────
-- History + saved/quoted/booked trips.
create table if not exists public.saved_trips (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  title           text not null,
  destination     text,
  country         text,
  start_date      date,
  end_date        date,
  status          text not null default 'idea'
                    check (status in ('idea','quote','booked','completed','cancelled')),
  budget_amount   numeric(10,2),
  budget_currency text not null default 'EUR',
  travelers_count int,
  summary         text,
  cover_url       text,
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── conversation_memory ──────────────────────────────────────────────────────
-- Rolling memory: raw turns, extracted facts, and periodic summaries.
create table if not exists public.conversation_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  session_id  text,
  kind        text not null default 'message'
                check (kind in ('message','fact','summary')),
  role        text check (role in ('user','assistant','system')),
  content     text not null,
  emotion     text,
  importance  int not null default 0,             -- 0..5 for retrieval ranking
  created_at  timestamptz not null default now()
);

-- ── indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_travel_profiles_user on public.travel_profiles (user_id);
create index if not exists idx_travelers_user        on public.travelers (user_id);
create index if not exists idx_passports_user        on public.passports (user_id);
create index if not exists idx_passports_expires     on public.passports (expires_on);
create index if not exists idx_trip_preferences_user on public.trip_preferences (user_id);
create index if not exists idx_saved_trips_user      on public.saved_trips (user_id, created_at desc);
create index if not exists idx_convmem_user          on public.conversation_memory (user_id, created_at desc);
create index if not exists idx_convmem_kind          on public.conversation_memory (user_id, kind);

-- ── updated_at triggers ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['users','travel_profiles','travelers','passports','trip_preferences','saved_trips']
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on public.%1$s;
       create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Each table: a user may only touch rows where user_id = auth.uid().
-- (users table keys on id = auth.uid().)
alter table public.users               enable row level security;
alter table public.travel_profiles     enable row level security;
alter table public.travelers           enable row level security;
alter table public.passports           enable row level security;
alter table public.trip_preferences    enable row level security;
alter table public.saved_trips         enable row level security;
alter table public.conversation_memory enable row level security;

drop policy if exists users_self on public.users;
create policy users_self on public.users
  using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['travel_profiles','travelers','passports','trip_preferences','saved_trips','conversation_memory']
  loop
    execute format('drop policy if exists %1$s_owner on public.%1$s;', t);
    execute format(
      'create policy %1$s_owner on public.%1$s
         using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- Note: the backend uses the service_role key, which bypasses RLS. Always scope
-- queries by user_id server-side (the memory service does this).
