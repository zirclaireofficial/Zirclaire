-- =====================================================================
-- Zirclaire — 40_currency_myr_rename.sql
-- Rename all money columns from *_usd to *_myr (values/amounts unchanged —
-- the platform transacts in Malaysian Ringgit). Postgres auto-updates check
-- constraints and view bodies on a column rename, but plpgsql FUNCTION bodies
-- reference columns by name as text, so every money function is recreated here
-- with the new names. Run AFTER 39_manual_payouts.sql.
-- =====================================================================

-- ---- 1. Rename the columns -----------------------------------------
alter table projects          rename column budget_usd         to budget_myr;
alter table projects          rename column funded_amount_usd  to funded_amount_myr;
alter table escrow_ledger     rename column amount_usd          to amount_myr;
alter table payments          rename column amount_usd          to amount_myr;
alter table royalty_items     rename column price_usd           to price_myr;
alter table royalty_purchases rename column amount_usd          to amount_myr;
alter table royalty_purchases rename column commission_usd      to commission_myr;
alter table royalty_purchases rename column payout_usd          to payout_myr;
alter table royalty_ledger    rename column amount_usd          to amount_myr;
alter table service_tiers     rename column price_usd           to price_myr;

-- Tidy the one explicitly-named constraint (auto-named ones are cosmetic).
alter table projects rename constraint projects_budget_usd_check to projects_budget_myr_check;

-- ---- 2. Rebuild the balances view (its alias can't auto-rename) -----
drop view if exists project_balances;
create view project_balances as
  select
    p.id                              as project_id,
    coalesce(sum(l.amount_myr), 0)    as balance_myr,
    p.funded_amount_myr,
    p.status
  from projects p
  left join escrow_ledger l on l.project_id = p.id
  group by p.id;

-- ---- 3. Recreate every money function with the new names -----------

-- submitted/approved -> funded
create or replace function fund_project(p_project uuid, p_amount numeric, p_actor uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'fund amount must be positive'; end if;
  update projects set status = 'funded', funded_amount_myr = p_amount
    where id = p_project and status = 'approved' returning * into r;
  if not found then raise exception 'project % is not in approved state', p_project; end if;
  insert into escrow_ledger(project_id, entry_type, amount_myr, created_by)
    values (p_project, 'fund', p_amount, p_actor);
  return r;
end; $$;

-- finished -> closed (+ commission 20% / payout 80%), blocked during a dispute
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
  v_amount := coalesce(r.funded_amount_myr, 0);
  update projects set status = 'closed', closed_at = now() where id = p_project returning * into r;
  insert into escrow_ledger(project_id, entry_type, amount_myr, created_by) values
    (p_project, 'commission', -round(v_amount * 0.20, 2), p_actor),
    (p_project, 'payout',     -round(v_amount * 0.80, 2), p_actor);
  return r;
end; $$;

-- active -> cancelled (refund minus fee; p_fee_bps default 5%)
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

-- auto-expiry: no submission before deadline -> refund 95%, close
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

-- royalty sale: platform 85% / owner 15%
create or replace function purchase_royalty(p_item uuid, p_buyer uuid, p_reference text)
returns royalty_purchases language plpgsql as $$
declare
  v_item royalty_items; v_amount numeric(12,2); v_commission numeric(12,2); v_payout numeric(12,2); v_purchase royalty_purchases;
begin
  select * into v_item from royalty_items where id = p_item;
  if not found then raise exception 'royalty item % not found', p_item; end if;
  if v_item.status <> 'approved' then raise exception 'royalty item % is not available for purchase', p_item; end if;
  if v_item.creator_id = p_buyer then raise exception 'a creator cannot buy their own work'; end if;

  v_amount     := v_item.price_myr;
  v_commission := round(v_amount * 0.85, 2);
  v_payout     := v_amount - v_commission;

  insert into royalty_purchases (item_id, buyer_id, amount_myr, commission_myr, payout_myr, reference)
    values (p_item, p_buyer, v_amount, v_commission, v_payout, p_reference) returning * into v_purchase;

  insert into royalty_ledger (purchase_id, item_id, entry_type, amount_myr) values
    (v_purchase.id, p_item, 'sale',        v_amount),
    (v_purchase.id, p_item, 'commission', -v_commission),
    (v_purchase.id, p_item, 'payout',     -v_payout);

  update royalty_items set purchase_count = purchase_count + 1 where id = p_item;
  return v_purchase;
end; $$;

-- order a fixed-price service -> pre-funded project (price snapshot)
create or replace function order_service(p_tier uuid, p_buyer uuid)
returns projects language plpgsql as $$
declare v_tier service_tiers; v_service services; v_deadline timestamptz; r projects;
begin
  select * into v_tier from service_tiers where id = p_tier;
  if not found then raise exception 'service tier % not found', p_tier; end if;
  select * into v_service from services where id = v_tier.service_id;
  if v_service.status <> 'approved' then raise exception 'service % is not available for ordering', v_service.id; end if;
  if v_service.provider_id = p_buyer then raise exception 'a provider cannot order their own service'; end if;
  if v_tier.delivery_minutes is not null then v_deadline := now() + make_interval(mins => v_tier.delivery_minutes); end if;

  insert into projects (
    requester_id, title, description, subcategory_id, budget_myr,
    status, awarded_provider_id, funded_amount_myr,
    service_id, service_tier_id, deadline_at
  ) values (
    p_buyer, v_service.title, v_service.description, v_service.subcategory_id, v_tier.price_myr,
    'awarded', v_service.provider_id, v_tier.price_myr,
    v_tier.service_id, p_tier, v_deadline
  ) returning * into r;

  insert into escrow_ledger (project_id, entry_type, amount_myr, created_by)
    values (r.id, 'fund', v_tier.price_myr, p_buyer);
  update services set order_count = order_count + 1 where id = v_service.id;
  return r;
end; $$;
