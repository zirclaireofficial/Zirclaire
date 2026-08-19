// POST /api/cancellations/appeal  { requestId, reason }   (either party)
// A party appeals the admin's provisional decision within the 48h window →
// escalates to master for a final ruling.
import { serviceClient } from '../../utils/auth'
import { requireApproved } from '../../utils/projects'
import { notifyRoles } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { requestId, reason } = await readBody(event)
  if (!requestId) throw createError({ statusCode: 400, statusMessage: 'requestId is required' })
  const profile = await requireApproved(event)
  const db = serviceClient(event)

  const { data: req } = await db
    .from('cancellation_requests')
    .select('requested_by, provider_id, projects(title)')
    .eq('id', requestId)
    .single()
  if (!req) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  const r = req as unknown as { requested_by: string; provider_id: string | null; projects: { title: string } | null }
  if (profile.id !== r.requested_by && profile.id !== r.provider_id) {
    throw createError({ statusCode: 403, statusMessage: 'Only a party to the project may appeal' })
  }

  const { error } = await db.rpc('appeal_cancellation', {
    p_request: requestId, p_actor: profile.id, p_reason: reason ?? null,
  })
  if (error) {
    const msg = error.message.includes('not open for appeal')
      ? 'The appeal window for this decision has closed.'
      : error.message
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  await notifyRoles(db, ['master'], {
    type: 'cancellation_appeal',
    title: 'Cancellation appealed',
    body: `A cancellation decision on "${r.projects?.title ?? 'a project'}" was appealed and needs a final ruling.`,
    link: '/admin/cancellations',
  })
  return { ok: true }
})
