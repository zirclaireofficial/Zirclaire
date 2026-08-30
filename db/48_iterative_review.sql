-- =====================================================================
-- Zirclaire — 48_iterative_review.sql
-- Make delivery iterative instead of a one-shot "submit = complete/dispute":
--   * A provider submits a version (submitted_work). The chat stays open.
--   * The requester can Request changes (unlimited rounds now) OR Accept.
--   * Accept + clear = finished -> closed + payout (the deliberate confirm).
--   * A dispute stays a separate, explicit action.
-- Also anchors each submission in time (submitted_work_at) so a silent
-- requester can be auto-accepted after a grace period (handled in the sweep).
--
-- Changes vs before:
--   - request_revision: DROP the single-revision cap (§8.1) -> unlimited redos,
--     and allow it straight from submitted_work (no separate "open review").
--   - accept_work: allow from submitted_work as well as in_review.
--   - submit_deliverable: stamp submitted_work_at, reset the reminder.
-- Run AFTER 40_currency_myr_rename.sql (latest money-fn definitions).
-- =====================================================================

alter table projects add column if not exists submitted_work_at timestamptz;
alter table projects add column if not exists review_reminded_at timestamptz;

-- in_progress|revision_requested -> submitted_work (+ versioned deliverable),
-- now stamping when the submission landed and clearing any prior reminder.
create or replace function submit_deliverable(
  p_project uuid, p_provider uuid, p_media_url text, p_media_type text, p_note text)
returns projects language plpgsql as $$
declare r projects; v_version int;
begin
  update projects
    set status = 'submitted_work', submitted_work_at = now(), review_reminded_at = null
    where id = p_project and status in ('in_progress', 'revision_requested')
      and awarded_provider_id = p_provider
    returning * into r;
  if not found then raise exception 'project % not in a workable state for this provider', p_project; end if;

  select coalesce(max(version), 0) + 1 into v_version from deliverables where project_id = p_project;
  insert into deliverables(project_id, provider_id, version, media_url, media_type, note)
    values (p_project, p_provider, v_version, p_media_url, p_media_type, p_note);
  return r;
end; $$;

-- submitted_work|in_review -> revision_requested (+ review row). UNLIMITED: the
-- old single-revision guard is intentionally gone so small changes can loop.
create or replace function request_revision(p_project uuid, p_reviewer uuid, p_reason text)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects
    set status = 'revision_requested', submitted_work_at = null, review_reminded_at = null
    where id = p_project and status in ('submitted_work', 'in_review')
    returning * into r;
  if not found then raise exception 'project % is not awaiting review', p_project; end if;
  insert into reviews(project_id, reviewer_id, decision, reason)
    values (p_project, p_reviewer, 'revision_requested', p_reason);
  return r;
end; $$;

-- submitted_work|in_review -> finished (+ 'accepted' review). The requester's
-- deliberate confirmation; clear_project then closes it and creates the payout.
create or replace function accept_work(p_project uuid, p_reviewer uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects set status = 'finished', finished_at = now()
    where id = p_project and status in ('submitted_work', 'in_review')
    returning * into r;
  if not found then raise exception 'project % is not awaiting review', p_project; end if;
  insert into reviews(project_id, reviewer_id, decision)
    values (p_project, p_reviewer, 'accepted');
  return r;
end; $$;
