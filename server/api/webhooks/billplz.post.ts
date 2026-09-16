// POST /api/webhooks/billplz   (called by Billplz after a payment)
// Handles BOTH project/service funding and royalty purchases (one callback URL).
// Billplz signs its callback, but we don't rely on that — we always re-verify
// the bill server-to-server (getBillStatus) before doing anything. Idempotent.
import { serviceClient } from '../../utils/auth'
import { getBillStatus } from '../../utils/billplz'
import { fundPaidProject } from '../../utils/funding'
import { completeRoyaltyPurchase } from '../../utils/royalty'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, any>>(event)
  const billId: string | undefined = body?.id ?? body?.['billplz[id]']
  if (!billId) return { received: true, ignored: 'no bill id' }
  console.log('[billplz webhook] callback', { billId, paid: body?.paid, state: body?.state })
  const db = serviceClient(event)

  // ---- Project / service funding? ----
  const { data: pay } = await db
    .from('payments').select('id, project_id, status').eq('toyyibpay_billcode', billId).maybeSingle()
  if (pay) {
    if (pay.status === 'verified') return { received: true, duplicate: true }
    if (!(await verified(billId))) return { received: true, notPaid: true }
    await fundPaidProject(db, pay.project_id, pay.id)
    return { received: true, kind: 'project' }
  }

  // ---- Royalty purchase? ----
  const { data: rp } = await db
    .from('royalty_payments').select('id, item_id, buyer_id, status, reference').eq('toyyibpay_billcode', billId).maybeSingle()
  if (rp) {
    if (rp.status === 'paid') return { received: true, duplicate: true }
    if (!(await verified(billId))) return { received: true, notPaid: true }
    const { data: flipped } = await db
      .from('royalty_payments').update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', rp.id).eq('status', 'pending').select('id').maybeSingle()
    if (!flipped) return { received: true, duplicate: true }
    try { await completeRoyaltyPurchase(db, rp.item_id, rp.buyer_id, rp.reference) } catch { /* already owned / race */ }
    await notify(db, rp.buyer_id, {
      type: 'royalty_purchased', title: 'Purchase complete',
      body: 'Your purchase is complete — download it from your library.', link: '/royalties/library',
    })
    return { received: true, kind: 'royalty' }
  }

  return { received: true, ignored: 'unknown bill' }
})

async function verified(billId: string): Promise<boolean> {
  try { return (await getBillStatus(billId)).paid }
  catch (err) { console.error('[billplz webhook] verify failed', err); return false }
}
