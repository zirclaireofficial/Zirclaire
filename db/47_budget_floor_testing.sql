-- =====================================================================
-- Zirclaire — 47_budget_floor_testing.sql
-- ⚠️ TEMPORARY (money-path testing): lower the project budget floor from
-- RM 100 to RM 1 so a project can be funded for a tiny amount on the live
-- ToyyibPay account without committing real money. Upper cap RM 4000 kept.
--
-- TO RESTORE before launch, run:
--   alter table projects drop constraint if exists projects_budget_myr_check;
--   alter table projects add constraint projects_budget_myr_check
--     check (budget_myr >= 100 and budget_myr <= 4000) not valid;
-- =====================================================================

alter table projects drop constraint if exists projects_budget_myr_check;
alter table projects
  add constraint projects_budget_myr_check
  check (budget_myr >= 1 and budget_myr <= 4000) not valid;
