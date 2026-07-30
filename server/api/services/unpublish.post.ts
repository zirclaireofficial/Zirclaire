// POST /api/services/unpublish   { serviceId }   (admin or master)
// Reverses a service approval — pulls the listing from the store (status back
// to 'pending'). Existing orders (which are their own projects) are unaffected.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { serviceId } = await readBody(event)
  if (!serviceId) throw createError({ statusCode: 400, statusMessage: 'serviceId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('services')
    .update({ status: 'pending' })
    .eq('id', serviceId)
    .eq('status', 'approved')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, { action: 'service.unpublish', target_type: 'service', target_id: serviceId, summary: `Un-published service "${data.title}"` })
  return { service: data }
})
