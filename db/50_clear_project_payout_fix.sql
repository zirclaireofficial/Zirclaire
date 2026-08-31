-- =====================================================================
-- Zirclaire — 50_clear_project_payout_fix.sql
-- BUG: clear_project (finished -> closed) was re-emitted in later migrations
-- WITHOUT the payout-row creation, so the new accept/auto-accept flow closed
-- projects but never queued the provider's payout for the master. This restores
-- it, and backfills any already-closed project that's missing its payout row.
-- Run AFTER 49_submit_from_awarded.sql.
-- =====================================================================

create or replace function clear_project(p_project uuid, p_actor uuid)
returns projects language plpgsql as $$
declare r projects; v_amount numeric; v_prov profiles;
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

-- Backfill: closed projects that never got a payout row (from the buggy window).
insert into payouts(project_id, provider_id, amount_myr, payout_method, account_number, account_holder, status, release_at)
select p.id, p.awarded_provider_id, round(coalesce(p.funded_amount_myr, 0) * 0.80, 2),
       pr.payout_provider::text, pr.payout_account, pr.full_name, 'pending', now()
from projects p
join profiles pr on pr.id = p.awarded_provider_id
where p.status = 'closed'
  and coalesce(p.funded_amount_myr, 0) > 0
  and p.awarded_provider_id is not null
  and not exists (select 1 from payouts po where po.project_id = p.id)
on conflict (project_id) do nothing;
