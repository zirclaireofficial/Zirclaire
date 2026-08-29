// Shared: finalize a royalty purchase (records the sale + 85/15 split via
// purchase_royalty, then creates the owner's 15% payout to-do and notifies
// admin). Called both by the simulator buy and by the gateway webhook once
// payment is confirmed.
import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyRoles } from './notify'

export async function completeRoyaltyPurchase(
  db: SupabaseClient, itemId: string, buyerId: string, reference: string,
): Promise<{ id: string }> {
  const { data, error } = await db.rpc('purchase_royalty', {
    p_item: itemId, p_buyer: buyerId, p_reference: reference,
  })
  if (error) throw error
  const pur = data as { id: string; item_id: string; payout_myr: number }

  const { data: item } = await db
    .from('royalty_items').select('creator_id, title').eq('id', pur.item_id).maybeSingle()
  if (item?.creator_id) {
    await db.from('royalty_payouts').insert({
      purchase_id: pur.id, owner_id: item.creator_id, amount_myr: pur.payout_myr,
    })
    await notifyRoles(db, ['admin', 'master'], {
      type: 'royalty_payout_due',
      title: 'Royalty payout due',
      body: `"${item.title ?? 'A work'}" sold — an owner royalty payout is ready to send.`,
      link: '/admin/royalty-payouts',
    })
  }
  return { id: pur.id }
}
