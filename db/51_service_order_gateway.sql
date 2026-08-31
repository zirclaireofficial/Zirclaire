-- =====================================================================
-- Zirclaire — 51_service_order_gateway.sql
-- Make ordering a service go through the payment gateway BEFORE the project
-- starts (previously order_service created a pre-funded project instantly).
--   * order_service_pending() creates the order as an UNFUNDED, 'approved'
--     project (provider already known) — no escrow entry, nothing starts yet.
--   * fund_service_order() runs ONLY after payment is confirmed: it writes the
--     escrow 'fund' entry, moves the project to 'awarded', and counts the sale.
-- The old order_service() stays for simulator mode.
-- Run AFTER 40_currency_myr_rename.sql.
-- =====================================================================

-- Create the order without funding it. Provider is pre-assigned; status is
-- 'approved' so the existing gateway funding path (bill -> webhook) can fund it.
create or replace function order_service_pending(p_tier uuid, p_buyer uuid)
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
    'approved', v_service.provider_id, null,
    v_tier.service_id, p_tier, v_deadline
  ) returning * into r;
  return r;
end; $$;

-- Fund a paid service order: approved -> awarded, write escrow, count the sale.
-- Called by the payment webhook / return handler once the bill is confirmed.
create or replace function fund_service_order(p_project uuid, p_actor uuid)
returns projects language plpgsql as $$
declare r projects;
begin
  update projects
    set status = 'awarded', funded_amount_myr = budget_myr
    where id = p_project and status = 'approved' and service_id is not null
    returning * into r;
  if not found then raise exception 'project % is not a fundable service order', p_project; end if;

  insert into escrow_ledger (project_id, entry_type, amount_myr, created_by)
    values (p_project, 'fund', r.budget_myr, p_actor);
  update services set order_count = order_count + 1 where id = r.service_id;
  return r;
end; $$;

revoke execute on function order_service_pending(uuid, uuid) from public;
revoke execute on function fund_service_order(uuid, uuid)   from public;
grant  execute on function order_service_pending(uuid, uuid) to service_role;
grant  execute on function fund_service_order(uuid, uuid)   to service_role;
