-- =====================================================================
-- Zirclaire — 01_enums.sql
-- Fixed value sets used across the schema. Run this FIRST.
-- =====================================================================

-- Account type. One per user, locked after approval.
create type user_role as enum (
  'service_requester',
  'service_provider',
  'admin'
);

-- KYC verification lifecycle.
create type kyc_status as enum (
  'pending',
  'approved',
  'rejected'
);

-- Project lifecycle. Matches docs/state_machine.md exactly.
create type project_status as enum (
  'draft',
  'submitted',
  'funded',
  'live',
  'awarded',
  'in_progress',
  'submitted_work',
  'in_review',
  'revision_requested',
  'finished',
  'closed',
  'cancelled'
);

-- An SP's application to a project.
create type application_status as enum (
  'applied',
  'approved',
  'rejected'
);

-- Append-only money events on a project.
create type ledger_entry_type as enum (
  'fund',        -- SR funds the project (+)
  'commission',  -- platform's 20% cut (-)
  'payout',      -- SP's 80% (-)
  'refund'       -- returned to SR on cancellation (-)
);

-- Social post lifecycle. Default is 'active' (no pre-approval).
create type post_status as enum (
  'active',
  'removed'
);

-- Moderation report lifecycle (post-moderation model).
create type report_status as enum (
  'open',
  'reviewed',
  'actioned',
  'dismissed'
);

-- Where an SP receives their payout / how an SR is identified financially.
create type payout_provider as enum (
  'binance',
  'touch_n_go'
);
