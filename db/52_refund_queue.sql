-- =====================================================================
-- Zirclaire — 52_refund_queue.sql
-- Refunds are real money the Master must send back to the requester (95% on a
-- cancellation / auto-expiry). Until now that was only an escrow-ledger entry;
-- nobody was tasked to actually pay it. This adds a manual REFUND queue that
-- mirrors the payout queue: every refund creates a 'pending' row the Master
-- pays by hand, uploads proof, and marks paid.
-- Run AFTER 40_currency_myr_rename.sql.
-- =====================================================================

create table if not exists refunds (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null unique references projects(id) on delete restrict,
  requester_id      uuid not null references profiles(id) on delete restrict,
  amount_myr        numeric(12,2) not null check (amount_myr > 0),
  reason            text,
  status            text not null default 'pending' check (status in ('pending','paid')),
  proof_url         text,
  proof_uploaded_at timestamptz,
  manual_reference  text,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists idx_refunds_status on refunds(status);

alter table refunds enable row level security;
drop policy if exists "refunds: requester reads own" on refunds;
drop policy if exists "refunds: staff read"          on refunds;
create policy "refunds: requester reads own" on refunds for select using (requester_id = auth.uid());
create policy "refunds: staff read"          on refunds for select using (is_staff(auth.uid()));

-- Recreate cancel_project: same 95/5 split, now ALSO queuing the refund.
create or replace function cancel_project(p_project uuid, p_reason text, p_actor uuid, p_fee_bps int default 500)
returns projects language plpgsql as $$
declare r projects; v_balance numeric; v_fee numeric; v_refund numeric;
begin
  select * into r from projects where id = p_project for update;
  if not found then raise exception 'project % not found', p_project; end if;
  if r.status not in ('submitted','approved','funded','live','awarded','in_progress','revision_requested','submitted_work','in_review') then
    raise exception 'project % cannot be cancelled from % state', p_project, r.status;
  end if;
  v_balance := coalesce((select sum(amount_myr) from escrow_ledger where project_id = p_project), 0);
  if v_balance > 0 then
    v_fee    := round(v_balance * p_fee_bps / 10000.0, 2);
    v_refund := v_balance - v_fee;
    if v_refund > 0 then
      insert into escrow_ledger(project_id, entry_type, amount_myr, created_by, note)
        values (p_project, 'refund', -v_refund, p_actor, 'Cancellation refund');
      insert into refunds(project_id, requester_id, amount_myr, reason)
        values (p_project, r.requester_id, v_refund, p_reason)
        on conflict (project_id) do nothing;
    end if;
    if v_fee > 0 then
      insert into escrow_ledger(project_id, entry_type, amount_myr, created_by, note)
        values (p_project, 'commission', -v_fee, p_actor, 'Cancellation admin fee (5%)');
    end if;
  end if;
  update projects set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
    where id = p_project returning * into r;
  return r;
end; $$;

-- Recreate expire_no_submission: same auto-refund, now ALSO queuing the refund.
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
  v_balance := coalesce((select sum(amount_myr) from escrow_ledger where project_id = p_project), 0);
  if v_balance > 0 then
    v_fee    := round(v_balance * 0.05, 2);
    v_refund := v_balance - v_fee;
    if v_refund > 0 then
      insert into escrow_ledger(project_id, entry_type, amount_myr, created_by, note)
        values (p_project, 'refund', -v_refund, p_actor, 'Auto-expiry refund (no submission)');
      insert into refunds(project_id, requester_id, amount_myr, reason)
        values (p_project, r.requester_id, v_refund, 'Auto-expired: deadline passed with no submission')
        on conflict (project_id) do nothing;
    end if;
    if v_fee > 0 then
      insert into escrow_ledger(project_id, entry_type, amount_myr, created_by, note)
        values (p_project, 'commission', -v_fee, p_actor, 'Auto-expiry admin fee (5%)');
    end if;
  end if;
  update projects
    set status = 'cancelled', cancelled_at = now(),
        cancel_reason = 'Auto-expired: deadline passed with no submission (95% refunded)'
    where id = p_project returning * into r;
  return r;
end; $$;
