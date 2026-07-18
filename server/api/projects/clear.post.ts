// POST /api/projects/clear   { projectId }   (Admin)
// finished → closed. Writes the commission (20%) and payout (80%) ledger
// entries atomically. This is the point at which the SP's payout is released.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const db = serviceClient(event)
  const { data, error } = await db.rpc('clear_project', {
    p_project: projectId,
    p_actor: admin.id,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
