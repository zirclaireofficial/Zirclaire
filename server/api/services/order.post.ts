// POST /api/services/order   { tierId }   (approved buyer)
// Orders a service tier: creates a pre-awarded, pre-funded project via
// order_service(), which drops it into the existing escrow/deliver/review loop.
// Simulated payment — the escrow 'fund' entry is written by the function; there
// is no separate charge.

import { serviceClient, getCallerProfile } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  if (profile.kyc_status !== 'approved') {
    throw createError({ statusCode: 403, statusMessage: 'Account not approved' })
  }

  const { tierId } = await readBody(event)
  if (!tierId) throw createError({ statusCode: 400, statusMessage: 'tierId is required' })

  const db = serviceClient(event)
  const { data, error } = await db.rpc('order_service', {
    p_tier: tierId,
    p_buyer: profile.id,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  return { project: data }
})
