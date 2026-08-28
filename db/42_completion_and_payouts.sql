-- =====================================================================
-- Zirclaire — 42_completion_and_payouts.sql
-- Interim completion flow (admin out of all money decisions):
--   * Provider "marks complete" (completion_marked_at) after delivering.
--   * Requester has 48h to confirm early or PROTEST.
--   * No protest in 48h -> auto-complete (nightly). Protest -> arbitration,
--     reusing cancellation_requests with kind='protest'.
--   * complete_project closes the project, writes the 20/80 ledger AND creates
--     the (manual) payout row — so master sees it regardless of who completed.
-- Payouts are done manually with a mandatory proof of payment:
--   * project 80% -> MASTER (payouts.proof_url)
--   * royalty 15% -> ADMIN  (new royalty_payouts table)
-- Run AFTER 41_toyyibpay.sql.
-- =====================================================================

-- ---- schema additions ----------------------------------------------
alter table projects add column if not exists completion_marked_at timestamptz;

alter table cancellation_requests
  add column if not exists kind text not null default 'cancellation';
-- (kind in 'cancellation' | 'protest'; default keeps existing rows valid)

alter table payouts add column if not exists proof_url         text;
alter table payouts add column if not exists proof_uploaded_at timestamptz;

-- Royalty owner payouts (15%), one per sale, paid manually by an admin.
create table if not exists royalty_payouts (
  id                uuid primary key default gen_random_uuid(),
  purchase_id       uuid not null unique references royalty_purchases(id) on delete cascade,
  owner_id          uuid not null references profiles(id) on delete restrict,
  amount_myr        numeric(12,2) not null check (amount_myr > 0),
  status            text not null default 'pending' check (status in ('pending','paid')),
  proof_url         text,
  proof_uploaded_at timestamptz,
  manual_reference  text,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists idx_royalty_payouts_status on royalty_payouts(status);
alter table royalty_payouts enable row level security;
-- staff read all; the owner can see their own. Writes are server-only.
drop policy if exists "royalty_payouts: staff read"      on royalty_payouts;
drop policy if exists "royalty_payouts: owner reads own"  on royalty_payouts;
create policy "royalty_payouts: staff read"     on royalty_payouts for select using (is_staff(auth.uid()));
create policy "royalty_payouts: owner reads own" on royalty_payouts for select using (owner_id = auth.uid());


-- ---- complete a project: close + 20/80 ledger + create the payout row ----
-- Callable by the server route (SR confirm), the nightly sweep, and the
-- protest-denied path. Blocked while a dispute is open. Idempotent via the
-- unique(project_id) on payouts.
create or replace function complete_project(p_project uuid, p_actor uuid)
returns projects language plpgsql as $$
declare r projects; v_amount numeric; v_prov profiles;
begin
  if exists (select 1 from cancellation_requests c where c.project_id = p_project
      and c.status in ('pending_provider','in_arbitration','awaiting_appeal','appealed')) then
    raise exception 'project % has an open dispute; resolve it first', p_project;
  end if;
  select * into r from projects where id = p_project for update;
  if not found then raise exception 'project % not found', p_project; end if;
  if r.status <> 'submitted_work' then
    raise exception 'project % is not awaiting completion (%).', p_project, r.status;
  end if;

  v_amount := coalesce(r.funded_amount_myr, 0);
  update projects set status='closed', finished_at=now(), closed_at=now()
    where id = p_project returning * into r;

  insert into escrow_ledger(project_id, entry_type, amount_myr, created_by) values
    (p_project, 'commission', -round(v_amount * 0.20, 2), p_actor),
    (p_project, 'payout',     -round(v_amount * 0.80, 2), p_actor);

  -- The manual payout to the provider (80%), snapshotting their payout account.
  if r.awarded_provider_id is not null and v_amount > 0 then
    select * into v_prov from profiles where id = r.awarded_provider_id;
    insert into payouts(project_id, provider_id, amount_myr, payout_method, account_number, account_holder, status, release_at)
      values (p_project, r.awarded_provider_id, round(v_amount * 0.80, 2),
              v_prov.payout_provider::text, v_prov.payout_account, v_prov.full_name, 'pending', now())
      on conflict (project_id) do nothing;
  end if;
  return r;
end; $$;
revoke execute on function complete_project(uuid, uuid) from public;
grant  execute on function complete_project(uuid, uuid) to service_role;


-- ---- a protest: a cancellation_request of kind='protest', straight to arbitration ----
create or replace function create_protest(p_project uuid, p_actor uuid, p_reason text)
returns cancellation_requests language plpgsql as $$
declare pr projects; cr cancellation_requests;
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then raise exception 'a reason is required'; end if;
  select * into pr from projects where id = p_project for update;
  if not found then raise exception 'project % not found', p_project; end if;
  if pr.requester_id <> p_actor then raise exception 'only the requester may protest'; end if;
  if pr.status <> 'submitted_work' or pr.completion_marked_at is null then
    raise exception 'project % is not awaiting completion confirmation', p_project;
  end if;
  insert into cancellation_requests(project_id, requested_by, provider_id, reason, kind, status)
    values (p_project, p_actor, pr.awarded_provider_id, p_reason, 'protest', 'in_arbitration')
    returning * into cr;
  return cr;
end; $$;
revoke execute on function create_protest(uuid, uuid, text) from public;
grant  execute on function create_protest(uuid, uuid, text) to service_role;


-- ---- resolution now handles kind='protest' -------------------------
-- Outcome table (final):
--   approved (SR wins)              -> cancel_project (refund the requester)
--   denied  + kind='cancellation'   -> nothing (project continues)
--   denied  + kind='protest'        -> complete_project (provider gets paid)

create or replace function master_decide_cancellation(p_request uuid, p_master uuid, p_decision text, p_reason text)
returns cancellation_requests language plpgsql as $$
declare cr cancellation_requests;
begin
  if p_decision not in ('approved','denied') then raise exception 'decision must be approved or denied'; end if;
  select * into cr from cancellation_requests where id = p_request for update;
  if not found then raise exception 'request % not found', p_request; end if;
  if cr.status <> 'appealed' then raise exception 'request % is not under appeal', p_request; end if;

  -- Resolve the request FIRST so the project no longer has an "open dispute",
  -- then run the money action (complete_project's guard would otherwise block).
  update cancellation_requests
    set status=p_decision::cancellation_status, master_id=p_master, master_decision=p_decision,
        master_reason=p_reason, master_decided_at=now(), resolved_at=now()
    where id = p_request returning * into cr;
  if p_decision = 'approved' then
    perform cancel_project(cr.project_id, 'Approved on appeal: ' || cr.reason, p_master, 500);
  elsif p_decision = 'denied' and cr.kind = 'protest' then
    perform complete_project(cr.project_id, p_master);
  end if;
  return cr;
end; $$;

create or replace function finalize_matured_cancellations(p_hours int default 48)
returns setof uuid language plpgsql as $$
declare cr cancellation_requests;
begin
  for cr in
    select * from cancellation_requests
    where status='awaiting_appeal' and admin_decided_at < now() - make_interval(hours => p_hours)
    for update
  loop
    -- Resolve first (clears the "open dispute" guard), then run the money action.
    update cancellation_requests
      set status = cr.admin_decision::cancellation_status, resolved_at = now()
      where id = cr.id;
    if cr.admin_decision = 'approved' then
      perform cancel_project(cr.project_id, 'Approved (no appeal): ' || cr.reason, cr.admin_id, 500);
    elsif cr.admin_decision = 'denied' and cr.kind = 'protest' then
      perform complete_project(cr.project_id, cr.admin_id);
    end if;
    return next cr.id;
  end loop;
end; $$;
