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
