// POST /api/cancellations/respond  { requestId, accept }   (awarded provider)
// Provider accepts (mutual → refund now) or rejects (→ Platform arbitration).
import { serviceClient } from '../../utils/auth'
import { requireApproved } from '../../utils/projects'
import { notify, notifyRoles } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { requestId, accept } = await readBody(event)
  if (!requestId || typeof accept !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'requestId and accept are required' })
  }
  const profile = await requireApproved(event)
  const db = serviceClient(event)

  const { data: req } = await db
    .from('cancellation_requests')
    .select('id, provider_id, requested_by, projects(title)')
    .eq('id', requestId)
    .single()
  if (!req) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  const r = req as unknown as { provider_id: string; requested_by: string; projects: { title: string } | null }
  if (r.provider_id !== profile.id) {
    throw createError({ statusCode: 403, statusMessage: 'Not the awarded provider' })
  }
  const title = r.projects?.title ?? 'the project'

  const { error } = await db.rpc('provider_respond_cancellation', {
    p_request: requestId, p_provider: profile.id, p_accept: accept,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  if (accept) {
    await notify(db, r.requested_by, {
      type: 'cancellation_resolved',
      title: 'Cancellation approved',
      body: `The provider agreed to cancel "${title}". 95% has been refunded to you.`,
      link: '/projects',
    })
  } else {
    await notify(db, r.requested_by, {
      type: 'cancellation_update',
      title: 'Cancellation under review',
      body: `Zirclaire is reviewing your request to cancel "${title}".`,
      link: '/projects',
    })
    await notifyRoles(db, ['admin', 'master'], {
      type: 'cancellation_arbitration',
      title: 'Cancellation needs review',
      body: `A cancellation on "${title}" was contested and needs arbitration.`,
      link: '/admin/cancellations',
    })
  }
  return { ok: true }
})
