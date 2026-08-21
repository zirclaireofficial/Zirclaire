-- =====================================================================
-- Zirclaire — 36_royalty_split_fix.sql
-- Aligns the royalty split with Terms §16A.7 / §16A.11: on a royalty sale
-- the PLATFORM keeps 85% and the OWNER keeps 15% (previously reversed).
-- Redefines purchase_royalty for already-deployed databases and corrects the
-- support knowledge-base wording. Run AFTER 35_cancellation_dispute.sql.
-- =====================================================================

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
  v_commission := round(v_amount * 0.85, 2);   -- platform 85% (§16A.11)
  v_payout     := v_amount - v_commission;      -- owner 15% (§16A.7), exact

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

revoke execute on function purchase_royalty(uuid, uuid, text) from public;
grant  execute on function purchase_royalty(uuid, uuid, text) to service_role;

-- Correct the support bot's knowledge base (string-replace so it works
-- regardless of the row key).
update kb set answer = replace(answer,
  'the platform takes 15% and the creator keeps 85%',
  'the platform takes 85% and the owner keeps 15%');
update kb set answer = replace(answer,
  'The platform takes 15% per sale',
  'The platform takes 85% per sale');
