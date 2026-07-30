-- =====================================================================
-- Zirclaire — 26_ticket_status.sql
-- Closing support tickets. A support conversation is OPEN until an agent
-- closes it; closed_at/closed_by record the resolution. Nothing is deleted —
-- the thread stays readable as a record.
--
-- Run AFTER 18/25 (messaging + service desk).
-- =====================================================================

alter table conversations
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references profiles(id);

create index if not exists idx_conversations_closed on conversations(closed_at);
