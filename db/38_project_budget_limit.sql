-- =====================================================================
-- Zirclaire — 38_project_budget_limit.sql
-- Constrain a project's budget to the allowed range: USD 100–4000.
-- Replaces the original "> 0" check. Run AFTER 37_royalty_from_projects.sql.
-- =====================================================================

alter table projects drop constraint if exists projects_budget_usd_check;
-- NOT VALID: enforce on all new/updated projects, without re-checking existing
-- rows (older demo projects may fall outside the new 100–4000 range). To also
-- enforce it on old rows later, clean them up then run:
--   alter table projects validate constraint projects_budget_usd_check;
alter table projects
  add constraint projects_budget_usd_check
  check (budget_usd >= 100 and budget_usd <= 4000) not valid;
