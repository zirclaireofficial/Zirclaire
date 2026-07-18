-- =====================================================================
-- Zirclaire — 05_escrow.sql
-- The money trail. Append-only ledger; a project's held balance is the
-- SUM of its entries. Run AFTER 04_projects.sql.
--
-- Sign convention (so SUM = current balance):
--   fund       > 0   SR funds the project
--   commission < 0   platform's 20% cut
--   payout     < 0   SP's 80%
--   refund     < 0   returned to SR on cancellation
-- Invariants:
--   after 'closed'  : SUM(entries) = 0  (fund fully distributed 20/80)
--   after 'cancelled' (was funded): fund + refund = 0
-- =====================================================================

create table escrow_ledger (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  entry_type ledger_entry_type not null,
  amount_usd numeric(12,2) not null,
  created_by uuid references profiles(id),   -- admin who recorded it
  note       text,
  created_at timestamptz not null default now(),

  -- Enforce the sign convention at the database level.
  constraint chk_ledger_sign check (
    (entry_type = 'fund' and amount_usd > 0)
    or (entry_type in ('commission', 'payout', 'refund') and amount_usd < 0)
  )
);

create index idx_ledger_project on escrow_ledger(project_id);
create index idx_ledger_type    on escrow_ledger(entry_type);

-- ---------------------------------------------------------------------
-- Append-only guard: block UPDATE and DELETE outright. Corrections are
-- made with compensating entries, never edits — preserving a full audit
-- trail. (service_role is NOT exempt from triggers, unlike RLS.)
-- ---------------------------------------------------------------------
create or replace function forbid_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'escrow_ledger is append-only; % is not permitted', tg_op;
end;
$$;

create trigger trg_ledger_no_update
  before update on escrow_ledger
  for each row execute function forbid_ledger_mutation();

create trigger trg_ledger_no_delete
  before delete on escrow_ledger
  for each row execute function forbid_ledger_mutation();

-- ---------------------------------------------------------------------
-- Convenience: current held balance per project.
-- ---------------------------------------------------------------------
create view project_balances as
  select
    p.id                              as project_id,
    coalesce(sum(l.amount_usd), 0)    as balance_usd,
    p.funded_amount_usd,
    p.status
  from projects p
  left join escrow_ledger l on l.project_id = p.id
  group by p.id;

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS (policies added later).
-- ---------------------------------------------------------------------
alter table escrow_ledger enable row level security;
