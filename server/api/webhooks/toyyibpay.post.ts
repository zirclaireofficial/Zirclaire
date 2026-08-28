// POST /api/webhooks/toyyibpay   (called by ToyyibPay after a payment)
// ToyyibPay's callback is UNSIGNED, so it is only a hint — we never fund on the
// callback's word. We look up the bill, then RE-VERIFY with getBillTransactions
// (server-to-server) and fund only if ToyyibPay itself confirms it's paid.
//
// Idempotent: funding goes through fund_project (atomic on status='approved'),
// and we only flip a payment 'claimed' -> 'verified' once, so a replayed
// callback is a harmless no-op.
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '../../utils/auth'
import { getBillStatus } from '../../utils/toyyibpay'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  // ToyyibPay posts form-urlencoded: billcode, order_id, status, refno, reason…
  const body = await readBody<Record<string, any>>(event)
  const billCode: string | undefined = body?.billcode ?? body?.billCode
  if (!billCode) return { received: true, ignored: 'no billcode' }

  const db = serviceClient(event)

  const { data: pay } = await db
    .from('payments')
    .select('id, project_id, status')
    .eq('toyyibpay_billcode', billCode)
    .maybeSingle()
  if (!pay) return { received: true, ignored: 'unknown bill' }
  if (pay.status === 'verified') return { received: true, duplicate: true }

  // The trusted check — ask ToyyibPay directly.
  let st
  try {
    st = await getBillStatus(billCode)
  } catch (err) {
    // Couldn't verify right now; leave it 'claimed' so the reconcile sweep or a
    // later callback retries. Return 200 so ToyyibPay doesn't hammer us.
    console.error('[toyyibpay webhook] verify failed', err)
    return { received: true, verify: 'deferred' }
  }
  if (!st.paid) return { received: true, notPaid: true }

  await fundFromBill(db, pay.id, pay.project_id)
  return { received: true }
})

async function fundFromBill(db: SupabaseClient, paymentId: string, projectId: string) {
  await db
    .from('payments')
    .update({ status: 'verified', paid_at: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('status', 'claimed') // flip once

  const { data: project } = await db.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project || project.status !== 'approved') return // atomic guard: only fund approved

  await db.rpc('fund_project', {
    p_project: project.id,
    p_amount: project.budget_myr,
    p_actor: project.requester_id,
  })
  const mins = project.timeline_minutes ?? 2880
  const deadline = new Date(Date.now() + mins * 60_000).toISOString()
  await db.rpc('push_project_live', { p_project: project.id, p_deadline: deadline })

  await notify(db, project.requester_id, {
    type: 'payment_received',
    title: 'Payment received',
    body: `"${project.title}" is funded and now live for providers to apply.`,
    link: '/projects',
  })
}
