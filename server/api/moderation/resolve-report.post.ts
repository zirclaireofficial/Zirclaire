// POST /api/moderation/resolve-report   { reportId, status }   (Admin)
// Marks a report as reviewed / actioned / dismissed and stamps who resolved it.
// (Removing the offending content is a separate explicit action — remove-post
// or remove-comment.)

import { serviceClient, requireAdmin } from '../../utils/auth'

const ALLOWED = ['reviewed', 'actioned', 'dismissed'] as const

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { reportId, status } = await readBody(event)
  if (!reportId) throw createError({ statusCode: 400, statusMessage: 'reportId is required' })
  if (!ALLOWED.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: `status must be one of ${ALLOWED.join(', ')}` })
  }

  const db = serviceClient(event)
  const { data, error } = await db
    .from('reports')
    .update({ status, resolved_by: admin.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId)
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { report: data }
})
