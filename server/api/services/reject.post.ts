// POST /api/services/reject   { serviceId, reason }   (Admin)
// Declines a pending service listing, recording the reason.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { serviceId, reason } = await readBody(event)
  if (!serviceId) throw createError({ statusCode: 400, statusMessage: 'serviceId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('services')
    .update({
      status: 'rejected',
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: reason || null,
    })
    .eq('id', serviceId)
    .eq('status', 'pending')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, {
    action: 'service.reject',
    target_type: 'service',
    target_id: serviceId,
    summary: `Rejected service "${data.title}"${reason ? ` — ${reason}` : ''}`,
  })
  return { service: data }
})
