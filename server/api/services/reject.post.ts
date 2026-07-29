// POST /api/services/reject   { serviceId, reason }   (Admin)
// Declines a pending service listing, recording the reason.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { serviceId, reason } = await readBody(event)
  if (!serviceId) throw createError({ statusCode: 400, statusMessage: 'serviceId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('services')
    .update({
      status: 'rejected',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: reason || null,
    })
    .eq('id', serviceId)
    .eq('status', 'pending')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { service: data }
})
