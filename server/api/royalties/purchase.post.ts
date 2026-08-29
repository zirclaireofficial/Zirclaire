// POST /api/royalties/purchase   { itemId, returnUrl? }   (approved buyer)
// Simulator mode: completes the sale instantly (no charge).
// Gateway mode:   creates a ToyyibPay bill and returns a pay URL; the sale is
//                 finalized only when the webhook confirms payment.
import { serviceClient, getCallerProfile } from '../../utils/auth'
import { paymentMode, isGatewayMode } from '../../utils/payments'
import { createBill, getBillStatus, billPayUrl } from '../../utils/toyyibpay'
import { completeRoyaltyPurchase } from '../../utils/royalty'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  if (profile.kyc_status !== 'approved') {
    throw createError({ statusCode: 403, statusMessage: 'Account not approved' })
  }
  const { itemId, returnUrl } = await readBody(event)
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'itemId is required' })

  const db = serviceClient(event)
  const { data: item } = await db
    .from('royalty_items').select('id, price_myr, status, creator_id, title').eq('id', itemId).maybeSingle()
  if (!item || item.status !== 'approved') {
    throw createError({ statusCode: 400, statusMessage: 'This work is not available for purchase' })
  }
  if (item.creator_id === profile.id) {
    throw createError({ statusCode: 400, statusMessage: 'You can\'t buy your own work' })
  }
  const { count: owned } = await db
    .from('royalty_purchases').select('id', { count: 'exact', head: true })
    .eq('item_id', itemId).eq('buyer_id', profile.id)
  if (owned) throw createError({ statusCode: 400, statusMessage: 'You already own this work' })

  // ---- Simulator: instant, no charge ----
  if (!isGatewayMode()) {
    const reference = 'SIM-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    const pur = await completeRoyaltyPurchase(db, itemId, profile.id, reference)
    return { mode: 'simulator' as const, purchase: { id: pur.id, reference }, funded: true }
  }

  // ---- Gateway: reuse an open bill (idempotency), else create one ----
  const { data: open } = await db
    .from('royalty_payments').select('toyyibpay_billcode')
    .eq('item_id', itemId).eq('buyer_id', profile.id).eq('status', 'pending')
    .not('toyyibpay_billcode', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (open?.toyyibpay_billcode) {
    const st = await getBillStatus(open.toyyibpay_billcode).catch(() => null)
    if (st && !st.paid && st.status !== '3') {
      return { mode: paymentMode(), invoiceUrl: billPayUrl(open.toyyibpay_billcode), reused: true }
    }
  }

  const origin = getRequestURL(event).origin
  const ref = `zc-roy-${itemId}-${Date.now()}`
  const bill = await createBill({
    name: 'Zirclaire Work',
    description: `Buy ${String(item.title).slice(0, 55)}`,
    amountMYR: Number(item.price_myr),
    externalRef: ref,
    returnUrl: typeof returnUrl === 'string' ? returnUrl : `${origin}/royalties`,
    callbackUrl: `${origin}/api/webhooks/toyyibpay`,
    payerName: profile.full_name,
    payerEmail: profile.email,
    payerPhone: profile.phone,
  })
  await db.from('royalty_payments').insert({
    item_id: itemId, buyer_id: profile.id, amount_myr: item.price_myr,
    toyyibpay_billcode: bill.billCode, reference: ref, status: 'pending',
  })
  return { mode: paymentMode(), invoiceUrl: bill.payUrl }
})
