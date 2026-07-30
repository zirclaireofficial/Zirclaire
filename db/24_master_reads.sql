-- =====================================================================
-- Zirclaire — 24_master_reads.sql
-- The master sits above admin but isn't literally role 'admin', so the
-- existing "admin reads all" policies didn't include it. This grants the
-- master the same full read on profiles that admins have, so the members
-- page shows everyone (and the master can act on any of them).
--
-- Everything else the master reads goes through master-only server endpoints
-- (service role), so this one additive policy is all that's needed here.
--
-- Run AFTER 20_master_role.sql (uses is_master).
-- =====================================================================

create policy "profiles: master reads all"
  on profiles for select using (is_master(auth.uid()));
