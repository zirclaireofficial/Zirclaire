// POST /api/payments/verify-return   { billCode }   (the payer, on return)
// Called when ToyyibPay redirects the payer back to the site. Re-verifies the
// bill with ToyyibPay and funds the project immediately if paid — so funding
// never has to wait for the (laggy) server callback or the nightly reconcile.
// Idempotent + atomic: fund_project only acts on an 'approved' project, so a
// concurrent webhook can't double-fund.
import { serviceClient, getCallerProfile } from '../../utils/auth'
import { getBillStatus } from '../../utils/toyyibpay'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  const { billCode } = await readBody(event)
  if (!billCode) throw createError({ statusCode: 400, statusMessage: 'billCode is required' })

  const db = serviceClient(event)
  const { data: pay } = await db
    .from('payments')
    .select('id, project_id, status, payer_id')
    .eq('toyyibpay_billcode', billCode)
    .maybeSingle()
  if (!pay) return { funded: false, status: 'unknown', note: 'no such bill' }

  const isStaff = profile.role === 'admin' || profile.role === 'master'
  if (pay.payer_id !== profile.id && !isStaff) {
    throw createError({ statusCode: 403, statusMessage: 'Not your payment' })
  }
  if (pay.status === 'verified') return { funded: true, already: true, status: '1' }

  // The payer just came back from a successful page, so expect success — retry
  // a few times to ride out getBillTransactions lag.
  let paid = false
  let last = 'unknown'
  for (let i = 0; i < 4; i++) {
    try {
      const st = await getBillStatus(String(billCode))
      last = st.status
      if (st.paid) { paid = true; break }
      if (st.status === '3') break // definitively failed
    } catch { /* retry */ }
    if (i < 3) await new Promise((r) => setTimeout(r, 2000))
  }
  if (!paid) return { funded: false, status: last }

  const { data: project } = await db.from('projects').select('*').eq('id', pay.project_id).maybeSingle()
  if (!project) return { funded: false, status: last, note: 'project gone' }

  if (project.status === 'approved') {
    const { error: fErr } = await db.rpc('fund_project', {
      p_project: project.id, p_amount: project.budget_myr, p_actor: project.requester_id,
    })
    if (fErr) {
      console.error('[verify-return] fund_project failed', fErr)
      // Leave payment 'claimed' so the webhook/reconcile can still recover it.
      throw createError({ statusCode: 500, statusMessage: 'Payment confirmed but funding failed — it will be applied shortly.' })
    }
    const mins = project.timeline_minutes ?? 2880
    await db.rpc('push_project_live', { p_project: project.id, p_deadline: new Date(Date.now() + mins * 60_000).toISOString() })
    await notify(db, project.requester_id, {
      type: 'payment_received', title: 'Payment received',
      body: `"${project.title}" is funded and now live for providers to apply.`, link: '/projects',
    })
  }
  await db.from('payments').update({ status: 'verified', paid_at: new Date().toISOString() })
    .eq('id', pay.id).eq('status', 'claimed')

  return { funded: true, status: '1' }
})
