// POST /api/moderation/resolve-report   { reportId, status }   (Admin)
// Marks a report as reviewed / actioned / dismissed and stamps who resolved it.
// (Removing the offending content is a separate explicit action — remove-post
// or remove-comment.)

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

const ALLOWED = ['reviewed', 'actioned', 'dismissed'] as const

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { reportId, status } = await readBody(event)
  if (!reportId) throw createError({ statusCode: 400, statusMessage: 'reportId is required' })
  if (!ALLOWED.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: `status must be one of ${ALLOWED.join(', ')}` })
  }

  const db = serviceClient(event)
  const { data, error } = await db
    .from('reports')
    .update({ status, resolved_by: actor.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId)
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, { action: 'report.resolve', target_type: 'report', target_id: reportId, summary: `Report ${status}` })
  return { report: data }
})
