-- ============================================================================
-- TravelFamily.AI — Migration 002 : Espace Gérante (admin)
-- À exécuter dans Supabase → SQL Editor, APRÈS 001_webbina_memory.sql.
-- Ajoute : statut de compte + pass Premium sur users, et 3 tables admin
-- (gestes commerciaux / cagnotte, tickets SAV, journal d'audit RGPD).
-- ============================================================================

-- ── users : statut du compte + pass Premium accordé par la gérante ──────────
alter table public.users add column if not exists active boolean not null default true;
alter table public.users add column if not exists premium_until timestamptz;
alter table public.users add column if not exists notes text;

-- ── loyalty_adjustments : crédits cagnotte / réductions accordés au cas par cas
create table if not exists public.loyalty_adjustments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        text not null default 'credit',          -- credit | discount | premium
  amount_eur  numeric(10,2) not null default 0,        -- montant en € (cagnotte) ou % (discount)
  reason      text,
  created_by  text,                                    -- e-mail de la gérante
  created_at  timestamptz not null default now()
);
create index if not exists idx_adjust_user on public.loyalty_adjustments (user_id);

-- ── support_tickets : file SAV écrite ───────────────────────────────────────
create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete set null,
  email       text,
  subject     text,
  message     text not null,
  status      text not null default 'open',            -- open | pending | closed
  reply       text,
  priority    text default 'normal',                   -- normal | vip
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_ticket_status on public.support_tickets (status, created_at desc);

-- ── admin_audit : journal des actions de la gérante (traçabilité RGPD) ───────
create table if not exists public.admin_audit (
  id           uuid primary key default gen_random_uuid(),
  admin_email  text not null,
  action       text not null,                          -- view_user | grant_premium | credit_cagnotte | set_active | reply_ticket …
  target_user  uuid,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_audit_created on public.admin_audit (created_at desc);

-- ── RLS : ces tables ne sont accessibles QUE via le backend (service role).
-- On active RLS sans policy publique → tout passe par les endpoints admin.
alter table public.loyalty_adjustments enable row level security;
alter table public.support_tickets    enable row level security;
alter table public.admin_audit         enable row level security;
