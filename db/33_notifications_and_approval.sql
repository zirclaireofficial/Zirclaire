-- =====================================================================
-- Zirclaire — 33_notifications_and_approval.sql
-- Two things:
--   1. A general in-site NOTIFICATIONS system (reusable for any event).
--   2. Approve-before-pay: a new 'approved' project state. Flow becomes
--      submitted -> (admin approves) approved -> (requester pays) funded -> live.
-- Run AFTER all prior migrations.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1a. New project state: 'approved' (payment pending), between submitted
--     and funded. Added as a value only — no row uses it in this script,
--     so it's safe within the migration transaction.
-- ---------------------------------------------------------------------
alter type project_status add value if not exists 'approved' before 'funded';

-- ---------------------------------------------------------------------
-- 1b. Approve a submitted project (admin). submitted -> approved.
-- ---------------------------------------------------------------------
create or replace function approve_project(p_project uuid, p_actor uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects set status = 'approved'
    where id = p_project and status = 'submitted'
    returning * into r;
  if not found then raise exception 'project % is not in submitted state', p_project; end if;
  return r;
end; $$;

-- ---------------------------------------------------------------------
-- 1c. Funding now moves approved -> funded (was submitted -> funded), so
--     money is only taken AFTER an admin has approved the project.
-- ---------------------------------------------------------------------
create or replace function fund_project(p_project uuid, p_amount numeric, p_actor uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'fund amount must be positive';
  end if;
  update projects set status = 'funded', funded_amount_usd = p_amount
    where id = p_project and status = 'approved'
    returning * into r;
  if not found then raise exception 'project % is not in approved state', p_project; end if;
  insert into escrow_ledger(project_id, entry_type, amount_usd, created_by)
    values (p_project, 'fund', p_amount, p_actor);
  return r;
end; $$;

revoke execute on function approve_project(uuid,uuid) from public;
grant  execute on function approve_project(uuid,uuid) to service_role;

-- ---------------------------------------------------------------------
-- 2. Notifications — one row per recipient per event. `type` is free text
--    (not an enum) so new event kinds can be added without a migration.
-- ---------------------------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,  -- recipient
  type       text not null default 'system',   -- 'project_approved', 'payment_received', ...
  title      text not null,
  body       text,
  link       text,                              -- in-app path to open on click
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user   on notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on notifications(user_id) where read_at is null;

alter table notifications enable row level security;

-- The recipient reads their own and can mark them read. All INSERTs are
-- server-side (service role), so there's no client insert policy.
create policy "notifications: read own"
  on notifications for select using (user_id = auth.uid());
create policy "notifications: mark own read"
  on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, update on notifications to authenticated;

-- Push new notifications to the browser in real time (same mechanism as chat).
alter publication supabase_realtime add table notifications;
