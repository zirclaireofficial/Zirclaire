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
