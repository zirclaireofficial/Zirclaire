// POST /api/payments/verify-return   { billCode }   (the payer, on return)
// Called when the gateway redirects the payer back. Re-verifies the bill and
// funds the project immediately if paid — so funding never has to wait for the
// (laggy) server callback or the nightly reconcile. Idempotent + atomic.
import { serviceClient, getCallerProfile } from '../../utils/auth'
import { getGatewayBillStatus } from '../../utils/gateway'
import { fundPaidProject } from '../../utils/funding'

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

  // The payer just came back from a successful page — re-verify, retrying a few
  // times to ride out any brief settlement lag.
  let paid = false
  let last = 'unknown'
  for (let i = 0; i < 4; i++) {
    try {
      const st = await getGatewayBillStatus(String(billCode))
      last = st.status
      if (st.paid) { paid = true; break }
      if (st.status === '3') break // definitively failed
    } catch { /* retry */ }
    if (i < 3) await new Promise((r) => setTimeout(r, 2000))
  }
  if (!paid) return { funded: false, status: last }

  await fundPaidProject(db, pay.project_id, pay.id)
  return { funded: true, status: '1' }
})
