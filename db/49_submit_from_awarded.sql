-- =====================================================================
-- Zirclaire — 49_submit_from_awarded.sql
-- Drop the separate "Start work" step: a provider can submit a deliverable
-- straight from 'awarded' (no 'in_progress' hop needed). submit_deliverable now
-- also accepts 'awarded', and stamps started_at on the first submission.
-- Run AFTER 48_iterative_review.sql.
-- =====================================================================

create or replace function submit_deliverable(
  p_project uuid, p_provider uuid, p_media_url text, p_media_type text, p_note text)
returns projects language plpgsql as $$
declare r projects; v_version int;
begin
  update projects
    set status = 'submitted_work',
        started_at = coalesce(started_at, now()),
        submitted_work_at = now(),
        review_reminded_at = null
    where id = p_project and status in ('awarded', 'in_progress', 'revision_requested')
      and awarded_provider_id = p_provider
    returning * into r;
  if not found then raise exception 'project % not in a workable state for this provider', p_project; end if;

  select coalesce(max(version), 0) + 1 into v_version from deliverables where project_id = p_project;
  insert into deliverables(project_id, provider_id, version, media_url, media_type, note)
    values (p_project, p_provider, v_version, p_media_url, p_media_type, p_note);
  return r;
end; $$;
