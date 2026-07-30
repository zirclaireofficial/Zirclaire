// POST /api/services/approve   { serviceId }   (Admin)
// Publishes a pending service listing — makes it appear in service_store.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { serviceId } = await readBody(event)
  if (!serviceId) throw createError({ statusCode: 400, statusMessage: 'serviceId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('services')
    .update({ status: 'approved', reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq('id', serviceId)
    .eq('status', 'pending')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, {
    action: 'service.approve',
    target_type: 'service',
    target_id: serviceId,
    summary: `Published service "${data.title}"`,
  })
  return { service: data }
})
