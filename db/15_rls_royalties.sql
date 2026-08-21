-- =====================================================================
-- Zirclaire — 15_rls_royalties.sql
-- Row-Level Security + the purchase transition for the royalty store.
-- Run AFTER 14_royalties.sql.
--
-- Agreed rules:
--   * Store is PUBLIC to read (anonymous included) — APPROVED items only.
--   * A creator sees their own items in any state (drafts, rejected...).
--   * Publishing an item: an approved Service Provider inserts their own,
--     as 'pending'. Approval flips it to 'approved' (server/admin only).
--   * Buying: the purchase + the 15/85 split happen in ONE server-side
--     function (below), so a sale can never record money without access,
--     or access without money.
--   * Downloading the file: NOT governed here — it goes through a server
--     route that checks a purchase exists before signing a Cloudinary URL.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visibility helpers (SECURITY DEFINER -> no policy recursion)
-- ---------------------------------------------------------------------
create or replace function royalty_item_is_visible(iid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from royalty_items
    where id = iid and (status = 'approved' or creator_id = auth.uid())
  ) or is_admin(auth.uid());
$$;

create or replace function owns_royalty_item(iid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from royalty_items where id = iid and creator_id = auth.uid());
$$;

-- Has the caller bought this item? Drives download access + "owned" badges.
create or replace function has_purchased(iid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from royalty_purchases where item_id = iid and buyer_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Items
--   read   : public — approved items; creator sees own drafts; admin all.
--   insert : an approved Service Provider, authoring their own, as pending.
--   update : none from the client (approval + edits are server-side).
--   delete : the creator may remove their own (hard delete).
-- ---------------------------------------------------------------------
create policy "royalty_items: public reads approved; creator/admin read all"
  on royalty_items for select using (
    status = 'approved' or creator_id = auth.uid() or is_admin(auth.uid())
  );

create policy "royalty_items: approved provider publishes own as pending"
  on royalty_items for insert with check (
    creator_id = auth.uid()
    and auth_role() = 'service_provider'
    and is_approved(auth.uid())
    and status = 'pending'
  );

create policy "royalty_items: creator deletes own"
  on royalty_items for delete using (creator_id = auth.uid());

-- ---------------------------------------------------------------------
-- Purchases
--   read   : the buyer sees their own; the creator sees sales of their
--            items; admin sees all. (Creators need this for their sales
--            history; buyers for their library.)
--   insert : NONE from the client — purchasing is the server function
--            below, so money and access are always written together.
-- ---------------------------------------------------------------------
create policy "royalty_purchases: buyer reads own"
  on royalty_purchases for select using (buyer_id = auth.uid());

create policy "royalty_purchases: creator reads sales of own items"
  on royalty_purchases for select using (
    exists (select 1 from royalty_items i where i.id = item_id and i.creator_id = auth.uid())
  );

create policy "royalty_purchases: admin reads all"
  on royalty_purchases for select using (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- Ledger — same visibility as the purchase it belongs to (buyer, the
-- item's creator, admin). Append-only; no client writes.
-- ---------------------------------------------------------------------
create policy "royalty_ledger: parties and admin read"
  on royalty_ledger for select using (
    is_admin(auth.uid())
    or exists (
      select 1 from royalty_purchases p
      where p.id = purchase_id
        and (p.buyer_id = auth.uid()
             or exists (select 1 from royalty_items i where i.id = p.item_id and i.creator_id = auth.uid()))
    )
  );

-- ---------------------------------------------------------------------
-- Purchase transition (atomic). Called ONLY by the server (service_role).
-- Records the purchase and the three ledger rows (sale / commission /
-- payout) in one transaction. Guards:
--   * the item must be approved (you can't buy a draft or removed work),
--   * a buyer cannot buy their own work,
--   * buying twice is blocked by the unique(item_id, buyer_id) constraint.
-- Commission is 85% (platform); payout is the remaining 15% (owner). §16A.7/§16A.11.
-- ---------------------------------------------------------------------
create or replace function purchase_royalty(p_item uuid, p_buyer uuid, p_reference text)
returns royalty_purchases language plpgsql as $$
declare
  v_item       royalty_items;
  v_amount     numeric(12,2);
  v_commission numeric(12,2);
  v_payout     numeric(12,2);
  v_purchase   royalty_purchases;
begin
  select * into v_item from royalty_items where id = p_item;
  if not found then raise exception 'royalty item % not found', p_item; end if;
  if v_item.status <> 'approved' then
    raise exception 'royalty item % is not available for purchase', p_item;
  end if;
  if v_item.creator_id = p_buyer then
    raise exception 'a creator cannot buy their own work';
  end if;

  v_amount     := v_item.price_usd;
  v_commission := round(v_amount * 0.85, 2);   -- platform 85%
  v_payout     := v_amount - v_commission;      -- owner 15% (exact, no rounding drift)

  -- unique(item_id, buyer_id) turns a repeat purchase into a clean error.
  insert into royalty_purchases (item_id, buyer_id, amount_usd, commission_usd, payout_usd, reference)
    values (p_item, p_buyer, v_amount, v_commission, v_payout, p_reference)
    returning * into v_purchase;

  insert into royalty_ledger (purchase_id, item_id, entry_type, amount_usd) values
    (v_purchase.id, p_item, 'sale',        v_amount),
    (v_purchase.id, p_item, 'commission', -v_commission),
    (v_purchase.id, p_item, 'payout',     -v_payout);

  update royalty_items set purchase_count = purchase_count + 1 where id = p_item;

  return v_purchase;
end; $$;

-- Locked to the server, like the project state-machine functions.
revoke execute on function purchase_royalty(uuid, uuid, text) from public;
grant execute on function purchase_royalty(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- Grants. RLS decides the rows; these decide table access at all.
-- ---------------------------------------------------------------------
grant select on royalty_store to anon, authenticated;
grant select on royalty_items to anon, authenticated;
grant select, insert, delete on royalty_items to authenticated;
grant select on royalty_purchases to authenticated;
grant select on royalty_ledger    to authenticated;
