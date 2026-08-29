-- =====================================================================
-- Zirclaire — 46_hard_delete_user.sql
-- hard_delete_user(uuid): permanently erase ONE user and everything they own
-- — profile, KYC, posts, comments, likes, reports, their projects (and the
-- escrow/payments/deliverables/reviews/chats under them), applications,
-- services, royalty listings + purchases, payouts, messages, notifications,
-- cancellation/dispute records — then the auth account itself.
--
-- References that merely record "who did an admin action" (reviewed_by,
-- verified_by, resolved_by, assigned/awarded provider on OTHER people's
-- projects, dispute actor ids, etc.) are set to NULL rather than deleted, so
-- another user's records aren't destroyed.
--
-- ⚠️  IRREVERSIBLE. Intended for cleanup/testing and GDPR-style erasure. If the
--     user was a counterparty in another user's completed transaction, those
--     shared rows (that provider's deliverable, their payout, a buyer's
--     purchase of this user's work) are removed too — hard delete is not
--     anonymisation. Back up first on production.
--
-- Usage:  select hard_delete_user('00000000-0000-0000-0000-000000000000');
-- Run AFTER all prior migrations.
-- =====================================================================

create or replace function hard_delete_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Lift the append-only guards on BOTH money ledgers for this maintenance op.
  alter table escrow_ledger  disable trigger trg_ledger_no_update;
  alter table escrow_ledger  disable trigger trg_ledger_no_delete;
  alter table royalty_ledger disable trigger trg_royalty_ledger_no_update;
  alter table royalty_ledger disable trigger trg_royalty_ledger_no_delete;

  -- 1) Null out "who did this" / counterparty references on OTHER rows so their
  --    foreign keys don't block, without deleting those other users' records.
  update profiles              set kyc_reviewed_by    = null where kyc_reviewed_by   = p_user;
  update profiles              set suspended_by       = null where suspended_by      = p_user;
  update payments              set verified_by        = null where verified_by       = p_user;
  update escrow_ledger         set created_by         = null where created_by        = p_user;
  update reports               set resolved_by        = null where resolved_by       = p_user;
  update royalty_items         set reviewed_by        = null where reviewed_by       = p_user;
  update services              set reviewed_by        = null where reviewed_by       = p_user;
  update conversations         set assigned_admin_id  = null where assigned_admin_id = p_user;
  update conversations         set created_by         = null where created_by        = p_user;
  update conversations         set closed_by          = null where closed_by         = p_user;
  update projects              set assigned_provider_id = null where assigned_provider_id = p_user;
  update projects              set awarded_provider_id  = null where awarded_provider_id  = p_user;
  update cancellation_requests set provider_id        = null where provider_id       = p_user;
  update cancellation_requests set admin_id           = null where admin_id          = p_user;
  update cancellation_requests set master_id          = null where master_id         = p_user;
  update cancellation_requests set appealed_by        = null where appealed_by       = p_user;
  update dispute_messages      set sender_id          = null where sender_id         = p_user;
  -- Other buyers' projects that ordered THIS user's service: detach the link
  -- (so cascading this user's services won't be blocked).
  update projects set service_id = null, service_tier_id = null
    where service_id in (select id from services where provider_id = p_user);

  -- 2) Royalty graph (RESTRICT foreign keys → delete children first).
  --    a) purchases the user MADE, and b) everything hanging off items the user
  --    CREATED (including other buyers' purchases of those items).
  delete from royalty_ledger
    where purchase_id in (select id from royalty_purchases where buyer_id = p_user)
       or item_id     in (select id from royalty_items     where creator_id = p_user)
       or purchase_id in (select rp.id from royalty_purchases rp
                            join royalty_items ri on ri.id = rp.item_id
                           where ri.creator_id = p_user);
  delete from royalty_payments
    where buyer_id = p_user
       or item_id in (select id from royalty_items where creator_id = p_user);
  delete from royalty_purchases
    where buyer_id = p_user
       or item_id in (select id from royalty_items where creator_id = p_user); -- cascades royalty_payouts by purchase_id
  delete from royalty_payouts where owner_id = p_user;
  delete from royalty_items   where creator_id = p_user;

  -- 3) The user's provider work on OTHER people's projects (RESTRICT FKs).
  delete from reviews      where reviewer_id = p_user;
  delete from deliverables where provider_id = p_user;
  delete from payouts      where provider_id = p_user;

  -- 4) The user's OWN projects — clear their RESTRICT children, then delete the
  --    projects (cascades applications, deliverables, reviews, payments, project
  --    conversations + messages/participants, cancellation_requests + disputes).
  delete from escrow_ledger where project_id in (select id from projects where requester_id = p_user);
  delete from payouts        where project_id in (select id from projects where requester_id = p_user);
  delete from projects       where requester_id = p_user;

  -- 5) Any remaining payments the user made, and support threads they opened.
  delete from payments      where payer_id = p_user;
  delete from conversations where created_by = p_user;  -- (created_by nulled above; this is a safety net)

  -- 6) Finally, remove the account. Deleting auth.users cascades to profiles,
  --    which cascades the remaining CASCADE children (posts, comments, likes,
  --    reports filed, services, applications, messages, participants,
  --    notifications).
  delete from auth.users where id = p_user;

  -- Restore the ledger guards.
  alter table escrow_ledger  enable trigger trg_ledger_no_update;
  alter table escrow_ledger  enable trigger trg_ledger_no_delete;
  alter table royalty_ledger enable trigger trg_royalty_ledger_no_update;
  alter table royalty_ledger enable trigger trg_royalty_ledger_no_delete;
end;
$$;

comment on function hard_delete_user(uuid) is
  'Permanently erase a user and all their owned data, then the auth account. Irreversible.';
