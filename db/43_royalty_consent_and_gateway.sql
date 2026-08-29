-- =====================================================================
-- Zirclaire — 43_royalty_consent_and_gateway.sql
-- Two gaps for the royalty workflow:
--   1. Record the owner's consent/ownership declaration when they list a work.
--   2. Route royalty PURCHASES through the payment gateway (like project
--      funding): a pending royalty_payments row holds the bill until the
--      gateway confirms payment, at which point purchase_royalty runs.
-- Run AFTER 42_completion_and_payouts.sql.
-- =====================================================================

-- Owner's declaration timestamp (set at listing time; server-enforced).
alter table royalty_items add column if not exists owner_consent_at timestamptz;

-- A pending purchase held while the buyer pays via the gateway.
create table if not exists royalty_payments (
  id                 uuid primary key default gen_random_uuid(),
  item_id            uuid not null references royalty_items(id) on delete cascade,
  buyer_id           uuid not null references profiles(id) on delete restrict,
  amount_myr         numeric(12,2) not null check (amount_myr > 0),
  toyyibpay_billcode text,
  reference          text,
  status             text not null default 'pending' check (status in ('pending','paid')),
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index if not exists idx_royalty_payments_billcode on royalty_payments(toyyibpay_billcode);
create index if not exists idx_royalty_payments_buyer on royalty_payments(buyer_id, item_id);

alter table royalty_payments enable row level security;
drop policy if exists "royalty_payments: buyer reads own" on royalty_payments;
drop policy if exists "royalty_payments: staff read"      on royalty_payments;
create policy "royalty_payments: buyer reads own" on royalty_payments for select using (buyer_id = auth.uid());
create policy "royalty_payments: staff read"      on royalty_payments for select using (is_staff(auth.uid()));
