-- =====================================================================
-- Zirclaire — 17_rls_services.sql
-- RLS for service listings + the atomic order function. Run AFTER 16_services.sql.
--
-- Agreed rules:
--   * Store is PUBLIC to read (anonymous included) — APPROVED listings only.
--   * A provider sees their own listings in any state, and manages their tiers.
--   * Publishing a listing: an approved Service Provider inserts their own,
--     as 'pending'; approval (server/admin) flips it to 'approved'.
--   * Ordering a tier creates a pre-awarded, pre-funded project in ONE server
--     function (below) — so an order can never exist without its escrow entry.
--   * The order itself is a normal project from then on: existing project RLS
--     (requester = buyer, awarded provider) already governs who can see it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visibility helpers (SECURITY DEFINER -> no policy recursion)
-- ---------------------------------------------------------------------
create or replace function service_is_visible(sid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from services
    where id = sid and (status = 'approved' or provider_id = auth.uid())
  ) or is_admin(auth.uid());
$$;

create or replace function owns_service(sid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from services where id = sid and provider_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Services
--   read   : public — approved; provider sees own drafts; admin all.
--   insert : an approved Service Provider, authoring own, as pending.
--   delete : the provider (hard delete).
--   update : none from the client (approval + edits are server-side).
-- ---------------------------------------------------------------------
create policy "services: public reads approved; provider/admin read all"
  on services for select using (
    status = 'approved' or provider_id = auth.uid() or is_admin(auth.uid())
  );

create policy "services: approved provider publishes own as pending"
  on services for insert with check (
    provider_id = auth.uid()
    and auth_role() = 'service_provider'
    and is_approved(auth.uid())
    and status = 'pending'
  );

create policy "services: provider deletes own"
  on services for delete using (provider_id = auth.uid());

-- ---------------------------------------------------------------------
-- Tiers — visible with their service; created/removed by the service owner
-- at publish time (a safe write, no money involved).
-- ---------------------------------------------------------------------
create policy "service_tiers: visible with service"
  on service_tiers for select using (service_is_visible(service_id));

create policy "service_tiers: owner inserts"
  on service_tiers for insert with check (owns_service(service_id));

create policy "service_tiers: owner deletes"
  on service_tiers for delete using (owns_service(service_id));

-- ---------------------------------------------------------------------
-- Order a service tier (atomic). Called ONLY by the server (service_role).
-- Creates a project that is:
--   * owned by the buyer (requester_id),
--   * pre-awarded to the provider (awarded_provider_id),
--   * pre-funded with the tier price (status 'awarded' + escrow 'fund' entry),
--   * tagged with service_id + service_tier_id.
-- From here the provider calls start_work, and the rest of the existing state
-- machine (submit -> review -> accept -> clear, 20/80) runs unchanged.
-- Guards: the service must be approved; a provider can't buy their own service.
-- ---------------------------------------------------------------------
create or replace function order_service(p_tier uuid, p_buyer uuid)
returns projects language plpgsql as $$
declare
  v_tier     service_tiers;
  v_service  services;
  v_deadline timestamptz;
  r          projects;
begin
  select * into v_tier from service_tiers where id = p_tier;
  if not found then raise exception 'service tier % not found', p_tier; end if;

  select * into v_service from services where id = v_tier.service_id;
  if v_service.status <> 'approved' then
    raise exception 'service % is not available for ordering', v_service.id;
  end if;
  if v_service.provider_id = p_buyer then
    raise exception 'a provider cannot order their own service';
  end if;

  if v_tier.delivery_minutes is not null then
    v_deadline := now() + make_interval(mins => v_tier.delivery_minutes);
  end if;

  -- A pre-awarded, pre-funded project. Price is snapshotted into budget_usd /
  -- funded_amount_usd so a later tier price change never affects this order.
  insert into projects (
    requester_id, title, description, subcategory_id, budget_usd,
    status, awarded_provider_id, funded_amount_usd,
    service_id, service_tier_id, deadline_at
  ) values (
    p_buyer, v_service.title, v_service.description, v_service.subcategory_id, v_tier.price_usd,
    'awarded', v_service.provider_id, v_tier.price_usd,
    v_tier.service_id, p_tier, v_deadline
  ) returning * into r;

  insert into escrow_ledger (project_id, entry_type, amount_usd, created_by)
    values (r.id, 'fund', v_tier.price_usd, p_buyer);

  update services set order_count = order_count + 1 where id = v_service.id;

  return r;
end; $$;

revoke execute on function order_service(uuid, uuid) from public;
grant execute on function order_service(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- Grants. RLS decides the rows; these decide table access at all.
-- ---------------------------------------------------------------------
grant select on service_store to anon, authenticated;
grant select on services      to anon, authenticated;
grant select on service_tiers to anon, authenticated;
grant insert, delete on services      to authenticated;
grant insert, delete on service_tiers to authenticated;
