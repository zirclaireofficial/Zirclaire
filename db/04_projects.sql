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
  budget_usd             numeric(12,2) not null check (budget_usd >= 100 and budget_usd <= 4000),
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
