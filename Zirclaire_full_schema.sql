-- =====================================================================
-- Zirclaire — FULL SCHEMA (all migrations 01..31, in order, as-is)
-- Generated 2026-08-11  ·  run top-to-bottom in the Supabase SQL editor.
-- NOTE: 13_create_admin and 22_create_master contain default email/
--       password/name values — change them if you don't want the defaults.
--       29 uses pg_cron (enable the extension or ignore the schedule line).
--       Regenerate TypeScript types after running.
-- =====================================================================


-- #####################################################################
-- ###  01_enums.sql
-- #####################################################################

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


-- #####################################################################
-- ###  02_reference.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 02_reference.sql
-- Static reference data: countries + the project category taxonomy.
-- Run AFTER 01_enums.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Countries
-- member_prefix is the 3-char prefix used when generating member IDs,
-- e.g. Malaysia -> 'MYR' so a requester becomes MYRSR00001.
-- ---------------------------------------------------------------------
create table countries (
  id            smallint generated always as identity primary key,
  name          text     not null unique,
  iso2          char(2)  not null unique,
  dial_code     text     not null,
  member_prefix char(3)  not null unique,
  is_active     boolean  not null default true,
  created_at    timestamptz not null default now()
);

insert into countries (name, iso2, dial_code, member_prefix) values
  ('Malaysia', 'MY', '+60', 'MYR');

-- ---------------------------------------------------------------------
-- Categories (20 top-level) + subcategories
-- ---------------------------------------------------------------------
create table categories (
  id         smallint generated always as identity primary key,
  name       text     not null unique,
  position   smallint not null,
  created_at timestamptz not null default now()
);

create table subcategories (
  id          int      generated always as identity primary key,
  category_id smallint not null references categories(id) on delete cascade,
  name        text     not null,
  position    smallint not null,
  created_at  timestamptz not null default now(),
  unique (category_id, name)
);

create index idx_subcategories_category on subcategories(category_id);

-- Seed categories -----------------------------------------------------
insert into categories (name, position) values
  ('Technology & IT', 1),
  ('Marketing & Advertising', 2),
  ('Creative & Media', 3),
  ('Education', 4),
  ('Professional', 5),
  ('Finance', 6),
  ('Business Management', 7),
  ('Health (Services)', 8),
  ('Recruitment / Hiring', 9),
  ('Real Estate', 10),
  ('Entertainment', 11),
  ('Events', 12),
  ('Travel & Tourism', 13),
  ('Language', 14),
  ('Research', 15),
  ('Security', 16),
  ('Religious & Community', 17),
  ('Digital Platform Services', 18),
  ('Skill-Based Services', 19),
  ('On-Demand Services (Gig Economy)', 20);

-- Seed subcategories (mapped to category by name) ---------------------
insert into subcategories (category_id, name, position)
select c.id, v.name, v.position
from categories c
join (values
  -- 1. Technology & IT
  ('Technology & IT', 'Website development', 1),
  ('Technology & IT', 'Mobile app development', 2),
  ('Technology & IT', 'Software development', 3),
  ('Technology & IT', 'UI/UX design', 4),
  ('Technology & IT', 'Cybersecurity', 5),
  ('Technology & IT', 'Cloud hosting', 6),
  ('Technology & IT', 'Database management', 7),
  ('Technology & IT', 'DevOps', 8),
  ('Technology & IT', 'AI development', 9),
  ('Technology & IT', 'Machine learning consulting', 10),
  ('Technology & IT', 'Blockchain development', 11),
  ('Technology & IT', 'API integration', 12),
  ('Technology & IT', 'IT support', 13),
  ('Technology & IT', 'Data analysis', 14),
  ('Technology & IT', 'Data science', 15),
  -- 2. Marketing & Advertising
  ('Marketing & Advertising', 'Digital marketing', 1),
  ('Marketing & Advertising', 'SEO', 2),
  ('Marketing & Advertising', 'SEM/PPC', 3),
  ('Marketing & Advertising', 'Social media management', 4),
  ('Marketing & Advertising', 'Influencer marketing', 5),
  ('Marketing & Advertising', 'Email marketing', 6),
  ('Marketing & Advertising', 'Affiliate marketing', 7),
  ('Marketing & Advertising', 'Content marketing', 8),
  ('Marketing & Advertising', 'Branding', 9),
  ('Marketing & Advertising', 'Market research', 10),
  ('Marketing & Advertising', 'Copywriting', 11),
  -- 3. Creative & Media
  ('Creative & Media', 'Graphic design', 1),
  ('Creative & Media', 'Logo design', 2),
  ('Creative & Media', 'Video editing', 3),
  ('Creative & Media', 'Animation', 4),
  ('Creative & Media', 'Motion graphics', 5),
  ('Creative & Media', 'Voice over', 6),
  ('Creative & Media', 'Script writing', 7),
  ('Creative & Media', 'Content creation', 8),
  ('Creative & Media', 'Podcast production', 9),
  ('Creative & Media', 'Photography editing', 10),
  ('Creative & Media', 'Illustration', 11),
  -- 4. Education
  ('Education', 'Tutor', 1),
  ('Education', 'Online classes', 2),
  ('Education', 'Coaching', 3),
  ('Education', 'Corporate training', 4),
  ('Education', 'Language teaching', 5),
  ('Education', 'Skill training', 6),
  ('Education', 'Academic mentoring', 7),
  ('Education', 'Exam preparation', 8),
  -- 5. Professional
  ('Professional', 'Accounting', 1),
  ('Professional', 'Audit', 2),
  ('Professional', 'Taxation', 3),
  ('Professional', 'Legal services', 4),
  ('Professional', 'Notary', 5),
  ('Professional', 'Business consulting', 6),
  ('Professional', 'Financial consulting', 7),
  ('Professional', 'HR consulting', 8),
  ('Professional', 'Operations consulting', 9),
  -- 6. Finance
  ('Finance', 'Financial planning', 1),
  ('Finance', 'Wealth management', 2),
  ('Finance', 'Insurance advisory', 3),
  ('Finance', 'Investment advisory', 4),
  ('Finance', 'Bookkeeping', 5),
  ('Finance', 'Payroll management', 6),
  -- 7. Business Management
  ('Business Management', 'Virtual assistant', 1),
  ('Business Management', 'Customer support', 2),
  ('Business Management', 'Call center', 3),
  ('Business Management', 'Data entry', 4),
  ('Business Management', 'Project management', 5),
  ('Business Management', 'Business process outsourcing (BPO)', 6),
  -- 8. Health (Services)
  ('Health (Services)', 'Telemedicine', 1),
  ('Health (Services)', 'Counseling', 2),
  ('Health (Services)', 'Psychotherapy', 3),
  ('Health (Services)', 'Diet consultation', 4),
  ('Health (Services)', 'Fitness coaching', 5),
  ('Health (Services)', 'Wellness coaching', 6),
  -- 9. Recruitment / Hiring
  ('Recruitment / Hiring', 'Recruitment', 1),
  ('Recruitment / Hiring', 'Headhunting', 2),
  ('Recruitment / Hiring', 'Resume writing', 3),
  ('Recruitment / Hiring', 'Career coaching', 4),
  ('Recruitment / Hiring', 'Talent sourcing', 5),
  -- 10. Real Estate
  ('Real Estate', 'Property management', 1),
  ('Real Estate', 'Property consultancy', 2),
  ('Real Estate', 'Property valuation', 3),
  ('Real Estate', 'Real estate agency', 4),
  -- 11. Entertainment
  ('Entertainment', 'DJ', 1),
  ('Entertainment', 'MC', 2),
  ('Entertainment', 'Live streaming host', 3),
  ('Entertainment', 'Event host', 4),
  ('Entertainment', 'Gaming coach', 5),
  ('Entertainment', 'Esports coaching', 6),
  -- 12. Events
  ('Events', 'Event planning', 1),
  ('Events', 'Wedding planning', 2),
  ('Events', 'Event management', 3),
  ('Events', 'Event coordination', 4),
  -- 13. Travel & Tourism
  ('Travel & Tourism', 'Travel planning', 1),
  ('Travel & Tourism', 'Tour guide', 2),
  ('Travel & Tourism', 'Visa consultancy', 3),
  ('Travel & Tourism', 'Travel concierge', 4),
  -- 14. Language
  ('Language', 'Translation', 1),
  ('Language', 'Interpretation', 2),
  ('Language', 'Transcription', 3),
  ('Language', 'Localization', 4),
  -- 15. Research
  ('Research', 'Research service', 1),
  ('Research', 'Feasibility study', 2),
  ('Research', 'Data collection', 3),
  ('Research', 'Survey management', 4),
  -- 16. Security
  ('Security', 'Security consulting', 1),
  ('Security', 'Risk assessment', 2),
  ('Security', 'Compliance consulting', 3),
  -- 17. Religious & Community
  ('Religious & Community', 'Religious talks', 1),
  ('Religious & Community', 'Community management', 2),
  ('Religious & Community', 'Motivational speaking', 3),
  ('Religious & Community', 'Spiritual coaching', 4),
  -- 18. Digital Platform Services
  ('Digital Platform Services', 'Marketplace operator', 1),
  ('Digital Platform Services', 'SaaS subscription', 2),
  ('Digital Platform Services', 'Social media platform', 3),
  ('Digital Platform Services', 'Freelance platform', 4),
  ('Digital Platform Services', 'Membership platform', 5),
  -- 19. Skill-Based Services
  ('Skill-Based Services', 'Proofreading', 1),
  ('Skill-Based Services', 'Editing', 2),
  ('Skill-Based Services', 'Resume review', 3),
  ('Skill-Based Services', 'Pitch deck creation', 4),
  ('Skill-Based Services', 'Presentation design', 5),
  -- 20. On-Demand Services (Gig Economy)
  ('On-Demand Services (Gig Economy)', 'Freelancer', 1),
  ('On-Demand Services (Gig Economy)', 'Consultant', 2),
  ('On-Demand Services (Gig Economy)', 'Advisor', 3),
  ('On-Demand Services (Gig Economy)', 'Expert-on-demand', 4),
  ('On-Demand Services (Gig Economy)', 'Remote support', 5)
) as v(category_name, name, position)
  on v.category_name = c.name;

-- ---------------------------------------------------------------------
-- Security: enable RLS now (deny-by-default). These are public lookup
-- tables; world-readable SELECT policies are added in the RLS step.
-- ---------------------------------------------------------------------
alter table countries     enable row level security;
alter table categories    enable row level security;
alter table subcategories enable row level security;


-- #####################################################################
-- ###  03_identity.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 03_identity.sql
-- Users (profiles), KYC data, and localized member-ID generation.
-- Run AFTER 02_reference.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Per-(country, role) counter that powers SR/SP member IDs.
-- Admins use a separate global sequence (below).
-- ---------------------------------------------------------------------
create table member_id_counters (
  country_id  smallint  not null references countries(id) on delete cascade,
  role        user_role not null,
  last_number int       not null default 0,
  primary key (country_id, role)
);

-- Global counter for admin IDs (ADM00001, ADM00002, ...).
create sequence admin_member_seq start 1;

-- ---------------------------------------------------------------------
-- Profiles: one row per authenticated user.
-- FK to Supabase's auth.users. The app inserts this row at signup with
-- the KYC form data; admins are provisioned internally.
--
-- Most KYC fields are nullable at the DB level (admins don't have them);
-- required-ness for SR/SP signups is enforced in the application layer.
-- ---------------------------------------------------------------------
create table profiles (
  id                 uuid        primary key references auth.users(id) on delete cascade,
  role               user_role   not null,

  -- Identity / KYC
  full_name          text        not null,           -- as per national ID
  email              text        not null,
  phone              text,                            -- includes country code
  home_address       text,
  id_document_number text,                            -- national ID / passport no
  country_id         smallint    references countries(id),

  -- Payout / financial receiving account
  payout_provider    payout_provider,
  payout_account     text,

  -- Media (Cloudinary public IDs)
  id_document_image  text,                            -- sensitive: admin/owner only
  profile_picture    text,

  -- Verification
  kyc_status         kyc_status  not null default 'pending',
  kyc_reviewed_by    uuid        references profiles(id),
  kyc_reviewed_at    timestamptz,
  kyc_reject_reason  text,
  member_id          text        unique,              -- null until approved

  -- Housekeeping
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_profiles_role       on profiles(role);
create index idx_profiles_kyc_status on profiles(kyc_status);
create index idx_profiles_country    on profiles(country_id);

-- ---------------------------------------------------------------------
-- Generic updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Member-ID generation
-- Fires when a profile transitions INTO 'approved' and has no ID yet.
-- Format:  <country_prefix><role_token><5+ digit number>   e.g. MYRSR00001
--          admins:  ADM<5+ digit number>                   e.g. ADM00001
-- The per-(country, role) counter is incremented atomically via UPSERT,
-- so concurrent approvals never collide or skip.
-- ---------------------------------------------------------------------
create or replace function assign_member_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix     text;
  v_role_token text;
  v_number     int;
begin
  if new.kyc_status = 'approved'
     and (old.kyc_status is distinct from 'approved')
     and new.member_id is null
  then
    if new.role = 'admin' then
      v_number := nextval('admin_member_seq');
      new.member_id := 'ADM' || lpad(v_number::text, 5, '0');
    else
      if new.country_id is null then
        raise exception 'country_id is required to generate a member_id for role %', new.role;
      end if;

      v_role_token := case new.role
        when 'service_requester' then 'SR'
        when 'service_provider'  then 'SP'
      end;

      insert into member_id_counters (country_id, role, last_number)
        values (new.country_id, new.role, 1)
      on conflict (country_id, role)
        do update set last_number = member_id_counters.last_number + 1
      returning last_number into v_number;

      select member_prefix into v_prefix
        from countries where id = new.country_id;

      new.member_id := v_prefix || v_role_token || lpad(v_number::text, 5, '0');
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_assign_member_id
  before update on profiles
  for each row
  execute function assign_member_id();

-- ---------------------------------------------------------------------
-- Security: enable RLS now (deny-by-default). Access policies are added
-- in the dedicated RLS step. The server (service_role key) bypasses RLS
-- for privileged admin/escrow operations.
-- (Reference tables enable their own RLS in 02_reference.sql.)
-- ---------------------------------------------------------------------
alter table member_id_counters enable row level security;
alter table profiles           enable row level security;


-- #####################################################################
-- ###  04_projects.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 04_projects.sql
-- Projects and their surrounding tables: attachments, applications,
-- deliverables, reviews. Run AFTER 03_identity.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Projects
-- Created by a Service Requester. Moves through the state machine in
-- docs/state_machine.md. Timeline is stored as a duration; the live
-- countdown deadline is computed when the Admin pushes it live.
-- ---------------------------------------------------------------------
create table projects (
  id                     uuid primary key default gen_random_uuid(),
  requester_id           uuid not null references profiles(id) on delete restrict,

  -- Brief
  title                  text not null,
  description            text,
  subcategory_id         int  references subcategories(id),
  requirements           text[],                       -- up to N requirement lines
  budget_usd             numeric(12,2) not null check (budget_usd > 0),
  timeline_minutes       int check (timeline_minutes is null or timeline_minutes > 0),

  status                 project_status not null default 'draft',

  -- Assign mode: if set, the project is handed directly to one provider
  -- and skips open bidding. NULL = open to applications.
  assigned_provider_id   uuid references profiles(id),

  -- Escrow snapshot (authoritative money trail lives in escrow_ledger)
  funded_amount_usd      numeric(12,2),

  -- Awarding
  awarded_provider_id    uuid references profiles(id),
  awarded_application_id uuid,   -- FK added after `applications` exists (below)

  -- Lifecycle timestamps
  went_live_at           timestamptz,
  deadline_at            timestamptz,   -- went_live_at + timeline; drives countdown
  started_at             timestamptz,
  finished_at            timestamptz,
  closed_at              timestamptz,
  cancelled_at           timestamptz,
  cancel_reason          text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_projects_requester   on projects(requester_id);
create index idx_projects_status      on projects(status);
create index idx_projects_subcategory on projects(subcategory_id);
create index idx_projects_assigned    on projects(assigned_provider_id);
create index idx_projects_awarded     on projects(awarded_provider_id);
create index idx_projects_deadline    on projects(deadline_at);

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Project attachments — example PDFs the SR attaches to the brief.
-- Stores Cloudinary references, not the files themselves.
-- ---------------------------------------------------------------------
create table project_attachments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  media_url   text not null,           -- Cloudinary path
  media_type  text,                    -- 'pdf', 'image', ...
  label       text,
  created_at  timestamptz not null default now()
);

create index idx_project_attachments_project on project_attachments(project_id);

-- ---------------------------------------------------------------------
-- Applications — an SP applies to a live project.
-- One application per (project, provider). A requester cannot apply to
-- their own project (guarded by trigger below).
-- ---------------------------------------------------------------------
create table applications (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  provider_id uuid not null references profiles(id) on delete cascade,
  status      application_status not null default 'applied',
  cover_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, provider_id)
);

create index idx_applications_project  on applications(project_id);
create index idx_applications_provider on applications(provider_id);

create trigger trg_applications_updated_at
  before update on applications
  for each row execute function set_updated_at();

-- No self-dealing: a project's requester cannot be an applicant.
create or replace function prevent_self_application()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from projects p
    where p.id = new.project_id
      and p.requester_id = new.provider_id
  ) then
    raise exception 'A requester cannot apply to their own project';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_application
  before insert on applications
  for each row execute function prevent_self_application();

-- Now that `applications` exists, wire the project's awarded application.
alter table projects
  add constraint fk_projects_awarded_application
  foreign key (awarded_application_id) references applications(id) on delete set null;

-- ---------------------------------------------------------------------
-- Deliverables — the SP's submitted work (PDF / video), versioned so a
-- revision request produces a new version rather than overwriting.
-- ---------------------------------------------------------------------
create table deliverables (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  provider_id  uuid not null references profiles(id) on delete restrict,
  version      int  not null default 1,
  media_url    text not null,           -- Cloudinary path (sensitive)
  media_type   text,                    -- 'pdf' | 'video'
  note         text,
  submitted_at timestamptz not null default now(),
  unique (project_id, version)
);

create index idx_deliverables_project on deliverables(project_id);

-- ---------------------------------------------------------------------
-- Reviews — the SR's decision on a submitted deliverable:
-- either request a revision (loops back) or accept it (→ finished).
-- ---------------------------------------------------------------------
create table reviews (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  reviewer_id    uuid not null references profiles(id) on delete restrict,
  deliverable_id uuid references deliverables(id) on delete set null,
  decision       text not null check (decision in ('revision_requested', 'accepted')),
  reason         text,
  created_at     timestamptz not null default now()
);

create index idx_reviews_project on reviews(project_id);

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS (policies added later).
-- ---------------------------------------------------------------------
alter table projects            enable row level security;
alter table project_attachments enable row level security;
alter table applications        enable row level security;
alter table deliverables        enable row level security;
alter table reviews             enable row level security;


-- #####################################################################
-- ###  05_escrow.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 05_escrow.sql
-- The money trail. Append-only ledger; a project's held balance is the
-- SUM of its entries. Run AFTER 04_projects.sql.
--
-- Sign convention (so SUM = current balance):
--   fund       > 0   SR funds the project
--   commission < 0   platform's 20% cut
--   payout     < 0   SP's 80%
--   refund     < 0   returned to SR on cancellation
-- Invariants:
--   after 'closed'  : SUM(entries) = 0  (fund fully distributed 20/80)
--   after 'cancelled' (was funded): fund + refund = 0
-- =====================================================================

create table escrow_ledger (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  entry_type ledger_entry_type not null,
  amount_usd numeric(12,2) not null,
  created_by uuid references profiles(id),   -- admin who recorded it
  note       text,
  created_at timestamptz not null default now(),

  -- Enforce the sign convention at the database level.
  constraint chk_ledger_sign check (
    (entry_type = 'fund' and amount_usd > 0)
    or (entry_type in ('commission', 'payout', 'refund') and amount_usd < 0)
  )
);

create index idx_ledger_project on escrow_ledger(project_id);
create index idx_ledger_type    on escrow_ledger(entry_type);

-- ---------------------------------------------------------------------
-- Append-only guard: block UPDATE and DELETE outright. Corrections are
-- made with compensating entries, never edits — preserving a full audit
-- trail. (service_role is NOT exempt from triggers, unlike RLS.)
-- ---------------------------------------------------------------------
create or replace function forbid_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'escrow_ledger is append-only; % is not permitted', tg_op;
end;
$$;

create trigger trg_ledger_no_update
  before update on escrow_ledger
  for each row execute function forbid_ledger_mutation();

create trigger trg_ledger_no_delete
  before delete on escrow_ledger
  for each row execute function forbid_ledger_mutation();

-- ---------------------------------------------------------------------
-- Convenience: current held balance per project.
-- ---------------------------------------------------------------------
create view project_balances as
  select
    p.id                              as project_id,
    coalesce(sum(l.amount_usd), 0)    as balance_usd,
    p.funded_amount_usd,
    p.status
  from projects p
  left join escrow_ledger l on l.project_id = p.id
  group by p.id;

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS (policies added later).
-- ---------------------------------------------------------------------
alter table escrow_ledger enable row level security;


-- #####################################################################
-- ###  06_social.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 06_social.sql
-- The main-page social feed: posts, media, comments, engagement, and
-- reactive moderation (reports). Run AFTER 05_escrow.sql.
--
-- Moderation model: posts go live IMMEDIATELY (status 'active'). There
-- is no pre-approval. The posts/comments tables are intentionally
-- UNAWARE of moderation — they carry no moderation fields.
--   * reactive  — users file `reports`; an admin reviews (built here).
--   * automated — a FUTURE, fully external "sweeper" (fail-open async)
--                 reads new posts, calls an AI screening API, records its
--                 findings in its OWN separate table, and — to take a post
--                 down — simply flips the post's status to 'removed', the
--                 same lever a human admin uses. Nothing here changes when
--                 that is added; feed visibility stays centralised in the
--                 `feed_posts` view + the RLS SELECT policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Posts — top-level entries authored by Service Providers.
-- Engagement counts are denormalised and kept accurate by triggers.
-- ---------------------------------------------------------------------
create table posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references profiles(id) on delete cascade,
  body           text,
  status         post_status not null default 'active',

  -- Denormalised engagement counters (maintained by triggers below).
  favorite_count int not null default 0,
  comment_count  int not null default 0,
  share_count    int not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_posts_author  on posts(author_id);
create index idx_posts_status  on posts(status);
create index idx_posts_created on posts(created_at desc);

create trigger trg_posts_updated_at
  before update on posts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Post media — up to 3 images/videos per post (Cloudinary references).
-- unique(post_id, position) + position 1..3 caps a post at 3 items.
-- ---------------------------------------------------------------------
create table post_media (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  media_url  text not null,
  media_type text,                       -- 'image' | 'video'
  position   smallint not null default 1 check (position between 1 and 3),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

create index idx_post_media_post on post_media(post_id);

-- ---------------------------------------------------------------------
-- Comments — by SRs or SPs. Optional threading via parent_comment_id.
-- Like posts, comments carry no moderation fields (see header note).
-- ---------------------------------------------------------------------
create table comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references posts(id) on delete cascade,
  author_id         uuid not null references profiles(id) on delete cascade,
  parent_comment_id uuid references comments(id) on delete cascade,
  body              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_comments_post   on comments(post_id);
create index idx_comments_author on comments(author_id);
create index idx_comments_parent on comments(parent_comment_id);

create trigger trg_comments_updated_at
  before update on comments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Comment media — media attached within a comment (SRs can attach media).
-- ---------------------------------------------------------------------
create table comment_media (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  media_url  text not null,
  media_type text,
  position   smallint not null default 1,
  created_at timestamptz not null default now()
);

create index idx_comment_media_comment on comment_media(comment_id);

-- ---------------------------------------------------------------------
-- Engagement: favorites (one per user per post) and shares (a log).
-- ---------------------------------------------------------------------
create table post_favorites (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table post_shares (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_post_shares_post on post_shares(post_id);

-- ---------------------------------------------------------------------
-- Reports — reactive moderation. A user flags a post or comment; an
-- admin resolves it. Exactly one target must be set (enforced by check).
-- ---------------------------------------------------------------------
create table reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  post_id     uuid references posts(id) on delete cascade,
  comment_id  uuid references comments(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason      text,
  status      report_status not null default 'open',
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),

  constraint chk_report_target check (
    (target_type = 'post'    and post_id    is not null and comment_id is null) or
    (target_type = 'comment' and comment_id is not null and post_id    is null)
  )
);

create index idx_reports_status  on reports(status);
create index idx_reports_post    on reports(post_id);
create index idx_reports_comment on reports(comment_id);

-- ---------------------------------------------------------------------
-- Engagement counter maintenance (keeps posts.*_count accurate).
-- SECURITY DEFINER so the counter UPDATE on posts is not blocked by RLS
-- (posts have no client UPDATE policy) — this is system bookkeeping.
-- ---------------------------------------------------------------------
create or replace function bump_favorite_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update posts set favorite_count = favorite_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set favorite_count = greatest(favorite_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end; $$;

create trigger trg_favorite_count
  after insert or delete on post_favorites
  for each row execute function bump_favorite_count();

create or replace function bump_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end; $$;

create trigger trg_comment_count
  after insert or delete on comments
  for each row execute function bump_comment_count();

create or replace function bump_share_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update posts set share_count = share_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set share_count = greatest(share_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end; $$;

create trigger trg_share_count
  after insert or delete on post_shares
  for each row execute function bump_share_count();

-- ---------------------------------------------------------------------
-- Central feed visibility. THE single place that decides what appears
-- publicly: active posts only. The future sweeper takes a post down by
-- setting status = 'removed', so it drops out of this view automatically
-- — no change needed here. security_invoker = on so row-level security
-- still applies through the view.
-- ---------------------------------------------------------------------
create view feed_posts with (security_invoker = on) as
  select *
  from posts
  where status = 'active';

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS (policies added later).
-- ---------------------------------------------------------------------
alter table posts          enable row level security;
alter table post_media     enable row level security;
alter table comments       enable row level security;
alter table comment_media  enable row level security;
alter table post_favorites enable row level security;
alter table post_shares    enable row level security;
alter table reports        enable row level security;

-- #####################################################################
-- ###  07_rls_identity.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 07_rls_identity.sql
-- Row-Level Security for the identity + reference layer.
-- Run AFTER the schema files (01–06).
--
-- Principle (agreed): the browser reads via RLS; all sensitive/money
-- writes go through server routes using the secret key (which bypasses
-- RLS). So here we define READ access; profile writes are handled by the
-- server and need no client policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER so they read profiles WITHOUT
-- triggering RLS (prevents policy recursion on the profiles table).
-- ---------------------------------------------------------------------
create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = uid and role = 'admin'
  );
$$;

create or replace function is_approved(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = uid and kyc_status = 'approved'
  );
$$;

-- Role of the currently authenticated user (null if not logged in).
create or replace function auth_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Reference data — public lookup tables, readable by everyone.
-- (Writes only ever happen via the server / migrations.)
-- ---------------------------------------------------------------------
create policy "countries: readable by all"
  on countries for select using (true);

create policy "categories: readable by all"
  on categories for select using (true);

create policy "subcategories: readable by all"
  on subcategories for select using (true);

-- ---------------------------------------------------------------------
-- Profiles — the locked table.
-- Only the owner and admins can read the full row (with all its PII).
-- Everyone else is denied. No client INSERT/UPDATE/DELETE policies:
-- profile creation (signup) and edits go through server routes.
-- ---------------------------------------------------------------------
create policy "profiles: owner reads own"
  on profiles for select using (id = auth.uid());

create policy "profiles: admin reads all"
  on profiles for select using (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- Public window over the locked table. A normal (definer-rights) view,
-- so it can read past the table's RLS — but it only ever selects the
-- safe columns, and only for approved users. This is what profile pages
-- and post author bylines read.
-- ---------------------------------------------------------------------
create view public_profiles as
  select
    id,
    member_id,
    full_name,
    role,
    profile_picture,
    country_id,
    created_at
  from profiles
  where kyc_status = 'approved';

grant select on public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- member_id_counters: no client policy, by design. RLS is enabled
-- (deny-all); the counter rows are written only by the assign_member_id()
-- SECURITY DEFINER trigger during KYC approval, never directly by a client.
-- ---------------------------------------------------------------------

-- #####################################################################
-- ###  08_rls_projects.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 08_rls_projects.sql
-- Row-Level Security for projects, applications, deliverables, reviews,
-- attachments, and the escrow ledger. Run AFTER 07_rls_identity.sql.
--
-- Door legend (from the agreed map):
--   READS  -> browser via RLS (defined here)
--   WRITES -> almost all are server-only (secret key bypasses RLS), so
--             they have NO client policy. The one browser write is an SP
--             applying to a live project.
--
-- Cross-table checks go through SECURITY DEFINER helpers so they bypass
-- RLS internally and cannot cause policy recursion.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visibility helpers
-- ---------------------------------------------------------------------

-- Can the current user see this project? Requester, awarded/assigned
-- provider, an applicant, any approved provider (if it is live), or admin.
create or replace function can_view_project(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select
    exists (
      select 1 from projects p
      where p.id = pid and (
        p.requester_id = auth.uid()
        or p.awarded_provider_id = auth.uid()
        or p.assigned_provider_id = auth.uid()
        or (p.status = 'live' and auth_role() = 'service_provider' and is_approved(auth.uid()))
        or exists (
          select 1 from applications a
          where a.project_id = p.id and a.provider_id = auth.uid()
        )
      )
    )
    or is_admin(auth.uid());
$$;

-- Is the current user the requester (owner) of this project?
create or replace function owns_project(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from projects where id = pid and requester_id = auth.uid()
  );
$$;

-- Is the current user a principal party to this project (requester or the
-- awarded provider)? Used for deliverables / reviews / escrow reads.
create or replace function is_project_party(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from projects
    where id = pid
      and (requester_id = auth.uid() or awarded_provider_id = auth.uid())
  );
$$;

-- Is this project currently live (accepting applications)?
create or replace function project_is_live(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from projects where id = pid and status = 'live'
  );
$$;

-- ---------------------------------------------------------------------
-- Projects — read only from the browser; all writes are server-side.
-- ---------------------------------------------------------------------
create policy "projects: visible to parties, applicants, live feed, admin"
  on projects for select using (can_view_project(id));

-- ---------------------------------------------------------------------
-- Project attachments — visible to anyone who can see the project.
-- ---------------------------------------------------------------------
create policy "attachments: visible with project"
  on project_attachments for select using (can_view_project(project_id));

-- ---------------------------------------------------------------------
-- Applications
--   read : the applying SP sees ONLY their own (blind bidding);
--          the requester sees all applicants on their own projects;
--          admin sees all.
--   write: an approved SP may INSERT their own application to a live
--          project (the one browser write). Approve/reject is server-side.
-- ---------------------------------------------------------------------
create policy "applications: provider reads own"
  on applications for select using (provider_id = auth.uid());

create policy "applications: requester reads applicants on own projects"
  on applications for select using (owns_project(project_id));

create policy "applications: admin reads all"
  on applications for select using (is_admin(auth.uid()));

create policy "applications: approved provider applies to live project"
  on applications for insert with check (
    provider_id = auth.uid()
    and auth_role() = 'service_provider'
    and is_approved(auth.uid())
    and project_is_live(project_id)
  );

-- ---------------------------------------------------------------------
-- Deliverables / Reviews / Escrow ledger — read by the project's parties
-- (requester + awarded provider) and admin. All writes are server-side.
-- ---------------------------------------------------------------------
create policy "deliverables: visible to project parties"
  on deliverables for select using (is_project_party(project_id) or is_admin(auth.uid()));

create policy "reviews: visible to project parties"
  on reviews for select using (is_project_party(project_id) or is_admin(auth.uid()));

create policy "escrow: visible to project parties"
  on escrow_ledger for select using (is_project_party(project_id) or is_admin(auth.uid()));


-- #####################################################################
-- ###  09_rls_social.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 09_rls_social.sql
-- Row-Level Security for the social feed. Run AFTER 08_rls_projects.sql.
--
-- Agreed rules:
--   * Feed is PUBLIC to read (anonymous visitors included) — active posts,
--     their media, and comments are world-readable.
--   * Any WRITE requires an approved, logged-in user (RLS blocks anon;
--     the UI additionally shows a sign-up modal).
--   * Posts: only approved SPs create; author may DELETE own; NO editing
--     (no update policy exists).
--   * Comments: any approved SR or SP; author deletes own.
--   * Favorites/shares: each user manages their own.
--   * Reports: anyone approved may file; only admin (and the reporter)
--     can read them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visibility / ownership helpers (SECURITY DEFINER -> no policy recursion)
-- ---------------------------------------------------------------------
create or replace function post_is_visible(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from posts
    where id = pid and (status = 'active' or author_id = auth.uid())
  ) or is_admin(auth.uid());
$$;

create or replace function owns_post(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from posts where id = pid and author_id = auth.uid());
$$;

create or replace function comment_is_visible(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from comments c join posts p on p.id = c.post_id
    where c.id = cid and (p.status = 'active' or c.author_id = auth.uid())
  ) or is_admin(auth.uid());
$$;

create or replace function owns_comment(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from comments where id = cid and author_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Posts
--   read   : public — active posts; author also sees own; admin sees all.
--   insert : approved Service Providers, authoring as themselves.
--   delete : the author (hard delete). Admin removal is server-side.
--   update : intentionally none (editing is disabled by design).
-- ---------------------------------------------------------------------
create policy "posts: public reads active; author/admin read all"
  on posts for select using (
    status = 'active' or author_id = auth.uid() or is_admin(auth.uid())
  );

create policy "posts: approved provider creates own"
  on posts for insert with check (
    author_id = auth.uid()
    and auth_role() = 'service_provider'
    and is_approved(auth.uid())
  );

create policy "posts: author deletes own"
  on posts for delete using (author_id = auth.uid());

-- ---------------------------------------------------------------------
-- Post media — visible with the post; written/removed by the post author.
-- ---------------------------------------------------------------------
create policy "post_media: visible with post"
  on post_media for select using (post_is_visible(post_id));

create policy "post_media: author inserts"
  on post_media for insert with check (owns_post(post_id));

create policy "post_media: author deletes"
  on post_media for delete using (owns_post(post_id));

-- ---------------------------------------------------------------------
-- Comments
--   read   : public (on visible posts).
--   insert : any approved user (SR or SP) on a visible post.
--   delete : the author. Admin removal is server-side.
-- ---------------------------------------------------------------------
create policy "comments: visible on visible posts"
  on comments for select using (post_is_visible(post_id));

create policy "comments: approved user comments on visible post"
  on comments for insert with check (
    author_id = auth.uid()
    and is_approved(auth.uid())
    and post_is_visible(post_id)
  );

create policy "comments: author deletes own"
  on comments for delete using (author_id = auth.uid());

-- ---------------------------------------------------------------------
-- Comment media — visible with the comment; managed by the comment author.
-- ---------------------------------------------------------------------
create policy "comment_media: visible with comment"
  on comment_media for select using (comment_is_visible(comment_id));

create policy "comment_media: author inserts"
  on comment_media for insert with check (owns_comment(comment_id));

create policy "comment_media: author deletes"
  on comment_media for delete using (owns_comment(comment_id));

-- ---------------------------------------------------------------------
-- Favorites & shares — each user manages only their own rows.
-- (Public-facing counts come from the denormalised columns on posts.)
-- ---------------------------------------------------------------------
create policy "favorites: user reads own"
  on post_favorites for select using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "favorites: approved user adds own"
  on post_favorites for insert with check (user_id = auth.uid() and is_approved(auth.uid()));

create policy "favorites: user removes own"
  on post_favorites for delete using (user_id = auth.uid());

create policy "shares: user reads own"
  on post_shares for select using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "shares: approved user adds own"
  on post_shares for insert with check (user_id = auth.uid() and is_approved(auth.uid()));

create policy "shares: user removes own"
  on post_shares for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Reports
--   read   : the reporter (their own) and admin.
--   insert : any approved user files a report as themselves.
--   resolve: server-side (admin), so no client update policy.
-- ---------------------------------------------------------------------
create policy "reports: reporter and admin read"
  on reports for select using (reporter_id = auth.uid() or is_admin(auth.uid()));

create policy "reports: approved user files own"
  on reports for insert with check (reporter_id = auth.uid() and is_approved(auth.uid()));


-- #####################################################################
-- ###  10_functions.sql
-- #####################################################################

-- =====================================================================
-- Zirclaive — 10_functions.sql
-- The project state machine as atomic transition functions. Each moves a
-- project between exactly the states allowed by docs/state_machine.md, and
-- (for money transitions) writes the escrow ledger in the SAME transaction,
-- so status and money can never diverge.
--
-- These are called ONLY by the server (service_role). Execute is revoked
-- from public and granted to service_role at the bottom. Authorization of
-- WHO may call each one is done in the server route; these functions own
-- the atomic transition + the legal-state guard.
--
-- Run AFTER 05_escrow.sql (needs projects, applications, deliverables,
-- reviews, escrow_ledger). Safe to run alongside the RLS files.
-- =====================================================================

-- submitted -> funded  (+ escrow fund entry)
create or replace function fund_project(p_project uuid, p_amount numeric, p_actor uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'fund amount must be positive';
  end if;
  update projects set status = 'funded', funded_amount_usd = p_amount
    where id = p_project and status = 'submitted'
    returning * into r;
  if not found then raise exception 'project % is not in submitted state', p_project; end if;
  insert into escrow_ledger(project_id, entry_type, amount_usd, created_by)
    values (p_project, 'fund', p_amount, p_actor);
  return r;
end; $$;

-- funded -> live  (starts the countdown)
create or replace function push_project_live(p_project uuid, p_deadline timestamptz)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects set status = 'live', went_live_at = now(), deadline_at = p_deadline
    where id = p_project and status = 'funded'
    returning * into r;
  if not found then raise exception 'project % is not in funded state', p_project; end if;
  return r;
end; $$;

-- live -> awarded  (chosen application approved, the rest rejected)
create or replace function award_applicant(p_project uuid, p_application uuid)
returns projects language plpgsql as $$
declare r projects; v_provider uuid;
begin
  select provider_id into v_provider from applications
    where id = p_application and project_id = p_project;
  if v_provider is null then raise exception 'application % not found on project %', p_application, p_project; end if;

  update projects
    set status = 'awarded', awarded_provider_id = v_provider, awarded_application_id = p_application
    where id = p_project and status = 'live'
    returning * into r;
  if not found then raise exception 'project % is not in live state', p_project; end if;

  update applications set status = 'approved' where id = p_application;
  update applications set status = 'rejected'
    where project_id = p_project and id <> p_application and status = 'applied';
  return r;
end; $$;

-- awarded -> in_progress  (SP begins work)
create or replace function start_work(p_project uuid, p_provider uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects set status = 'in_progress', started_at = now()
    where id = p_project and status = 'awarded' and awarded_provider_id = p_provider
    returning * into r;
  if not found then raise exception 'project % not awarded to this provider or not in awarded state', p_project; end if;
  return r;
end; $$;

-- in_progress|revision_requested -> submitted_work  (+ new deliverable version)
create or replace function submit_deliverable(
  p_project uuid, p_provider uuid, p_media_url text, p_media_type text, p_note text)
returns projects language plpgsql as $$
declare r projects; v_version int;
begin
  update projects set status = 'submitted_work'
    where id = p_project and status in ('in_progress', 'revision_requested')
      and awarded_provider_id = p_provider
    returning * into r;
  if not found then raise exception 'project % not in a workable state for this provider', p_project; end if;

  select coalesce(max(version), 0) + 1 into v_version from deliverables where project_id = p_project;
  insert into deliverables(project_id, provider_id, version, media_url, media_type, note)
    values (p_project, p_provider, v_version, p_media_url, p_media_type, p_note);
  return r;
end; $$;

-- submitted_work -> in_review  (SR opens the submission)
create or replace function open_review(p_project uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects set status = 'in_review'
    where id = p_project and status = 'submitted_work'
    returning * into r;
  if not found then raise exception 'project % is not in submitted_work state', p_project; end if;
  return r;
end; $$;

-- in_review -> revision_requested  (+ review row)
create or replace function request_revision(p_project uuid, p_reviewer uuid, p_reason text)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects set status = 'revision_requested'
    where id = p_project and status = 'in_review'
    returning * into r;
  if not found then raise exception 'project % is not in in_review state', p_project; end if;
  insert into reviews(project_id, reviewer_id, decision, reason)
    values (p_project, p_reviewer, 'revision_requested', p_reason);
  return r;
end; $$;

-- in_review -> finished  (+ accepted review row)
create or replace function accept_work(p_project uuid, p_reviewer uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects set status = 'finished', finished_at = now()
    where id = p_project and status = 'in_review'
    returning * into r;
  if not found then raise exception 'project % is not in in_review state', p_project; end if;
  insert into reviews(project_id, reviewer_id, decision)
    values (p_project, p_reviewer, 'accepted');
  return r;
end; $$;

-- finished -> closed  (+ commission 20% and payout 80% ledger entries)
create or replace function clear_project(p_project uuid, p_actor uuid)
returns projects language plpgsql as $$
declare r projects; v_amount numeric;
begin
  select * into r from projects where id = p_project;
  if not found then raise exception 'project % not found', p_project; end if;
  if r.status <> 'finished' then raise exception 'project % is not in finished state', p_project; end if;

  v_amount := coalesce(r.funded_amount_usd, 0);
  update projects set status = 'closed', closed_at = now() where id = p_project returning * into r;
  insert into escrow_ledger(project_id, entry_type, amount_usd, created_by) values
    (p_project, 'commission', -round(v_amount * 0.20, 2), p_actor),
    (p_project, 'payout',     -round(v_amount * 0.80, 2), p_actor);
  return r;
end; $$;

-- active -> cancelled  (+ refund of any held balance)
create or replace function cancel_project(p_project uuid, p_reason text, p_actor uuid)
returns projects language plpgsql as $$
declare r projects; v_balance numeric;
begin
  select * into r from projects where id = p_project;
  if not found then raise exception 'project % not found', p_project; end if;
  if r.status not in ('submitted','funded','live','awarded','in_progress','revision_requested','submitted_work','in_review') then
    raise exception 'project % cannot be cancelled from % state', p_project, r.status;
  end if;

  v_balance := coalesce((select sum(amount_usd) from escrow_ledger where project_id = p_project), 0);
  if v_balance > 0 then
    insert into escrow_ledger(project_id, entry_type, amount_usd, created_by)
      values (p_project, 'refund', -v_balance, p_actor);
  end if;
  update projects set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
    where id = p_project returning * into r;
  return r;
end; $$;

-- ---------------------------------------------------------------------
-- Lock these down: only the server (service_role) may execute them.
-- ---------------------------------------------------------------------
revoke execute on function fund_project(uuid,numeric,uuid)               from public;
revoke execute on function push_project_live(uuid,timestamptz)           from public;
revoke execute on function award_applicant(uuid,uuid)                    from public;
revoke execute on function start_work(uuid,uuid)                         from public;
revoke execute on function submit_deliverable(uuid,uuid,text,text,text)  from public;
revoke execute on function open_review(uuid)                             from public;
revoke execute on function request_revision(uuid,uuid,text)              from public;
revoke execute on function accept_work(uuid,uuid)                        from public;
revoke execute on function clear_project(uuid,uuid)                      from public;
revoke execute on function cancel_project(uuid,text,uuid)                from public;

grant execute on function fund_project(uuid,numeric,uuid)               to service_role;
grant execute on function push_project_live(uuid,timestamptz)           to service_role;
grant execute on function award_applicant(uuid,uuid)                    to service_role;
grant execute on function start_work(uuid,uuid)                         to service_role;
grant execute on function submit_deliverable(uuid,uuid,text,text,text)  to service_role;
grant execute on function open_review(uuid)                             to service_role;
grant execute on function request_revision(uuid,uuid,text)              to service_role;
grant execute on function accept_work(uuid,uuid)                        to service_role;
grant execute on function clear_project(uuid,uuid)                      to service_role;
grant execute on function cancel_project(uuid,text,uuid)                to service_role;


-- #####################################################################
-- ###  11_payments.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 11_payments.sql
-- Payment records for project funding. This sits IN FRONT of the escrow
-- ledger: an SR "pays" (a claim), an admin verifies it, and only then does
-- the verified amount become a `fund` entry in escrow_ledger.
--
-- Simulated for now (no real charge). When a real rail (Binance / Touch 'n
-- Go / card) is added, `claimed` becomes "gateway says paid" and `verified`
-- becomes "funds confirmed in our account".
--
-- Run AFTER 10_functions.sql.
-- =====================================================================

create type payment_status as enum ('claimed', 'verified', 'rejected');

create table payments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  payer_id    uuid not null references profiles(id) on delete restrict,
  method      payout_provider not null,          -- binance | touch_n_go
  amount_usd  numeric(12,2) not null check (amount_usd > 0),
  reference   text,                                -- simulated transaction ref
  status      payment_status not null default 'claimed',
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_payments_project on payments(project_id);
create index idx_payments_payer   on payments(payer_id);
create index idx_payments_status  on payments(status);

alter table payments enable row level security;

-- Reads: the payer sees their own; admins see all. All writes are server-side.
create policy "payments: payer reads own"
  on payments for select using (payer_id = auth.uid());

create policy "payments: admin reads all"
  on payments for select using (is_admin(auth.uid()));


-- #####################################################################
-- ###  12_social_grants.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 12_social_grants.sql
-- Explicit table/view privileges for the public feed.
--
-- RLS decides WHICH ROWS a role may see; GRANT decides whether the role may
-- touch the table at all. Supabase's default privileges usually cover this,
-- but the feed is the one part of the app anonymous visitors must reach (for
-- SEO), so it is stated outright here rather than left to a default.
--
-- Row visibility is still entirely governed by the policies in
-- 09_rls_social.sql — these grants add no access beyond them.
--
-- Safe to re-run.
-- =====================================================================

-- Read side: the feed and everything hanging off it.
grant select on feed_posts    to anon, authenticated;
grant select on posts         to anon, authenticated;
grant select on post_media    to anon, authenticated;
grant select on comments      to anon, authenticated;
grant select on comment_media to anon, authenticated;

-- Write side: signed-in members only. RLS still restricts these to approved
-- users, correct roles, and own rows.
grant insert, delete on posts          to authenticated;
grant insert, delete on post_media     to authenticated;
grant insert, delete on comments       to authenticated;
grant insert, delete on comment_media  to authenticated;
grant insert, delete on post_favorites to authenticated;
grant insert, delete on post_shares    to authenticated;
grant select                on post_favorites to authenticated;
grant select                on post_shares    to authenticated;

-- Reports: file one, read your own (admins read all — same policy).
grant select, insert on reports to authenticated;


-- #####################################################################
-- ###  13_create_admin.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 13_create_admin.sql
-- Provision an ADMIN account (auth user + profile) from the SQL editor.
--
-- ⚠ This writes directly into auth.users, which is GoTrue's private schema.
--   It works, but it is NOT officially supported: if Supabase changes the
--   auth schema, hand-written rows can break. The supported alternative is
--   Dashboard → Authentication → Users → Add user (tick "Auto Confirm
--   User"), then run PART 2 of this file only.
--
-- Admins are provisioned internally — they never go through KYC signup —
-- so this is the intended way to make one.
--
-- EDIT THE THREE VALUES BELOW, then run the whole file.
-- =====================================================================

do $$
declare
  -- ------------------------------------------------------------------
  v_email    text := 'admin@zirclaire.com';   -- << change
  v_password text := 'ChangeThisNow!2026';    -- << change
  v_name     text := 'Zirclaire Admin';       -- << change
  -- ------------------------------------------------------------------
  v_user_id  uuid;
begin
  -- Refuse to run twice for the same email rather than creating a duplicate.
  if exists (select 1 from auth.users where email = lower(v_email)) then
    raise exception 'A user with email % already exists', v_email;
  end if;

  v_user_id := gen_random_uuid();

  -- ---------------- PART 1: the auth user ----------------
  -- encrypted_password uses bcrypt via pgcrypto, which is what GoTrue
  -- expects. email_confirmed_at is stamped so there's no confirmation step.
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    lower(v_email),
    crypt(v_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    false
  );

  -- GoTrue also needs a matching identity row, or email/password sign-in
  -- fails even though the user exists.
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email), 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  -- ---------------- PART 2: the profile ----------------
  -- Inserted as 'pending' first, then updated to 'approved'. That is
  -- deliberate: assign_member_id() is a BEFORE UPDATE trigger, so it only
  -- fires on the transition INTO approved. Inserting as approved directly
  -- would leave member_id null.
  insert into profiles (id, role, full_name, email, kyc_status)
  values (v_user_id, 'admin', v_name, lower(v_email), 'pending');

  update profiles
     set kyc_status = 'approved',
         kyc_reviewed_at = now()
   where id = v_user_id;

  raise notice 'Admin created: % (id %)', v_email, v_user_id;
end $$;

-- Check it worked — member_id should read ADM00001, ADM00002, ...
select p.member_id, p.full_name, p.email, p.role, p.kyc_status,
       u.email_confirmed_at is not null as email_confirmed
from profiles p
join auth.users u on u.id = p.id
where p.role = 'admin'
order by p.created_at;


-- #####################################################################
-- ###  14_royalties.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 14_royalties.sql
-- The royalty store: providers publish finished works (novels, research,
-- journals); buyers pay once and get permanent download access.
--
-- How this differs from projects, and why it's a separate domain:
--   * Provider-initiated, not requester-initiated. No bidding, no award.
--   * INSTANT one-time sale — there is NO escrow hold and NO deliver/review
--     loop. The money splits at the moment of purchase: 15% platform, 85%
--     creator. (Projects hold funds in escrow for the whole lifecycle; a
--     royalty sale is settled immediately, so it needs its own ledger.)
--   * The work already exists. The file is uploaded at publish time and
--     stored PRIVATE (Cloudinary access_mode=authenticated), reachable only
--     via a server-signed URL — the same mechanism as KYC documents.
--
-- Approval: like KYC, an admin approves an item before it is public. Until
-- then only its creator (and admins) can see it.
--
-- Run AFTER 03_identity.sql (needs profiles). Independent of projects.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

-- The three kinds of work the client named. Kept as an enum so the store
-- can filter/browse by type and nothing outside this set can be published.
create type royalty_work_type as enum (
  'novel',
  'research',
  'journal'
);

-- Publication lifecycle. Mirrors the post/KYC pattern: created hidden,
-- made public on approval, hideable again by an admin (or the future sweeper).
create type royalty_item_status as enum (
  'pending',    -- submitted, awaiting admin approval (creator-only visible)
  'approved',   -- public in the store
  'rejected',   -- admin declined it
  'removed'     -- taken down after being public
);

-- Money events on a royalty sale. Separate from ledger_entry_type because
-- royalties have no 'fund' or 'refund' — a sale settles in one shot.
create type royalty_entry_type as enum (
  'sale',        -- buyer pays (+)
  'commission',  -- platform's 15% cut (-)
  'payout'       -- creator's 85% (-)
);

-- ---------------------------------------------------------------------
-- Items — one row per published work.
-- ---------------------------------------------------------------------
create table royalty_items (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references profiles(id) on delete cascade,

  work_type    royalty_work_type not null,
  title        text not null,
  description  text,

  price_usd    numeric(12,2) not null check (price_usd > 0),

  -- Cloudinary references. file_url is the private downloadable asset;
  -- cover_image is a public thumbnail for the store listing.
  file_url     text not null,
  file_type    text,                     -- 'pdf', 'epub', ...
  cover_image  text,

  status       royalty_item_status not null default 'pending',
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  reject_reason text,

  -- Denormalised counters (kept accurate by the purchase function/trigger).
  purchase_count int not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_royalty_items_creator on royalty_items(creator_id);
create index idx_royalty_items_status  on royalty_items(status);
create index idx_royalty_items_type    on royalty_items(work_type);
create index idx_royalty_items_created on royalty_items(created_at desc);

create trigger trg_royalty_items_updated_at
  before update on royalty_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Purchases — one row per buyer per item. The unique constraint enforces
-- "buy once": a second purchase of the same item by the same buyer is
-- rejected at the database level (they already have permanent access).
-- ---------------------------------------------------------------------
create table royalty_purchases (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references royalty_items(id) on delete restrict,
  buyer_id      uuid not null references profiles(id) on delete restrict,

  -- Price snapshot at purchase time (the item's price may change later).
  amount_usd    numeric(12,2) not null check (amount_usd > 0),
  commission_usd numeric(12,2) not null,   -- platform 15%
  payout_usd    numeric(12,2) not null,    -- creator 85%

  reference     text,                      -- simulated gateway reference
  purchased_at  timestamptz not null default now(),

  unique (item_id, buyer_id)
);

create index idx_royalty_purchases_item  on royalty_purchases(item_id);
create index idx_royalty_purchases_buyer on royalty_purchases(buyer_id);

-- ---------------------------------------------------------------------
-- Ledger — append-only money trail for royalty sales, mirroring the escrow
-- ledger's discipline. Each purchase writes three rows (sale, commission,
-- payout) that sum to zero, so the platform's and creators' balances are
-- always reconstructable and never edited in place.
-- ---------------------------------------------------------------------
create table royalty_ledger (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references royalty_purchases(id) on delete restrict,
  item_id     uuid not null references royalty_items(id) on delete restrict,
  entry_type  royalty_entry_type not null,
  amount_usd  numeric(12,2) not null,
  created_at  timestamptz not null default now(),

  constraint chk_royalty_ledger_sign check (
    (entry_type = 'sale' and amount_usd > 0)
    or (entry_type in ('commission', 'payout') and amount_usd < 0)
  )
);

create index idx_royalty_ledger_purchase on royalty_ledger(purchase_id);
create index idx_royalty_ledger_item     on royalty_ledger(item_id);

-- Append-only guard: corrections are compensating entries, never edits.
create trigger trg_royalty_ledger_no_update
  before update on royalty_ledger
  for each row execute function forbid_ledger_mutation();

create trigger trg_royalty_ledger_no_delete
  before delete on royalty_ledger
  for each row execute function forbid_ledger_mutation();

-- ---------------------------------------------------------------------
-- Public store view. THE single place that decides what's publicly
-- browsable: approved items only. An item taken down (status 'removed')
-- drops out automatically — same pattern as feed_posts.
-- security_invoker so row-level security still applies through the view.
-- ---------------------------------------------------------------------
create view royalty_store with (security_invoker = on) as
  select
    id, creator_id, work_type, title, description,
    price_usd, cover_image, file_type, purchase_count, created_at
  from royalty_items
  where status = 'approved';

-- Note: the view deliberately omits file_url. The downloadable asset is
-- never exposed by a browse query — access to it goes through a server
-- route that first checks the caller has purchased the item.

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS. Policies live in 15_rls_royalties.sql.
-- ---------------------------------------------------------------------
alter table royalty_items     enable row level security;
alter table royalty_purchases enable row level security;
alter table royalty_ledger    enable row level security;


-- #####################################################################
-- ###  15_rls_royalties.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 15_rls_royalties.sql
-- Row-Level Security + the purchase transition for the royalty store.
-- Run AFTER 14_royalties.sql.
--
-- Agreed rules:
--   * Store is PUBLIC to read (anonymous included) — APPROVED items only.
--   * A creator sees their own items in any state (drafts, rejected...).
--   * Publishing an item: an approved Service Provider inserts their own,
--     as 'pending'. Approval flips it to 'approved' (server/admin only).
--   * Buying: the purchase + the 15/85 split happen in ONE server-side
--     function (below), so a sale can never record money without access,
--     or access without money.
--   * Downloading the file: NOT governed here — it goes through a server
--     route that checks a purchase exists before signing a Cloudinary URL.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visibility helpers (SECURITY DEFINER -> no policy recursion)
-- ---------------------------------------------------------------------
create or replace function royalty_item_is_visible(iid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from royalty_items
    where id = iid and (status = 'approved' or creator_id = auth.uid())
  ) or is_admin(auth.uid());
$$;

create or replace function owns_royalty_item(iid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from royalty_items where id = iid and creator_id = auth.uid());
$$;

-- Has the caller bought this item? Drives download access + "owned" badges.
create or replace function has_purchased(iid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from royalty_purchases where item_id = iid and buyer_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Items
--   read   : public — approved items; creator sees own drafts; admin all.
--   insert : an approved Service Provider, authoring their own, as pending.
--   update : none from the client (approval + edits are server-side).
--   delete : the creator may remove their own (hard delete).
-- ---------------------------------------------------------------------
create policy "royalty_items: public reads approved; creator/admin read all"
  on royalty_items for select using (
    status = 'approved' or creator_id = auth.uid() or is_admin(auth.uid())
  );

create policy "royalty_items: approved provider publishes own as pending"
  on royalty_items for insert with check (
    creator_id = auth.uid()
    and auth_role() = 'service_provider'
    and is_approved(auth.uid())
    and status = 'pending'
  );

create policy "royalty_items: creator deletes own"
  on royalty_items for delete using (creator_id = auth.uid());

-- ---------------------------------------------------------------------
-- Purchases
--   read   : the buyer sees their own; the creator sees sales of their
--            items; admin sees all. (Creators need this for their sales
--            history; buyers for their library.)
--   insert : NONE from the client — purchasing is the server function
--            below, so money and access are always written together.
-- ---------------------------------------------------------------------
create policy "royalty_purchases: buyer reads own"
  on royalty_purchases for select using (buyer_id = auth.uid());

create policy "royalty_purchases: creator reads sales of own items"
  on royalty_purchases for select using (
    exists (select 1 from royalty_items i where i.id = item_id and i.creator_id = auth.uid())
  );

create policy "royalty_purchases: admin reads all"
  on royalty_purchases for select using (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- Ledger — same visibility as the purchase it belongs to (buyer, the
-- item's creator, admin). Append-only; no client writes.
-- ---------------------------------------------------------------------
create policy "royalty_ledger: parties and admin read"
  on royalty_ledger for select using (
    is_admin(auth.uid())
    or exists (
      select 1 from royalty_purchases p
      where p.id = purchase_id
        and (p.buyer_id = auth.uid()
             or exists (select 1 from royalty_items i where i.id = p.item_id and i.creator_id = auth.uid()))
    )
  );

-- ---------------------------------------------------------------------
-- Purchase transition (atomic). Called ONLY by the server (service_role).
-- Records the purchase and the three ledger rows (sale / commission /
-- payout) in one transaction. Guards:
--   * the item must be approved (you can't buy a draft or removed work),
--   * a buyer cannot buy their own work,
--   * buying twice is blocked by the unique(item_id, buyer_id) constraint.
-- Commission is 15%; payout is the remaining 85%.
-- ---------------------------------------------------------------------
create or replace function purchase_royalty(p_item uuid, p_buyer uuid, p_reference text)
returns royalty_purchases language plpgsql as $$
declare
  v_item       royalty_items;
  v_amount     numeric(12,2);
  v_commission numeric(12,2);
  v_payout     numeric(12,2);
  v_purchase   royalty_purchases;
begin
  select * into v_item from royalty_items where id = p_item;
  if not found then raise exception 'royalty item % not found', p_item; end if;
  if v_item.status <> 'approved' then
    raise exception 'royalty item % is not available for purchase', p_item;
  end if;
  if v_item.creator_id = p_buyer then
    raise exception 'a creator cannot buy their own work';
  end if;

  v_amount     := v_item.price_usd;
  v_commission := round(v_amount * 0.15, 2);   -- platform 15%
  v_payout     := v_amount - v_commission;      -- creator 85% (exact, no rounding drift)

  -- unique(item_id, buyer_id) turns a repeat purchase into a clean error.
  insert into royalty_purchases (item_id, buyer_id, amount_usd, commission_usd, payout_usd, reference)
    values (p_item, p_buyer, v_amount, v_commission, v_payout, p_reference)
    returning * into v_purchase;

  insert into royalty_ledger (purchase_id, item_id, entry_type, amount_usd) values
    (v_purchase.id, p_item, 'sale',        v_amount),
    (v_purchase.id, p_item, 'commission', -v_commission),
    (v_purchase.id, p_item, 'payout',     -v_payout);

  update royalty_items set purchase_count = purchase_count + 1 where id = p_item;

  return v_purchase;
end; $$;

-- Locked to the server, like the project state-machine functions.
revoke execute on function purchase_royalty(uuid, uuid, text) from public;
grant execute on function purchase_royalty(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- Grants. RLS decides the rows; these decide table access at all.
-- ---------------------------------------------------------------------
grant select on royalty_store to anon, authenticated;
grant select on royalty_items to anon, authenticated;
grant select, insert, delete on royalty_items to authenticated;
grant select on royalty_purchases to authenticated;
grant select on royalty_ledger    to authenticated;


-- #####################################################################
-- ###  16_services.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 16_services.sql
-- "My Services": a provider publishes a fixed-price service offered at up to
-- three tiers (the provider names and describes each tier themselves). A buyer
-- picks a tier and orders it.
--
-- The key design decision (agreed): an order does NOT get its own money engine.
-- Buying a tier creates a PROJECT that is pre-awarded to the provider and
-- pre-funded with the tier price, then runs through the exact same
-- escrow -> deliver -> review -> payout loop as a commissioned project. It
-- simply skips the submitted/live/bidding/award steps. So there is nothing new
-- on the money side — 20% commission, the escrow ledger, start_work,
-- submit_deliverable, accept_work, clear_project are all reused as-is.
--
-- What's new here is only the LISTING (services + service_tiers) and the one
-- atomic order function that creates the pre-awarded project.
--
-- Approval: like royalties/KYC, an admin approves a listing before it's public.
--
-- Run AFTER 05_escrow.sql and 10_functions.sql (needs projects + escrow +
-- the state-machine functions the order flows into).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Listing lifecycle. Mirrors the royalty/KYC pattern.
-- ---------------------------------------------------------------------
create type service_status as enum (
  'pending',    -- submitted, awaiting admin approval (provider-only visible)
  'approved',   -- public in the services store
  'rejected',   -- admin declined it
  'removed'     -- taken down after being public
);

-- ---------------------------------------------------------------------
-- Services — one row per published service listing.
-- ---------------------------------------------------------------------
create table services (
  id             uuid primary key default gen_random_uuid(),
  provider_id    uuid not null references profiles(id) on delete cascade,
  subcategory_id int references subcategories(id),

  title          text not null,
  description    text,
  cover_image    text,                     -- Cloudinary public id (optional)

  status         service_status not null default 'pending',
  reviewed_by    uuid references profiles(id),
  reviewed_at    timestamptz,
  reject_reason  text,

  order_count    int not null default 0,   -- denormalised, kept by the order fn

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_services_provider on services(provider_id);
create index idx_services_status   on services(status);
create index idx_services_subcat   on services(subcategory_id);
create index idx_services_created  on services(created_at desc);

create trigger trg_services_updated_at
  before update on services
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Tiers — up to three per service. position 1..3 + unique(service,position)
-- caps it at three. The provider names each tier and writes what's included,
-- so "what a tier means" is their call, not ours.
-- ---------------------------------------------------------------------
create table service_tiers (
  id               uuid primary key default gen_random_uuid(),
  service_id       uuid not null references services(id) on delete cascade,
  position         smallint not null check (position between 1 and 3),

  name             text not null,           -- e.g. 'Basic', 'Standard', 'Premium'
  price_usd        numeric(12,2) not null check (price_usd > 0),
  description      text,                     -- what the buyer gets at this tier
  delivery_minutes int check (delivery_minutes is null or delivery_minutes > 0),

  created_at       timestamptz not null default now(),
  unique (service_id, position)
);

create index idx_service_tiers_service on service_tiers(service_id);

-- ---------------------------------------------------------------------
-- Link a project back to the service order it came from. NULL for ordinary
-- commissioned (bidding) projects; set for service orders. This is the only
-- change to the projects table — the money/state machinery is untouched.
-- ---------------------------------------------------------------------
alter table projects
  add column service_id      uuid references services(id),
  add column service_tier_id uuid references service_tiers(id);

create index idx_projects_service on projects(service_id);

-- ---------------------------------------------------------------------
-- Public store view — approved services only, safe columns. Tiers are
-- fetched alongside in the app layer (a service has 1–3 of them). A removed
-- listing drops out automatically, same pattern as feed_posts / royalty_store.
-- ---------------------------------------------------------------------
create view service_store with (security_invoker = on) as
  select id, provider_id, subcategory_id, title, description, cover_image, order_count, created_at
  from services
  where status = 'approved';

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS. Policies + the order function are in
-- 17_rls_services.sql.
-- ---------------------------------------------------------------------
alter table services      enable row level security;
alter table service_tiers enable row level security;


-- #####################################################################
-- ###  17_rls_services.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 17_rls_services.sql
-- RLS for service listings + the atomic order function. Run AFTER 16_services.sql.
--
-- Agreed rules:
--   * Store is PUBLIC to read (anonymous included) — APPROVED listings only.
--   * A provider sees their own listings in any state, and manages their tiers.
--   * Publishing a listing: an approved Service Provider inserts their own,
--     as 'pending'; approval (server/admin) flips it to 'approved'.
--   * Ordering a tier creates a pre-awarded, pre-funded project in ONE server
--     function (below) — so an order can never exist without its escrow entry.
--   * The order itself is a normal project from then on: existing project RLS
--     (requester = buyer, awarded provider) already governs who can see it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visibility helpers (SECURITY DEFINER -> no policy recursion)
-- ---------------------------------------------------------------------
create or replace function service_is_visible(sid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from services
    where id = sid and (status = 'approved' or provider_id = auth.uid())
  ) or is_admin(auth.uid());
$$;

create or replace function owns_service(sid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from services where id = sid and provider_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Services
--   read   : public — approved; provider sees own drafts; admin all.
--   insert : an approved Service Provider, authoring own, as pending.
--   delete : the provider (hard delete).
--   update : none from the client (approval + edits are server-side).
-- ---------------------------------------------------------------------
create policy "services: public reads approved; provider/admin read all"
  on services for select using (
    status = 'approved' or provider_id = auth.uid() or is_admin(auth.uid())
  );

create policy "services: approved provider publishes own as pending"
  on services for insert with check (
    provider_id = auth.uid()
    and auth_role() = 'service_provider'
    and is_approved(auth.uid())
    and status = 'pending'
  );

create policy "services: provider deletes own"
  on services for delete using (provider_id = auth.uid());

-- ---------------------------------------------------------------------
-- Tiers — visible with their service; created/removed by the service owner
-- at publish time (a safe write, no money involved).
-- ---------------------------------------------------------------------
create policy "service_tiers: visible with service"
  on service_tiers for select using (service_is_visible(service_id));

create policy "service_tiers: owner inserts"
  on service_tiers for insert with check (owns_service(service_id));

create policy "service_tiers: owner deletes"
  on service_tiers for delete using (owns_service(service_id));

-- ---------------------------------------------------------------------
-- Order a service tier (atomic). Called ONLY by the server (service_role).
-- Creates a project that is:
--   * owned by the buyer (requester_id),
--   * pre-awarded to the provider (awarded_provider_id),
--   * pre-funded with the tier price (status 'awarded' + escrow 'fund' entry),
--   * tagged with service_id + service_tier_id.
-- From here the provider calls start_work, and the rest of the existing state
-- machine (submit -> review -> accept -> clear, 20/80) runs unchanged.
-- Guards: the service must be approved; a provider can't buy their own service.
-- ---------------------------------------------------------------------
create or replace function order_service(p_tier uuid, p_buyer uuid)
returns projects language plpgsql as $$
declare
  v_tier     service_tiers;
  v_service  services;
  v_deadline timestamptz;
  r          projects;
begin
  select * into v_tier from service_tiers where id = p_tier;
  if not found then raise exception 'service tier % not found', p_tier; end if;

  select * into v_service from services where id = v_tier.service_id;
  if v_service.status <> 'approved' then
    raise exception 'service % is not available for ordering', v_service.id;
  end if;
  if v_service.provider_id = p_buyer then
    raise exception 'a provider cannot order their own service';
  end if;

  if v_tier.delivery_minutes is not null then
    v_deadline := now() + make_interval(mins => v_tier.delivery_minutes);
  end if;

  -- A pre-awarded, pre-funded project. Price is snapshotted into budget_usd /
  -- funded_amount_usd so a later tier price change never affects this order.
  insert into projects (
    requester_id, title, description, subcategory_id, budget_usd,
    status, awarded_provider_id, funded_amount_usd,
    service_id, service_tier_id, deadline_at
  ) values (
    p_buyer, v_service.title, v_service.description, v_service.subcategory_id, v_tier.price_usd,
    'awarded', v_service.provider_id, v_tier.price_usd,
    v_tier.service_id, p_tier, v_deadline
  ) returning * into r;

  insert into escrow_ledger (project_id, entry_type, amount_usd, created_by)
    values (r.id, 'fund', v_tier.price_usd, p_buyer);

  update services set order_count = order_count + 1 where id = v_service.id;

  return r;
end; $$;

revoke execute on function order_service(uuid, uuid) from public;
grant execute on function order_service(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- Grants. RLS decides the rows; these decide table access at all.
-- ---------------------------------------------------------------------
grant select on service_store to anon, authenticated;
grant select on services      to anon, authenticated;
grant select on service_tiers to anon, authenticated;
grant insert, delete on services      to authenticated;
grant insert, delete on service_tiers to authenticated;


-- #####################################################################
-- ###  18_messaging.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 18_messaging.sql
-- Direct messaging. Two kinds of conversation:
--   * project  — the buyer and the awarded provider on a project or service
--                order, so they can coordinate the work. Scoped to a real
--                transaction (discourages taking the deal off-platform).
--   * support  — a member and the admin team (the "service desk"). Starts in
--                a shared admin queue; the FIRST admin to claim it owns it,
--                and it then leaves every other admin's queue.
--
-- A bot may later sit in front of the support flow and hand off to a human;
-- nothing here needs to change for that — the bot would just be another way
-- messages get created.
--
-- Run AFTER 04_projects.sql (needs projects + profiles).
-- =====================================================================

create type conversation_type as enum ('project', 'support');

-- ---------------------------------------------------------------------
-- Conversations. One thread per project (the unique constraint enforces it);
-- many support threads, each owned by one member.
-- ---------------------------------------------------------------------
create table conversations (
  id                uuid primary key default gen_random_uuid(),
  type              conversation_type not null,

  project_id        uuid references projects(id) on delete cascade,   -- project threads
  created_by        uuid references profiles(id) on delete set null,  -- who opened it
  assigned_admin_id uuid references profiles(id) on delete set null,  -- support: the claimer

  last_message_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A project thread has a project; a support thread doesn't.
  constraint chk_conversation_target check (
    (type = 'project' and project_id is not null) or
    (type = 'support' and project_id is null)
  ),
  -- Exactly one thread per project. (NULLs aren't unique in Postgres, so this
  -- doesn't constrain support threads.)
  unique (project_id)
);

create index idx_conversations_project on conversations(project_id);
create index idx_conversations_type    on conversations(type);
create index idx_conversations_admin   on conversations(assigned_admin_id);
create index idx_conversations_last    on conversations(last_message_at desc nulls last);

create trigger trg_conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Participants. Who is in a thread, plus their read marker (for unread
-- counts). Rows are written by the server functions, never the client.
-- ---------------------------------------------------------------------
create table conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  last_read_at    timestamptz,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index idx_participants_user on conversation_participants(user_id);

-- ---------------------------------------------------------------------
-- Messages.
-- ---------------------------------------------------------------------
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null check (length(trim(body)) > 0),
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at);

-- Keep the conversation's last_message_at fresh so inboxes sort correctly.
-- SECURITY DEFINER so it can update conversations regardless of the sender's
-- (row-limited) rights — this is system bookkeeping.
create or replace function bump_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update conversations
    set last_message_at = new.created_at, updated_at = now()
    where id = new.conversation_id;
  return null;
end; $$;

create trigger trg_bump_conversation
  after insert on messages
  for each row execute function bump_conversation_on_message();

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS. Policies + functions in 19_rls_messaging.sql.
-- ---------------------------------------------------------------------
alter table conversations             enable row level security;
alter table conversation_participants enable row level security;
alter table messages                  enable row level security;


-- #####################################################################
-- ###  19_rls_messaging.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 19_rls_messaging.sql
-- RLS + transitions for messaging. Run AFTER 18_messaging.sql.
--
-- Agreed rules:
--   * A conversation is readable only by its participants.
--   * EXCEPTION for support: an admin may see a support thread while it is
--     unclaimed (the shared queue) OR if it is claimed by them. Once another
--     admin claims it (assigned_admin_id set), it leaves everyone else's view.
--   * Sending a message requires being a participant. An admin therefore has
--     to CLAIM a support thread (which adds them as a participant) before they
--     can reply — that's what makes "first to pick it up owns it" real.
--   * Participants + conversations are created by server functions; the one
--     client write is sending a message (safe — no money).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers (SECURITY DEFINER -> no policy recursion)
-- ---------------------------------------------------------------------
create or replace function is_conversation_participant(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = cid and user_id = auth.uid()
  );
$$;

-- Can the current caller access this conversation at all? Participants always;
-- admins additionally for support threads that are unclaimed or theirs.
create or replace function can_access_conversation(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from conversations c
    where c.id = cid and (
      is_conversation_participant(cid)
      or (
        c.type = 'support'
        and is_admin(auth.uid())
        and (c.assigned_admin_id is null or c.assigned_admin_id = auth.uid())
      )
    )
  );
$$;

-- ---------------------------------------------------------------------
-- Conversations — read only. Creation is via the server functions below.
-- ---------------------------------------------------------------------
create policy "conversations: participants and support-queue admins read"
  on conversations for select using (can_access_conversation(id));

-- ---------------------------------------------------------------------
-- Participants — a member reads and updates only their own row (the read
-- marker). No client insert (server adds participants).
-- ---------------------------------------------------------------------
create policy "participants: read own"
  on conversation_participants for select using (user_id = auth.uid());

create policy "participants: update own read marker"
  on conversation_participants for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Messages
--   read   : anyone who can access the conversation.
--   insert : a participant, as themselves. (Admins must claim support first,
--            which makes them a participant.)
-- ---------------------------------------------------------------------
create policy "messages: readable with the conversation"
  on messages for select using (can_access_conversation(conversation_id));

create policy "messages: participant sends as self"
  on messages for insert with check (
    sender_id = auth.uid() and is_conversation_participant(conversation_id)
  );

-- ---------------------------------------------------------------------
-- Get-or-create the thread for a project. Called by the server; validates the
-- caller is a party and the project has an awarded provider (nobody to talk to
-- otherwise). Idempotent: returns the existing thread if there is one.
-- ---------------------------------------------------------------------
create or replace function open_project_conversation(p_project uuid, p_actor uuid)
returns conversations language plpgsql as $$
declare
  v_project projects;
  v_convo   conversations;
begin
  select * into v_project from projects where id = p_project;
  if not found then raise exception 'project % not found', p_project; end if;
  if v_project.awarded_provider_id is null then
    raise exception 'project % has no awarded provider to message', p_project;
  end if;
  if p_actor <> v_project.requester_id and p_actor <> v_project.awarded_provider_id then
    raise exception 'only the buyer or the awarded provider may open this thread';
  end if;

  select * into v_convo from conversations where project_id = p_project;
  if found then return v_convo; end if;

  insert into conversations (type, project_id, created_by, last_message_at)
    values ('project', p_project, p_actor, now())
    returning * into v_convo;

  insert into conversation_participants (conversation_id, user_id) values
    (v_convo.id, v_project.requester_id),
    (v_convo.id, v_project.awarded_provider_id);

  return v_convo;
end; $$;

-- ---------------------------------------------------------------------
-- Get-or-create a member's support thread. One open desk thread per member
-- keeps the inbox tidy; the bot/admin replies in the same thread.
-- ---------------------------------------------------------------------
create or replace function start_support_conversation(p_actor uuid)
returns conversations language plpgsql as $$
declare v_convo conversations;
begin
  select c.* into v_convo
    from conversations c
    join conversation_participants p on p.conversation_id = c.id
    where c.type = 'support' and p.user_id = p_actor
    limit 1;
  if found then return v_convo; end if;

  insert into conversations (type, created_by, last_message_at)
    values ('support', p_actor, now())
    returning * into v_convo;

  insert into conversation_participants (conversation_id, user_id)
    values (v_convo.id, p_actor);

  return v_convo;
end; $$;

-- ---------------------------------------------------------------------
-- Claim a support thread. Atomic: sets assigned_admin_id only if still
-- unclaimed, then joins the admin as a participant so they can reply. A second
-- admin trying to claim gets a clean error.
-- ---------------------------------------------------------------------
create or replace function claim_support_conversation(p_convo uuid, p_admin uuid)
returns conversations language plpgsql as $$
declare v_convo conversations;
begin
  update conversations
    set assigned_admin_id = p_admin
    where id = p_convo and type = 'support' and assigned_admin_id is null
    returning * into v_convo;
  if not found then
    raise exception 'support thread % is already claimed or not a support thread', p_convo;
  end if;

  insert into conversation_participants (conversation_id, user_id)
    values (p_convo, p_admin)
    on conflict do nothing;

  return v_convo;
end; $$;

revoke execute on function open_project_conversation(uuid, uuid) from public;
revoke execute on function start_support_conversation(uuid) from public;
revoke execute on function claim_support_conversation(uuid, uuid) from public;
grant execute on function open_project_conversation(uuid, uuid) to service_role;
grant execute on function start_support_conversation(uuid) to service_role;
grant execute on function claim_support_conversation(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- Grants.
-- ---------------------------------------------------------------------
grant select on conversations to authenticated;
grant select, update on conversation_participants to authenticated;
grant select, insert on messages to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: add messages to Supabase's realtime publication so the inbox
-- receives new rows live. RLS still filters the stream per subscriber.
-- Guarded so this file also runs on a plain Postgres (tests).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table messages;
  end if;
end $$;


-- #####################################################################
-- ###  20_master_role.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 20_master_role.sql
-- Introduces the MASTER role — the highest level, above admin. This file
-- only adds the role value and the helpers to recognise it; the full master
-- console (audit log, analytics, all-inboxes, admin creation) comes later.
--
-- For now the master's one active power is suspension reach: an admin may
-- suspend members, a master may also suspend admins (enforced in the server
-- routes, using is_master below).
--
-- NOTE on enum values: we never write the literal 'master'::user_role in any
-- function body here (we compare role::text = 'master' instead), so this file
-- is safe to run in a single transaction even though the value is brand new.
-- The master account itself is seeded separately (like the first admin) once
-- this has committed.
--
-- Run AFTER the identity layer (03 + 07).
-- =====================================================================

alter type user_role add value if not exists 'master';

-- Is this user the master? (text compare avoids needing the enum literal
-- committed before this function is created.)
create or replace function is_master(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role::text = 'master');
$$;

-- Admin OR master — "staff". Handy for read policies the master should also
-- pass. Existing admin-only policies are left untouched for now.
create or replace function is_staff(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role::text in ('admin', 'master'));
$$;

-- Masters get an MST id from their own sequence (like admins get ADM).
create sequence if not exists master_member_seq start 1;

-- Extend the member-ID trigger to know about master. Rewritten with ::text
-- role comparisons so the brand-new 'master' value doesn't need to be
-- committed before this function is created.
create or replace function assign_member_id()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prefix     text;
  v_role_token text;
  v_number     int;
begin
  if new.kyc_status = 'approved'
     and (old.kyc_status is distinct from 'approved')
     and new.member_id is null
  then
    if new.role::text = 'admin' then
      new.member_id := 'ADM' || lpad(nextval('admin_member_seq')::text, 5, '0');
    elsif new.role::text = 'master' then
      new.member_id := 'MST' || lpad(nextval('master_member_seq')::text, 5, '0');
    else
      if new.country_id is null then
        raise exception 'country_id is required to generate a member_id for role %', new.role;
      end if;
      v_role_token := case new.role::text
        when 'service_requester' then 'SR'
        when 'service_provider'  then 'SP'
      end;
      insert into member_id_counters (country_id, role, last_number)
        values (new.country_id, new.role, 1)
      on conflict (country_id, role)
        do update set last_number = member_id_counters.last_number + 1
      returning last_number into v_number;
      select member_prefix into v_prefix from countries where id = new.country_id;
      new.member_id := v_prefix || v_role_token || lpad(v_number::text, 5, '0');
    end if;
  end if;
  return new;
end; $$;


-- #####################################################################
-- ###  21_suspension.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 21_suspension.sql
-- Member (and admin) suspension. A suspended account:
--   * loses ALL write access — folded into is_approved(), so every existing
--     insert policy that already requires approval now also blocks the
--     suspended user. No new checks scattered around.
--   * becomes invisible to others — dropped from the public profile view, the
--     feed, and comment listings.
--   * still sees their OWN profile and content, plus a suspension notice with
--     the reason (the app reads is_suspended on their own row).
--
-- Suspension is NOT deletion — nothing is removed. Lifting it (unsuspend)
-- restores everything exactly as it was.
--
-- Suspension is written ONLY by the server (service_role): an admin may
-- suspend members; a master may also suspend admins. No client policy.
--
-- Run AFTER 20_master_role.sql (uses is_master) and the social layer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Suspension state on the profile.
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists is_suspended    boolean not null default false,
  add column if not exists suspended_reason text,
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_by     uuid references profiles(id);

-- ---------------------------------------------------------------------
-- Fold suspension into approval: a suspended account is treated as not
-- approved, so it can no longer post, comment, apply, order, or publish —
-- every write policy already gates on is_approved(). One change, total block.
-- ---------------------------------------------------------------------
create or replace function is_approved(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = uid and kyc_status = 'approved' and is_suspended = false
  );
$$;

-- Definer helper so visibility checks can read suspension without tripping
-- over the profiles table's own RLS.
create or replace function author_not_suspended(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from profiles where id = uid and is_suspended = true);
$$;

-- ---------------------------------------------------------------------
-- Profile visibility — the public window now also excludes suspended
-- accounts. (The owner still reads their own row via the base-table policy.)
-- ---------------------------------------------------------------------
create or replace view public_profiles as
  select id, member_id, full_name, role, profile_picture, country_id, created_at
  from profiles
  where kyc_status = 'approved' and is_suspended = false;

grant select on public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- Post visibility — the feed drops posts by suspended authors.
-- ---------------------------------------------------------------------
create or replace view feed_posts with (security_invoker = on) as
  select *
  from posts p
  where p.status = 'active' and author_not_suspended(p.author_id);

-- ---------------------------------------------------------------------
-- Comment soft-delete. Comments gain a status so a removal can be UNDONE
-- (previously removal was a hard delete). Combined with the suspension check,
-- a comment is publicly visible only if it's active AND its author isn't
-- suspended; the author and staff always see it.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'comment_status') then
    create type comment_status as enum ('active', 'removed');
  end if;
end $$;

alter table comments add column if not exists status comment_status not null default 'active';

drop policy if exists "comments: visible on visible posts" on comments;
create policy "comments: visible on visible posts"
  on comments for select using (
    (post_is_visible(post_id) and status = 'active' and author_not_suspended(author_id))
    or author_id = auth.uid()
    or is_admin(auth.uid())
    or is_master(auth.uid())
  );

-- The comment_count trigger still fires on hard rows; with soft-delete we keep
-- the denormalised count meaningful by decrementing when a comment is hidden
-- and incrementing when restored.
create or replace function bump_comment_count_on_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'removed' and old.status = 'active' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
  elsif new.status = 'active' and old.status = 'removed' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_comment_count_status on comments;
create trigger trg_comment_count_status
  after update of status on comments
  for each row execute function bump_comment_count_on_status();


-- #####################################################################
-- ###  22_create_master.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 22_create_master.sql
-- Seed the first MASTER account. Like the first admin, the master can't be
-- created inside the app (nothing above it exists yet), so it's seeded here.
-- After this, the master creates admins from the console.
--
-- ⚠ Same caveat as 13_create_admin.sql: this writes into auth.users, GoTrue's
--   private schema — supported alternative is Dashboard → Authentication →
--   Users → Add user (auto-confirm), then run PART 2 only.
--
-- Run AFTER 20_master_role.sql has COMMITTED (so 'master' exists as a role).
-- EDIT THE THREE VALUES, then run.
-- =====================================================================

do $$
declare
  v_email    text := 'master@zirclaire.com';   -- << change
  v_password text := 'ChangeThisNow!2026';     -- << change
  v_name     text := 'Zirclaire Master';       -- << change
  v_user_id  uuid;
begin
  if exists (select 1 from auth.users where email = lower(v_email)) then
    raise exception 'A user with email % already exists', v_email;
  end if;
  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    lower(v_email), crypt(v_password, gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name), false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  -- PART 2: the profile. Inserted pending, then approved so the member-ID
  -- trigger fires and issues MST00001.
  insert into profiles (id, role, full_name, email, kyc_status)
    values (v_user_id, 'master', v_name, lower(v_email), 'pending');
  update profiles set kyc_status = 'approved', kyc_reviewed_at = now() where id = v_user_id;

  raise notice 'Master created: % (id %)', v_email, v_user_id;
end $$;

select p.member_id, p.full_name, p.email, p.role
from profiles p where p.role::text = 'master' order by p.created_at;


-- #####################################################################
-- ###  23_audit.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 23_audit.sql
-- The audit log: an append-only record of every privileged (staff) action,
-- with who did it and when. This is the Master's oversight trail.
--
-- Written ONLY by the server (service_role) from inside each privileged route,
-- so it can't be forged or edited from the browser. Readable ONLY by the
-- master. Append-only — corrections are new entries, never edits.
--
-- Run AFTER 20_master_role.sql (uses is_master).
-- =====================================================================

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  actor_role  text,
  action      text not null,        -- machine key, e.g. 'kyc.approve'
  target_type text,                 -- 'profile' | 'project' | 'post' | ...
  target_id   text,
  summary     text,                 -- human-readable one-liner
  detail      jsonb,                -- optional extra context
  created_at  timestamptz not null default now()
);

create index idx_audit_created on audit_log(created_at desc);
create index idx_audit_actor   on audit_log(actor_id);
create index idx_audit_action  on audit_log(action);
create index idx_audit_target  on audit_log(target_type, target_id);

alter table audit_log enable row level security;

-- Only the master reads the trail. No client write policy — the server writes
-- via the service role, which bypasses RLS.
create policy "audit: master reads" on audit_log for select using (is_master(auth.uid()));

-- Append-only: block edits/deletes even for the service role.
create or replace function forbid_audit_mutation()
returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only; % is not permitted', tg_op; end; $$;

create trigger trg_audit_no_update before update on audit_log
  for each row execute function forbid_audit_mutation();
create trigger trg_audit_no_delete before delete on audit_log
  for each row execute function forbid_audit_mutation();

grant select on audit_log to authenticated;


-- #####################################################################
-- ###  24_master_reads.sql
-- #####################################################################

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


-- #####################################################################
-- ###  25_master_desk.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 25_master_desk.sql
-- Two things:
--  (1) Give the MASTER full read across projects and messaging (same gap we
--      fixed for profiles — master isn't literally 'admin', so the admin
--      read policies didn't include it). This makes the all-projects view and
--      inbox oversight actually populate for the master.
--  (2) The service-desk workflow: human ticket numbers, system (bot) messages,
--      and an auto-reply that greets the user and tells them an agent is coming.
--
-- Run AFTER 20 (is_master) and 18/19 (messaging).
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) Master read policies. Permissive policies combine with OR, so these
-- simply add master on top of the existing admin/party rules.
-- ---------------------------------------------------------------------
create policy "projects: master reads all"            on projects            for select using (is_master(auth.uid()));
create policy "applications: master reads all"         on applications         for select using (is_master(auth.uid()));
create policy "deliverables: master reads all"         on deliverables         for select using (is_master(auth.uid()));
create policy "reviews: master reads all"              on reviews              for select using (is_master(auth.uid()));
create policy "escrow_ledger: master reads all"        on escrow_ledger        for select using (is_master(auth.uid()));
create policy "project_attachments: master reads all"  on project_attachments  for select using (is_master(auth.uid()));
create policy "payments: master reads all"             on payments             for select using (is_master(auth.uid()));
create policy "conversations: master reads all"        on conversations        for select using (is_master(auth.uid()));
create policy "participants: master reads all"         on conversation_participants for select using (is_master(auth.uid()));
create policy "messages: master reads all"             on messages             for select using (is_master(auth.uid()));

-- ---------------------------------------------------------------------
-- (2a) System messages. The bot posts with no human sender, so sender_id
-- becomes nullable and a flag marks it as automated (rendered differently).
-- ---------------------------------------------------------------------
alter table messages add column if not exists is_system boolean not null default false;
alter table messages alter column sender_id drop not null;

-- ---------------------------------------------------------------------
-- (2b) Human ticket numbers for support threads.
-- ---------------------------------------------------------------------
create sequence if not exists support_ticket_seq start 1000;
alter table conversations add column if not exists ticket_number int;

-- Recreate start_support_conversation to stamp a ticket number on creation.
create or replace function start_support_conversation(p_actor uuid)
returns conversations language plpgsql as $$
declare v_convo conversations;
begin
  select c.* into v_convo
    from conversations c
    join conversation_participants p on p.conversation_id = c.id
    where c.type = 'support' and p.user_id = p_actor
    limit 1;
  if found then return v_convo; end if;

  insert into conversations (type, created_by, last_message_at, ticket_number)
    values ('support', p_actor, now(), nextval('support_ticket_seq'))
    returning * into v_convo;

  insert into conversation_participants (conversation_id, user_id)
    values (v_convo.id, p_actor);

  return v_convo;
end; $$;
revoke execute on function start_support_conversation(uuid) from public;
grant execute on function start_support_conversation(uuid) to service_role;

-- ---------------------------------------------------------------------
-- (2c) Auto-reply. On the ticket owner's messages only:
--   * their 1st message -> ask them to explain the problem,
--   * their 2nd message -> confirm the ticket and that an agent is coming.
-- System replies have sender_id NULL, so they never re-trigger this (the
-- guard requires the sender to be the ticket owner). Admin replies (sender is
-- not the owner) don't trigger it either.
-- ---------------------------------------------------------------------
create or replace function support_autoreply()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_conv conversations; v_user_msgs int;
begin
  select * into v_conv from conversations where id = new.conversation_id;
  if v_conv.type <> 'support' then return null; end if;
  if new.sender_id is null or new.sender_id <> v_conv.created_by then return null; end if;

  select count(*) into v_user_msgs
    from messages where conversation_id = new.conversation_id and sender_id = v_conv.created_by;

  if v_user_msgs = 1 then
    insert into messages (conversation_id, sender_id, body, is_system) values (
      new.conversation_id, null,
      'Please describe your issue in as much detail as possible.',
      true
    );
  elsif v_user_msgs = 2 then
    insert into messages (conversation_id, sender_id, body, is_system) values (
      new.conversation_id, null,
      'Logged as ticket #' || coalesce(v_conv.ticket_number::text, '—') || '. An agent will be with you shortly.',
      true
    );
  end if;
  return null;
end; $$;

drop trigger if exists trg_support_autoreply on messages;
create trigger trg_support_autoreply
  after insert on messages
  for each row execute function support_autoreply();


-- #####################################################################
-- ###  26_ticket_status.sql
-- #####################################################################

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


-- #####################################################################
-- ###  27_ai_support.sql
-- #####################################################################

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
 'The platform takes 20% of project and service work; the provider receives 80%. For royalty sales the platform takes 15% and the creator keeps 85%.'),
('funding', 'When does a provider get paid?',
 'After the requester marks the work finished and the admin clears the project, the provider is paid their 80% from escrow.'),
('services', 'What are services (MyService)?',
 'Providers offer fixed-price services with three pricing tiers. A buyer orders a tier; the order runs through the same escrow and delivery process as a project.'),
('royalties', 'What are royalties?',
 'Providers publish finished works — novels, research or journals. Buyers pay once and download the file. The platform takes 15% per sale.'),
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


-- #####################################################################
-- ###  28_ticket_lifecycle.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 28_ticket_lifecycle.sql
-- A member's support is a continuous chat, but each ticket is its own unit:
-- once a ticket is CLOSED, the member's next message starts a NEW ticket with
-- a new number, rather than reopening the old one.
--
-- This changes start_support_conversation so it only resumes the member's
-- latest support ticket while it is still OPEN; otherwise it opens a fresh
-- ticket. (Admins still see each ticket as a separate conversation.)
--
-- Run AFTER 26 (ticket status) — needs closed_at + ticket_number.
-- =====================================================================

create or replace function start_support_conversation(p_actor uuid)
returns conversations language plpgsql as $$
declare v_convo conversations;
begin
  -- The member's most recent support ticket.
  select c.* into v_convo
    from conversations c
    where c.type = 'support' and c.created_by = p_actor
    order by c.created_at desc
    limit 1;

  -- Resume it only if it's still open; a closed ticket is done.
  if found and v_convo.closed_at is null then
    return v_convo;
  end if;

  -- Otherwise open a fresh ticket.
  insert into conversations (type, created_by, last_message_at, ticket_number)
    values ('support', p_actor, now(), nextval('support_ticket_seq'))
    returning * into v_convo;

  insert into conversation_participants (conversation_id, user_id)
    values (v_convo.id, p_actor);

  return v_convo;
end; $$;

revoke execute on function start_support_conversation(uuid) from public;
grant execute on function start_support_conversation(uuid) to service_role;


-- #####################################################################
-- ###  29_ticket_autoclose.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 29_ticket_autoclose.sql
-- Auto-close support tickets that have gone quiet for 24 hours, and post the
-- same closure notice a manual close does. Runs on a schedule (pg_cron).
--
-- Setup: enable pg_cron once (Supabase → Database → Extensions → pg_cron).
-- If it isn't enabled, the function is still created — you can call it manually
-- or trigger it from any external scheduler; only the cron.schedule below is
-- skipped.
--
-- Run AFTER 26/28 (tickets + lifecycle).
-- =====================================================================

create or replace function autoclose_stale_tickets()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with stale as (
    update conversations
      set closed_at = now()
      where type = 'support'
        and closed_at is null
        and coalesce(last_message_at, created_at) < now() - interval '24 hours'
      returning id, ticket_number
  )
  insert into messages (conversation_id, sender_id, is_system, body)
    select id, null, true,
           'Ticket #' || coalesce(ticket_number::text, '—') ||
           ' was closed automatically after 24 hours with no activity. Send a new message any time and we''ll open a new ticket.'
    from stale;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- Schedule hourly if pg_cron is available (24h idle only needs hourly checks).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    -- Replace any existing job of this name, then (re)create it.
    perform cron.unschedule('zc-autoclose-tickets')
      where exists (select 1 from cron.job where jobname = 'zc-autoclose-tickets');
    perform cron.schedule('zc-autoclose-tickets', '0 * * * *', 'select autoclose_stale_tickets();');
  end if;
end $$;


-- #####################################################################
-- ###  30_ai_moderation.sql
-- #####################################################################

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


-- #####################################################################
-- ###  31_unique_email.sql
-- #####################################################################

-- =====================================================================
-- Zirclaire — 31_unique_email.sql
-- Enforce one profile per email address at the database level (case-insensitive)
-- so two accounts can never share an address, regardless of the app path.
--
-- If this errors on creation, an existing duplicate email must be resolved
-- first: select lower(email), count(*) from profiles group by 1 having count(*) > 1;
-- =====================================================================

create unique index if not exists profiles_email_lower_unique on profiles (lower(email));

