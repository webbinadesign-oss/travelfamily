-- ============================================================================
-- TravelFamily.AI — Migration 003 : Alertes baisse de prix (price watches)
-- À exécuter dans Supabase → SQL Editor, après 002_admin.sql.
-- ============================================================================

create table if not exists public.price_watches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  origin        text not null,                      -- IATA aéroport départ
  destination   text not null,                      -- IATA arrivée
  depart_date   date,
  ref_price     numeric(10,2) not null,             -- prix au moment du suivi
  last_price    numeric(10,2),                      -- dernier prix constaté
  currency      text not null default 'EUR',
  last_checked  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_watch_user on public.price_watches (user_id, created_at desc);

alter table public.price_watches enable row level security;
