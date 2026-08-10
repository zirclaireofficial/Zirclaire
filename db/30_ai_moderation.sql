-- =====================================================================
-- Zirclaire — 30_ai_moderation.sql
-- The AI moderation sweeper flags posts by filing a REPORT — the same object
-- users file — so nothing new is needed on the admin side except telling the
-- two apart. It never blocks or deletes; the admin still decides.
--
--   * reports.source  — 'user' (a member reported it) or 'system' (the AI).
--   * reporter_id      — now nullable; a system report has no human reporter.
--
-- Run AFTER 09_rls_social.sql (reports) and 20 (is_master).
-- =====================================================================

alter table reports add column if not exists source text not null default 'user'
  check (source in ('user', 'system'));

-- System reports have no human reporter.
alter table reports alter column reporter_id drop not null;

-- The master oversees moderation too, so it can read reports.
create policy "reports: master reads" on reports for select using (is_master(auth.uid()));
