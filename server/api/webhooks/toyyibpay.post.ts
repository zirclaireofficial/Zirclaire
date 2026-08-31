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
  // ToyyibPay's callback carries the result directly: status '1' = success.
  const callbackSuccess = String(body?.status ?? body?.status_id ?? '') === '1'
  console.log('[toyyibpay webhook] callback', { billCode, status: body?.status, order: body?.order_id })
  const db = serviceClient(event)

  // ---- Project funding? ----
  const { data: pay } = await db
    .from('payments').select('id, project_id, status').eq('toyyibpay_billcode', billCode).maybeSingle()
  if (pay) {
    if (pay.status === 'verified') return { received: true, duplicate: true }
    if (!(await verified(billCode, callbackSuccess))) return { received: true, notPaid: true }
    await fundProjectFromBill(db, pay.id, pay.project_id)
    return { received: true, kind: 'project' }
  }

  // ---- Royalty purchase? ----
  const { data: rp } = await db
    .from('royalty_payments').select('id, item_id, buyer_id, status, reference').eq('toyyibpay_billcode', billCode).maybeSingle()
  if (rp) {
    if (rp.status === 'paid') return { received: true, duplicate: true }
    if (!(await verified(billCode, callbackSuccess))) return { received: true, notPaid: true }
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

// Confirm the bill is really paid. We never fund on the (unsigned) callback
// alone — we always confirm with getBillTransactions. But that endpoint can lag
// a few seconds behind the callback, so when ToyyibPay's callback says success
// we retry a few times before giving up (the daily reconcile is the backstop).
async function verified(billCode: string, callbackSuccess = false): Promise<boolean> {
  const attempts = callbackSuccess ? 4 : 1
  for (let i = 0; i < attempts; i++) {
    try {
      const st = await getBillStatus(billCode)
      if (st.paid) return true
      if (st.status === '3' && !callbackSuccess) return false // definitively failed
    } catch (err) {
      console.error('[toyyibpay webhook] verify failed', err)
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000))
  }
  return false // leave it 'claimed'; reconcile / a later callback retries
}

async function fundProjectFromBill(db: SupabaseClient, paymentId: string, projectId: string) {
  const { data: project } = await db.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) return

  // Fund FIRST, mark the payment settled ONLY on success. If funding fails we
  // must NOT flip the payment to 'verified' — leaving it 'claimed' is what lets
  // the reconcile cron (and ToyyibPay's own callback retry) pick it up again.
  if (project.status === 'approved') {
    if (project.service_id) {
      // Service order: provider is already assigned — fund and go straight to awarded.
      const { error: sErr } = await db.rpc('fund_service_order', { p_project: project.id, p_actor: project.requester_id })
      if (sErr) {
        console.error('[toyyibpay webhook] fund_service_order failed', { projectId, err: sErr })
        throw createError({ statusCode: 500, statusMessage: 'funding failed, will retry' })
      }
      await notify(db, project.requester_id, { type: 'payment_received', title: 'Order confirmed', body: `Your order "${project.title}" is paid — the provider will start the work.`, link: '/projects' })
      if (project.awarded_provider_id) {
        await notify(db, project.awarded_provider_id, { type: 'service_ordered', title: 'New order', body: `You have a new paid order: "${project.title}".`, link: '/projects' })
      }
    } else {
      // Commissioned project: fund, then open for applications.
      const { error: fErr } = await db.rpc('fund_project', { p_project: project.id, p_amount: project.budget_myr, p_actor: project.requester_id })
      if (fErr) {
        console.error('[toyyibpay webhook] fund_project failed', { projectId, err: fErr })
        throw createError({ statusCode: 500, statusMessage: 'funding failed, will retry' })
      }
      const mins = project.timeline_minutes ?? 2880
      const { error: lErr } = await db.rpc('push_project_live', { p_project: project.id, p_deadline: new Date(Date.now() + mins * 60_000).toISOString() })
      if (lErr) console.error('[toyyibpay webhook] push_project_live failed (funded, not live)', { projectId, err: lErr })
      await notify(db, project.requester_id, { type: 'payment_received', title: 'Payment received', body: `"${project.title}" is funded and now live for providers to apply.`, link: '/projects' })
    }
  }

  // Funded now, or already funded by a prior/concurrent run. Settle the payment.
  await db.from('payments').update({ status: 'verified', paid_at: new Date().toISOString() })
    .eq('id', paymentId).eq('status', 'claimed')
}
