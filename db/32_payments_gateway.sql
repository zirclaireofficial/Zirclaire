-- =====================================================================
-- Zirclaire — 32_payments_gateway.sql
-- Real payment gateway (Xendit) wiring. Amounts are treated as MYR.
-- Run AFTER all prior migrations. Server-only tables (service_role writes).
--
-- Three pieces:
--   1. xendit_events  — webhook idempotency log (each event processed once).
--   2. payments       — add columns to track the Xendit invoice.
--   3. payouts        — one row per project (UNIQUE project_id = the hard
--                       double-payout guard), with a release buffer + retry.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Webhook idempotency log. A replayed/duplicated webhook whose event_id
--    is already here is skipped, so nothing is ever processed twice.
-- ---------------------------------------------------------------------
create table if not exists xendit_events (
  id           uuid primary key default gen_random_uuid(),
  event_id     text unique not null,        -- dedupe key (Xendit id + status)
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);
alter table xendit_events enable row level security;  -- server-only, no policies

-- ---------------------------------------------------------------------
-- 2. Track the Xendit invoice on the existing payments row.
-- ---------------------------------------------------------------------
alter table payments add column if not exists xendit_invoice_id text;
alter table payments add column if not exists xendit_status     text;
alter table payments add column if not exists paid_at           timestamptz;
create index if not exists idx_payments_invoice on payments(xendit_invoice_id);

-- Gateway invoices are paid by card/FPX/e-wallet, not a fixed payout_provider,
-- so `method` is no longer required (simulator still sets binance/touch_n_go).
alter table payments alter column method drop not null;

-- ---------------------------------------------------------------------
-- 3. Payouts (money-out). UNIQUE(project_id) means a project can only ever
--    have ONE payout — the database itself blocks a second one.
--    Lifecycle: pending -> processing -> paid | failed ; 'held' = admin hold.
-- ---------------------------------------------------------------------
do $$ begin
  create type payout_status as enum ('pending','processing','paid','failed','held');
exception when duplicate_object then null; end $$;

create table if not exists payouts (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null unique references projects(id) on delete restrict,
  provider_id    uuid not null references profiles(id) on delete restrict,
  amount_myr     numeric(12,2) not null check (amount_myr > 0),
  channel_code   text,          -- Xendit disbursement channel (bank / e-wallet)
  account_number text,
  account_holder text,
  xendit_payout_id text,
  status         payout_status not null default 'pending',
  release_at     timestamptz not null,      -- buffer: don't disburse before this
  retry_count    int not null default 0,
  failed_reason  text,
  created_at     timestamptz not null default now(),
  processing_at  timestamptz,
  paid_at        timestamptz
);
create index if not exists idx_payouts_status  on payouts(status);
create index if not exists idx_payouts_release on payouts(release_at);

alter table payouts enable row level security;

-- Reads: a provider sees their own payouts; admins and master see all.
-- All writes are server-side (service_role).
create policy "payouts: provider reads own"
  on payouts for select using (provider_id = auth.uid());
create policy "payouts: admin reads all"
  on payouts for select using (is_admin(auth.uid()));
create policy "payouts: master reads all"
  on payouts for select using (is_master(auth.uid()));
