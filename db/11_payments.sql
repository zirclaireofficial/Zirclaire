-- =====================================================================
-- Zirclaire — 11_payments.sql
-- Payment records for project funding. This sits IN FRONT of the escrow
-- ledger: an SR "pays" (a claim), an admin verifies it, and only then does
-- the verified amount become a `fund` entry in escrow_ledger.
--
-- Simulated for now (no real charge). When a real rail (Binance / Touch 'n
-- Go / card) is added, `claimed` becomes "gateway says paid" and `verified`
-- becomes "funds confirmed in our account".
--
-- Run AFTER 10_functions.sql.
-- =====================================================================

create type payment_status as enum ('claimed', 'verified', 'rejected');

create table payments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  payer_id    uuid not null references profiles(id) on delete restrict,
  method      payout_provider not null,          -- binance | touch_n_go
  amount_usd  numeric(12,2) not null check (amount_usd > 0),
  reference   text,                                -- simulated transaction ref
  status      payment_status not null default 'claimed',
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_payments_project on payments(project_id);
create index idx_payments_payer   on payments(payer_id);
create index idx_payments_status  on payments(status);

alter table payments enable row level security;

-- Reads: the payer sees their own; admins see all. All writes are server-side.
create policy "payments: payer reads own"
  on payments for select using (payer_id = auth.uid());

create policy "payments: admin reads all"
  on payments for select using (is_admin(auth.uid()));
