// POST /api/services/approve   { serviceId }   (Admin)
// Publishes a pending service listing — makes it appear in service_store.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { serviceId } = await readBody(event)
  if (!serviceId) throw createError({ statusCode: 400, statusMessage: 'serviceId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('services')
    .update({ status: 'approved', reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq('id', serviceId)
    .eq('status', 'pending')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { service: data }
})
