// POST /api/services/order   { tierId }   (approved buyer)
// Simulator mode: creates a pre-funded project instantly (fake money).
// Gateway mode:   creates the order UNFUNDED, then a ToyyibPay bill, and returns
//                 a pay URL. The order only funds/starts once payment confirms
//                 (webhook / return handler) — the buyer pays FIRST.
import { serviceClient, getCallerProfile } from '../../utils/auth'
import { isGatewayMode, paymentMode } from '../../utils/payments'
import { createBill } from '../../utils/toyyibpay'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  if (profile.kyc_status !== 'approved') {
    throw createError({ statusCode: 403, statusMessage: 'Account not approved' })
  }
  const { tierId, returnUrl } = await readBody(event)
  if (!tierId) throw createError({ statusCode: 400, statusMessage: 'tierId is required' })

  const db = serviceClient(event)

  // ---- Simulator: instant, pre-funded (no charge) ----
  if (!isGatewayMode()) {
    const { data, error } = await db.rpc('order_service', { p_tier: tierId, p_buyer: profile.id })
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    return { mode: 'simulator' as const, project: data }
  }

  // ---- Gateway: create the order UNFUNDED, then a bill; funding waits for pay ----
  const { data: project, error: pErr } = await db.rpc('order_service_pending', { p_tier: tierId, p_buyer: profile.id })
  if (pErr) throw createError({ statusCode: 400, statusMessage: pErr.message })

  const origin = getRequestURL(event).origin
  const amount = Number(project.budget_myr)
  const ref = `zc-svc-${project.id}-${Date.now()}`
  const bill = await createBill({
    name: 'Zirclaire Service',
    description: `Order ${String(project.title).slice(0, 55)}`,
    amountMYR: amount,
    externalRef: ref,
    returnUrl: `${origin}/payment/return`,
    callbackUrl: `${origin}/api/webhooks/toyyibpay`,
    payerName: profile.full_name,
    payerEmail: profile.email,
    payerPhone: profile.phone,
  })

  await db.from('payments').insert({
    project_id: project.id,
    payer_id: profile.id,
    amount_myr: amount,
    reference: ref,
    toyyibpay_billcode: bill.billCode,
    status: 'claimed', // becomes 'verified' when the callback is verified
  })

  return { mode: paymentMode(), invoiceUrl: bill.payUrl, projectId: project.id }
})
