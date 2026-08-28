-- =====================================================================
-- Zirclaire — 41_toyyibpay.sql
-- Adds the ToyyibPay bill reference to payments (pay-in gateway switch).
-- Run AFTER 40_currency_myr_rename.sql.
-- =====================================================================

alter table payments add column if not exists toyyibpay_billcode text;
create index if not exists idx_payments_billcode on payments(toyyibpay_billcode);
