-- =====================================================================
-- Zirclaire — 34_rules_enforcement.sql
-- Enforces four Terms-of-Service rules that the state machine did not yet
-- guarantee. Idempotent (create or replace / add column if not exists).
-- Run AFTER 33_notifications_and_approval.sql.
--
--   §4    Max 3 active projects per provider   -> award_applicant guard
--   §8.1  One revision per project              -> request_revision guard
--   §10.4 / §11.3  Cancellation keeps 5% fee,
--         refunds 95%                           -> cancel_project(+ p_fee_bps)
--   §11   Unclosed-project auto-expiry          -> expire_no_submission + col
-- =====================================================================


-- ---------------------------------------------------------------------
-- §4 — Maximum 3 active projects per Service Provider.
-- "Active" = accepted and not yet completed/cancelled/closed, i.e. any of
-- awarded / in_progress / submitted_work / in_review / revision_requested /
-- finished. The count is taken INSIDE the same transaction that awards, so
-- two concurrent awards can never both slip a provider to a 4th project.
-- ---------------------------------------------------------------------
create or replace function award_applicant(p_project uuid, p_application uuid)
returns projects language plpgsql as $$
declare r projects; v_provider uuid; v_active int;
begin
  select provider_id into v_provider from applications
    where id = p_application and project_id = p_project;
  if v_provider is null then raise exception 'application % not found on project %', p_application, p_project; end if;

  -- Rule §4: block a 4th concurrent active project for this provider.
  select count(*) into v_active from projects
    where awarded_provider_id = v_provider
      and status in ('awarded','in_progress','submitted_work','in_review','revision_requested','finished');
  if v_active >= 3 then
    raise exception 'provider % already has % active projects (max 3)', v_provider, v_active
      using errcode = 'check_violation';
  end if;

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


-- ---------------------------------------------------------------------
-- §8.1 — A Service Requester is entitled to ONE revision per project.
-- We already log every revision as a review row (decision =
-- 'revision_requested'); block a second one. A further change would need a
-- new mutually-agreed project (§8.3), which is out of this automatic path.
-- ---------------------------------------------------------------------
create or replace function request_revision(p_project uuid, p_reviewer uuid, p_reason text)
returns projects language plpgsql as $$
declare r projects; v_used int;
begin
  select count(*) into v_used from reviews
    where project_id = p_project and decision = 'revision_requested';
  if v_used >= 1 then
    raise exception 'project % has already used its single permitted revision', p_project
      using errcode = 'check_violation';
  end if;

  update projects set status = 'revision_requested'
    where id = p_project and status = 'in_review'
    returning * into r;
  if not found then raise exception 'project % is not in in_review state', p_project; end if;
  insert into reviews(project_id, reviewer_id, decision, reason)
    values (p_project, p_reviewer, 'revision_requested', p_reason);
  return r;
end; $$;


-- ---------------------------------------------------------------------
-- §10.4 / §11.3 — Approved cancellation keeps a 5% administrative fee and
-- refunds 95%. p_fee_bps is the fee in basis points (500 = 5%, the default).
-- Pass 0 for a full refund (e.g. provider-failure cases under §13.2).
-- The 5% is recorded as a 'commission' entry (platform income) tagged in
-- `note`, so the ledger still nets to zero and reporting can tell it apart
-- from the 20% service fee.
--
-- Signature changes (adds p_fee_bps), so the old 3-arg function is dropped
-- first; a 3-arg call now resolves to this 4-arg version via the default.
-- ---------------------------------------------------------------------
drop function if exists cancel_project(uuid, text, uuid);

create or replace function cancel_project(
  p_project uuid, p_reason text, p_actor uuid, p_fee_bps int default 500)
returns projects language plpgsql as $$
declare r projects; v_balance numeric; v_fee numeric; v_refund numeric;
begin
  select * into r from projects where id = p_project for update;
  if not found then raise exception 'project % not found', p_project; end if;
  if r.status not in ('submitted','approved','funded','live','awarded','in_progress','revision_requested','submitted_work','in_review') then
    raise exception 'project % cannot be cancelled from % state', p_project, r.status;
  end if;

  v_balance := coalesce((select sum(amount_usd) from escrow_ledger where project_id = p_project), 0);
  if v_balance > 0 then
    v_fee    := round(v_balance * p_fee_bps / 10000.0, 2);
    v_refund := v_balance - v_fee;                 -- exact; no rounding drift
    if v_refund > 0 then
      insert into escrow_ledger(project_id, entry_type, amount_usd, created_by, note)
        values (p_project, 'refund', -v_refund, p_actor, 'Cancellation refund');
    end if;
    if v_fee > 0 then
      insert into escrow_ledger(project_id, entry_type, amount_usd, created_by, note)
        values (p_project, 'commission', -v_fee, p_actor, 'Cancellation admin fee (5%)');
    end if;
  end if;

  update projects set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
    where id = p_project returning * into r;
  return r;
end; $$;

revoke execute on function cancel_project(uuid, text, uuid, int) from public;
grant  execute on function cancel_project(uuid, text, uuid, int) to service_role;


-- ---------------------------------------------------------------------
-- §11 — Unclosed Project handling.
-- A marker so the nightly sweep only notifies admins ONCE about a
-- past-deadline project that still needs a human decision.
-- ---------------------------------------------------------------------
alter table projects add column if not exists expiry_flagged_at timestamptz;

-- §11.3 — Provider submitted nothing before the deadline: the project has
-- failed. Refund 95% to the SR, keep the 5% admin fee, close it. Atomic and
-- self-guarding: it only fires for a past-deadline project with an awarded
-- provider and NO deliverable, so a re-run or a late submission can't double
-- refund. Everything else (work already submitted, or no provider ever
-- awarded) is left for a human — see the sweep in server/utils/expiry.ts.
create or replace function expire_no_submission(p_project uuid, p_actor uuid)
returns projects language plpgsql as $$
declare r projects; v_balance numeric; v_fee numeric; v_refund numeric;
begin
  select * into r from projects where id = p_project for update;
  if not found then raise exception 'project % not found', p_project; end if;
  if r.status not in ('awarded','in_progress') then
    raise exception 'project % not in an auto-expirable state (%)', p_project, r.status;
  end if;
  if r.deadline_at is null or r.deadline_at > now() then
    raise exception 'project % has not passed its deadline', p_project;
  end if;
  if exists (select 1 from deliverables where project_id = p_project) then
    raise exception 'project % has a submitted deliverable; needs review, not auto-expiry', p_project;
  end if;

  v_balance := coalesce((select sum(amount_usd) from escrow_ledger where project_id = p_project), 0);
  if v_balance > 0 then
    v_fee    := round(v_balance * 0.05, 2);
    v_refund := v_balance - v_fee;
    if v_refund > 0 then
      insert into escrow_ledger(project_id, entry_type, amount_usd, created_by, note)
        values (p_project, 'refund', -v_refund, p_actor, 'Auto-expiry refund (no submission)');
    end if;
    if v_fee > 0 then
      insert into escrow_ledger(project_id, entry_type, amount_usd, created_by, note)
        values (p_project, 'commission', -v_fee, p_actor, 'Auto-expiry admin fee (5%)');
    end if;
  end if;

  update projects
    set status = 'cancelled', cancelled_at = now(),
        cancel_reason = 'Auto-expired: deadline passed with no submission (95% refunded)'
    where id = p_project returning * into r;
  return r;
end; $$;

revoke execute on function expire_no_submission(uuid, uuid) from public;
grant  execute on function expire_no_submission(uuid, uuid) to service_role;
