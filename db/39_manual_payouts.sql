-- =====================================================================
-- Zirclaire — 39_manual_payouts.sql
-- Launch model: pay-in via a gateway, payouts done MANUALLY by an admin.
-- Adds the fields the manual payout queue needs on the existing payouts table:
--   * payout_method    — how to pay (touch_n_go / binance), snapshot at clear
--   * manual_reference — the transfer reference the admin records when paid
-- Run AFTER 38_project_budget_limit.sql.
-- =====================================================================

alter table payouts add column if not exists payout_method   text;
alter table payouts add column if not exists manual_reference text;
