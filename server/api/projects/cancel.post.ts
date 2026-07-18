// POST /api/projects/cancel   { projectId, reason }   (Admin)
// Cancels an active project and refunds any held balance atomically.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { projectId, reason } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const db = serviceClient(event)
  const { data, error } = await db.rpc('cancel_project', {
    p_project: projectId,
    p_reason: reason ?? null,
    p_actor: admin.id,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
