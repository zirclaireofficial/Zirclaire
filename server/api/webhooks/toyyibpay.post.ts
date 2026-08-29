// POST /api/webhooks/toyyibpay   (called by ToyyibPay after a payment)
// Handles BOTH project funding and royalty purchases (same callback URL). The
// callback is UNSIGNED, so it's only a hint — we always re-verify with
// getBillStatus before doing anything. Idempotent throughout.
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '../../utils/auth'
import { getBillStatus } from '../../utils/toyyibpay'
import { completeRoyaltyPurchase } from '../../utils/royalty'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, any>>(event)
  const billCode: string | undefined = body?.billcode ?? body?.billCode
  if (!billCode) return { received: true, ignored: 'no billcode' }
  const db = serviceClient(event)

  // ---- Project funding? ----
  const { data: pay } = await db
    .from('payments').select('id, project_id, status').eq('toyyibpay_billcode', billCode).maybeSingle()
  if (pay) {
    if (pay.status === 'verified') return { received: true, duplicate: true }
    if (!(await verified(billCode))) return { received: true, notPaid: true }
    await fundProjectFromBill(db, pay.id, pay.project_id)
    return { received: true, kind: 'project' }
  }

  // ---- Royalty purchase? ----
  const { data: rp } = await db
    .from('royalty_payments').select('id, item_id, buyer_id, status, reference').eq('toyyibpay_billcode', billCode).maybeSingle()
  if (rp) {
    if (rp.status === 'paid') return { received: true, duplicate: true }
    if (!(await verified(billCode))) return { received: true, notPaid: true }
    // Flip once — the winner finalizes the sale.
    const { data: flipped } = await db
      .from('royalty_payments').update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', rp.id).eq('status', 'pending').select('id').maybeSingle()
    if (!flipped) return { received: true, duplicate: true }
    try {
      await completeRoyaltyPurchase(db, rp.item_id, rp.buyer_id, rp.reference)
    } catch {
      // already owned / race — the payment is recorded; nothing else to do.
    }
    await notify(db, rp.buyer_id, {
      type: 'royalty_purchased',
      title: 'Purchase complete',
      body: 'Your purchase is complete — download it from your library.',
      link: '/royalties/library',
    })
    return { received: true, kind: 'royalty' }
  }

  return { received: true, ignored: 'unknown bill' }
})

async function verified(billCode: string): Promise<boolean> {
  try {
    const st = await getBillStatus(billCode)
    return st.paid
  } catch (err) {
    console.error('[toyyibpay webhook] verify failed', err)
    return false // leave it pending; reconcile/next callback retries
  }
}

async function fundProjectFromBill(db: SupabaseClient, paymentId: string, projectId: string) {
  await db.from('payments').update({ status: 'verified', paid_at: new Date().toISOString() })
    .eq('id', paymentId).eq('status', 'claimed')
  const { data: project } = await db.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project || project.status !== 'approved') return
  await db.rpc('fund_project', { p_project: project.id, p_amount: project.budget_myr, p_actor: project.requester_id })
  const mins = project.timeline_minutes ?? 2880
  await db.rpc('push_project_live', { p_project: project.id, p_deadline: new Date(Date.now() + mins * 60_000).toISOString() })
  await notify(db, project.requester_id, {
    type: 'payment_received',
    title: 'Payment received',
    body: `"${project.title}" is funded and now live for providers to apply.`,
    link: '/projects',
  })
}
