-- =====================================================================
-- Zirclaire — 35_cancellation_dispute.sql
-- Service-Requester project cancellation with provider consent + a two-tier
-- Platform arbitration (admin, then master on appeal). Terms §10 + §14.
--
-- Lifecycle (status column):
--   pending_provider  SR asked to cancel; provider must accept or reject
--   in_arbitration    provider rejected; an admin is judging (>50% ? deny)
--   awaiting_appeal   admin has ruled; 48h window for EITHER party to appeal
--   appealed          a party appealed; master is deciding (final)
--   approved          FINAL — cancellation granted, 95% refunded / 5% fee
--   denied            FINAL — project continues to completion
--
-- MONEY SAFETY: a refund only runs when a decision is FINAL. Provider-accept
-- is mutual => refund now. An admin ruling is provisional (appealable), so its
-- refund is executed by the nightly finalizer once the 48h window passes, or
-- immediately if master decides. cancel_project() does the 95/5 split (mig 34).
--
-- Run AFTER 34_rules_enforcement.sql.
-- =====================================================================

create type cancellation_status as enum (
  'pending_provider', 'in_arbitration', 'awaiting_appeal', 'appealed', 'approved', 'denied'
);

create table cancellation_requests (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  requested_by uuid not null references profiles(id),   -- the SR
  provider_id  uuid references profiles(id),            -- awarded provider (snapshot)
  reason       text not null,
  status       cancellation_status not null default 'pending_provider',

  provider_response     text check (provider_response in ('accepted','rejected')),
  provider_responded_at timestamptz,

  admin_id        uuid references profiles(id),
  admin_decision  text check (admin_decision in ('approved','denied')),
  admin_reason    text,
  admin_decided_at timestamptz,

  appealed_by  uuid references profiles(id),
  appeal_reason text,
  appealed_at  timestamptz,

  master_id       uuid references profiles(id),
  master_decision text check (master_decision in ('approved','denied')),
  master_reason   text,
  master_decided_at timestamptz,

  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- At most one OPEN request per project.
create unique index uq_cancel_open_per_project on cancellation_requests(project_id)
  where status in ('pending_provider','in_arbitration','awaiting_appeal','appealed');
create index idx_cancel_project on cancellation_requests(project_id);
create index idx_cancel_status  on cancellation_requests(status);

create trigger trg_cancel_updated_at before update on cancellation_requests
  for each row execute function set_updated_at();

-- Private dispute channels. `party` = whose channel (requester or provider);
-- `sender_side` = platform vs user. Users only ever see 'Zirclaire Review Team'
-- for platform messages — the actual admin/master id is stored for audit only.
create table dispute_messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references cancellation_requests(id) on delete cascade,
  party       text not null check (party in ('requester','provider')),
  sender_side text not null check (sender_side in ('platform','user')),
  sender_id   uuid references profiles(id),
  body        text not null,
  created_at  timestamptz not null default now()
);
create index idx_dispute_msg_request on dispute_messages(request_id);

alter table cancellation_requests enable row level security;
alter table dispute_messages      enable row level security;

-- Reads: the two parties + any staff. Writes are server-only (service role
-- bypasses RLS), so there are deliberately no insert/update/delete policies.
create policy cancel_read_own on cancellation_requests for select
  using (requested_by = auth.uid() or provider_id = auth.uid() or is_staff(auth.uid()));

create policy dispute_read_party on dispute_messages for select
  using (
    is_staff(auth.uid())
    or exists (
      select 1 from cancellation_requests r
      where r.id = request_id
        and ((party = 'requester' and r.requested_by = auth.uid())
          or (party = 'provider'  and r.provider_id  = auth.uid()))
    )
  );

alter publication supabase_realtime add table dispute_messages;


-- ---------------------------------------------------------------------
-- Freeze the money-out gate while a cancellation is open: a project with an
-- open request cannot be cleared/paid out until it resolves (§14.3).
-- Re-emits clear_project (mig 10) with the extra guard.
-- ---------------------------------------------------------------------
create or replace function clear_project(p_project uuid, p_actor uuid)
returns projects language plpgsql as $$
declare r projects; v_amount numeric;
begin
  if exists (select 1 from cancellation_requests c where c.project_id = p_project
      and c.status in ('pending_provider','in_arbitration','awaiting_appeal','appealed')) then
    raise exception 'project % has an open cancellation request; resolve it first', p_project;
  end if;

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


-- ---------------------------------------------------------------------
-- Open a cancellation request (provider path). Eligibility per §10.2/§10.3:
-- must be an active project with an awarded provider, and NOT within 48h of
-- the deadline. Projects with no provider yet are cancelled directly by the
-- server route (no arbitration needed) and never reach this function.
-- ---------------------------------------------------------------------
create or replace function create_cancellation_request(p_project uuid, p_actor uuid, p_reason text)
returns cancellation_requests language plpgsql as $$
declare pr projects; cr cancellation_requests;
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'a cancellation reason is required';
  end if;
  select * into pr from projects where id = p_project for update;
  if not found then raise exception 'project % not found', p_project; end if;
  if pr.status not in ('awarded','in_progress','submitted_work','in_review','revision_requested') then
    raise exception 'project % cannot be cancelled from % state', p_project, pr.status;
  end if;
  if pr.awarded_provider_id is null then
    raise exception 'project % has no awarded provider; cancel directly', p_project;
  end if;
  if pr.deadline_at is not null and now() >= pr.deadline_at - interval '48 hours' then
    raise exception 'cancellation is not allowed within 48 hours of the deadline'
      using errcode = 'check_violation';
  end if;

  insert into cancellation_requests(project_id, requested_by, provider_id, reason)
    values (p_project, p_actor, pr.awarded_provider_id, p_reason)
    returning * into cr;
  return cr;
end; $$;


-- Provider accepts (mutual => refund now) or rejects (=> arbitration).
create or replace function provider_respond_cancellation(p_request uuid, p_provider uuid, p_accept boolean)
returns cancellation_requests language plpgsql as $$
declare cr cancellation_requests;
begin
  select * into cr from cancellation_requests where id = p_request for update;
  if not found then raise exception 'request % not found', p_request; end if;
  if cr.status <> 'pending_provider' then raise exception 'request % is not awaiting the provider', p_request; end if;
  if cr.provider_id <> p_provider then raise exception 'not the awarded provider for this request'; end if;

  if p_accept then
    perform cancel_project(cr.project_id, 'Cancellation agreed by provider: ' || cr.reason, p_provider, 500);
    update cancellation_requests
      set status='approved', provider_response='accepted', provider_responded_at=now(), resolved_at=now()
      where id = p_request returning * into cr;
  else
    update cancellation_requests
      set status='in_arbitration', provider_response='rejected', provider_responded_at=now()
      where id = p_request returning * into cr;
  end if;
  return cr;
end; $$;


-- Admin rules (>50%? deny). Provisional: opens the 48h appeal window; NO refund
-- yet even if approved — the nightly finalizer or a master appeal executes it.
create or replace function admin_decide_cancellation(p_request uuid, p_admin uuid, p_decision text, p_reason text)
returns cancellation_requests language plpgsql as $$
declare cr cancellation_requests;
begin
  if p_decision not in ('approved','denied') then raise exception 'decision must be approved or denied'; end if;
  select * into cr from cancellation_requests where id = p_request for update;
  if not found then raise exception 'request % not found', p_request; end if;
  if cr.status <> 'in_arbitration' then raise exception 'request % is not in arbitration', p_request; end if;

  update cancellation_requests
    set status='awaiting_appeal', admin_id=p_admin, admin_decision=p_decision,
        admin_reason=p_reason, admin_decided_at=now()
    where id = p_request returning * into cr;
  return cr;
end; $$;


-- Either party appeals within the window => master decides.
create or replace function appeal_cancellation(p_request uuid, p_actor uuid, p_reason text)
returns cancellation_requests language plpgsql as $$
declare cr cancellation_requests;
begin
  select * into cr from cancellation_requests where id = p_request for update;
  if not found then raise exception 'request % not found', p_request; end if;
  if cr.status <> 'awaiting_appeal' then raise exception 'request % is not open for appeal', p_request; end if;
  if p_actor <> cr.requested_by and p_actor <> cr.provider_id then
    raise exception 'only a party to the project may appeal';
  end if;
  update cancellation_requests
    set status='appealed', appealed_by=p_actor, appeal_reason=p_reason, appealed_at=now()
    where id = p_request returning * into cr;
  return cr;
end; $$;


-- Master decides (final). Executes the refund immediately if approved.
create or replace function master_decide_cancellation(p_request uuid, p_master uuid, p_decision text, p_reason text)
returns cancellation_requests language plpgsql as $$
declare cr cancellation_requests;
begin
  if p_decision not in ('approved','denied') then raise exception 'decision must be approved or denied'; end if;
  select * into cr from cancellation_requests where id = p_request for update;
  if not found then raise exception 'request % not found', p_request; end if;
  if cr.status <> 'appealed' then raise exception 'request % is not under appeal', p_request; end if;

  if p_decision = 'approved' then
    perform cancel_project(cr.project_id, 'Cancellation approved on appeal: ' || cr.reason, p_master, 500);
  end if;
  update cancellation_requests
    set status=p_decision::cancellation_status, master_id=p_master, master_decision=p_decision,
        master_reason=p_reason, master_decided_at=now(), resolved_at=now()
    where id = p_request returning * into cr;
  return cr;
end; $$;


-- Nightly finalizer: awaiting_appeal requests whose 48h window has elapsed with
-- no appeal become FINAL per the admin's decision (refund runs here if approved).
-- Returns the ids it resolved, so the caller can notify exactly those parties.
create or replace function finalize_matured_cancellations(p_hours int default 48)
returns setof uuid language plpgsql as $$
declare cr cancellation_requests;
begin
  for cr in
    select * from cancellation_requests
    where status='awaiting_appeal' and admin_decided_at < now() - make_interval(hours => p_hours)
    for update
  loop
    if cr.admin_decision = 'approved' then
      perform cancel_project(cr.project_id, 'Cancellation approved (no appeal): ' || cr.reason, cr.admin_id, 500);
    end if;
    update cancellation_requests
      set status = cr.admin_decision::cancellation_status, resolved_at = now()
      where id = cr.id;
    return next cr.id;
  end loop;
end; $$;


-- Server-only.
revoke execute on function create_cancellation_request(uuid,uuid,text)          from public;
revoke execute on function provider_respond_cancellation(uuid,uuid,boolean)     from public;
revoke execute on function admin_decide_cancellation(uuid,uuid,text,text)       from public;
revoke execute on function appeal_cancellation(uuid,uuid,text)                  from public;
revoke execute on function master_decide_cancellation(uuid,uuid,text,text)      from public;
revoke execute on function finalize_matured_cancellations(int)                  from public;
grant  execute on function create_cancellation_request(uuid,uuid,text)          to service_role;
grant  execute on function provider_respond_cancellation(uuid,uuid,boolean)     to service_role;
grant  execute on function admin_decide_cancellation(uuid,uuid,text,text)       to service_role;
grant  execute on function appeal_cancellation(uuid,uuid,text)                  to service_role;
grant  execute on function master_decide_cancellation(uuid,uuid,text,text)      to service_role;
grant  execute on function finalize_matured_cancellations(int)                  to service_role;
