// POST /api/royalties/purchase   { itemId, method }   (approved buyer)
// Records the sale and the 15/85 split atomically via purchase_royalty().
// Simulated payment: we generate a reference, no real charge — same shape as
// the project funding simulation.

import { serviceClient, getCallerProfile } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  if (profile.kyc_status !== 'approved') {
    throw createError({ statusCode: 403, statusMessage: 'Account not approved' })
  }

  const { itemId, method } = await readBody(event)
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'itemId is required' })
  if (method !== 'binance' && method !== 'touch_n_go') {
    throw createError({ statusCode: 400, statusMessage: 'invalid payment method' })
  }

  const prefix = method === 'binance' ? 'BNB-' : 'TNG-'
  const reference = prefix + Math.random().toString(36).slice(2, 8).toUpperCase()

  const db = serviceClient(event)
  const { data, error } = await db.rpc('purchase_royalty', {
    p_item: itemId,
    p_buyer: profile.id,
    p_reference: reference,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  return { purchase: { id: (data as { id: string }).id, reference } }
})
