-- =====================================================================
-- Zirclaire — 27_ai_support.sql
-- The AI service-desk assistant's data:
--   * kb        — the knowledge base the bot answers from. Edited ONLY via
--                 SQL (no UI), so answers stay under developer control.
--   * ai_usage  — a per-day call counter, the spend guard.
--   * conversations.escalated_at — set when the bot hands a ticket to a human.
--
-- The old canned auto-reply trigger is removed; the AI route replaces it.
--
-- Run AFTER 25/26 (service desk + tickets) and 20 (is_staff).
-- =====================================================================

-- Remove the canned two-message auto-reply; the bot handles replies now.
drop trigger if exists trg_support_autoreply on messages;
drop function if exists support_autoreply();

-- Flag a ticket that the bot has escalated to a human.
alter table conversations add column if not exists escalated_at timestamptz;

-- ---------------------------------------------------------------------
-- Knowledge base. The bot is grounded on these entries. Add/edit rows in
-- SQL to change what it knows. is_active lets you retire an answer without
-- deleting it.
-- ---------------------------------------------------------------------
create table kb (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  question   text not null,
  answer     text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_kb_updated_at before update on kb
  for each row execute function set_updated_at();

alter table kb enable row level security;
-- Only staff may read it in-app; the bot reads it server-side (service role).
create policy "kb: staff read" on kb for select using (is_staff(auth.uid()));
grant select on kb to authenticated;

insert into kb (category, question, answer) values
('accounts', 'How do I get verified / approved?',
 'After you sign up you must pass KYC: an admin reviews your submitted ID. Once approved you receive a member ID and can post, apply, and transact. Until then your account is pending and limited.'),
('accounts', 'What are the roles?',
 'A Service Requester posts projects and pays for work. A Service Provider does the work, and can also sell services and publish royalty works. You choose your role at sign-up.'),
('projects', 'How do I post a project?',
 'As an approved requester, start a new project, describe the work, set a budget and timeline, then fund it. Once payment is verified it goes live for providers to apply.'),
('projects', 'How does applying and awarding work?',
 'Providers apply to a live project. The requester reviews applicants and awards one. Bidding is blind: providers cannot see who else applied.'),
('funding', 'How does escrow work?',
 'When a project is funded, the money is held in escrow. It is released to the provider only after the requester accepts the completed work.'),
('funding', 'What commission does the platform take?',
 'The platform takes 20% of project and service work; the provider receives 80%. For royalty sales the platform takes 85% and the owner keeps 15%.'),
('funding', 'When does a provider get paid?',
 'After the requester marks the work finished and the admin clears the project, the provider is paid their 80% from escrow.'),
('services', 'What are services (MyService)?',
 'Providers offer fixed-price services with three pricing tiers. A buyer orders a tier; the order runs through the same escrow and delivery process as a project.'),
('royalties', 'What are royalties?',
 'Providers publish finished works — novels, research or journals. Buyers pay once and download the file. The platform takes 85% per sale.'),
('payments', 'What payment methods are supported?',
 'Payments are handled through Touch ''n Go and Binance. Amounts are shown in USD.'),
('accounts', 'Why is my account suspended?',
 'A suspended account is blocked from posting and transacting and hidden from others. Suspensions are applied by staff with a reason. If you believe it is a mistake, an agent can review it.'),
('support', 'How do I reach a human?',
 'Ask here and your ticket is passed to a support agent, who will reply in this thread.');

-- ---------------------------------------------------------------------
-- Spend guard: one row per day, counting AI calls. The route stops calling
-- DeepSeek past a daily cap. Server-only (no policies = no client access).
-- ---------------------------------------------------------------------
create table ai_usage (
  day   date primary key,
  calls int not null default 0
);
alter table ai_usage enable row level security;
