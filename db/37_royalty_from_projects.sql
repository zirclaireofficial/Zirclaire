-- =====================================================================
-- Zirclaire — 37_royalty_from_projects.sql
-- Aligns the Marketplace Royalty Program with Terms §16A: the SELLER of a
-- royalty item is the REQUESTER who OWNS a completed project's deliverable —
-- not a provider self-publishing. A listing is tied to a closed project, and
-- its downloadable file is that project's deliverable.
--
--   * royalty_items.project_id links a listing to the source project.
--   * one listing per project (unique).
--   * publishing is now SERVER-ONLY (a route verifies the caller owns the
--     closed project and pulls the deliverable) — the old client-side
--     "approved provider inserts" policy is removed.
-- creator_id continues to hold the SELLER — now the requester/owner. The
-- existing read/delete/sales policies (keyed on creator_id) still apply.
--
-- Run AFTER 36_royalty_split_fix.sql.
-- =====================================================================

alter table royalty_items
  add column if not exists project_id uuid references projects(id) on delete set null;

-- A completed project can be listed at most once.
create unique index if not exists uq_royalty_project
  on royalty_items(project_id) where project_id is not null;

-- Inserts move to the server (service_role), which enforces ownership + that
-- the project is closed and has a deliverable. Drop the old client policy.
drop policy if exists "royalty_items: approved provider publishes own as pending" on royalty_items;
