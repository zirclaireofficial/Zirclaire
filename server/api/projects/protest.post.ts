// POST /api/projects/protest   { projectId, reason }   (SR, owns project)
// The requester disputes a "marked complete" project. Reuses the dispute path
// as a cancellation_request of kind='protest' (straight into arbitration), so
// admin/master resolve it exactly like a cancellation. Denied -> project
// completes (provider paid); approved -> refund path.
import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'
import { notify, notifyRoles } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { projectId, reason } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  if (!reason || !String(reason).trim()) throw createError({ statusCode: 400, statusMessage: 'A reason is required' })
  const { project } = await requireProjectOwner(event, projectId)
  const db = serviceClient(event)

  const { error } = await db.rpc('create_protest', { p_project: projectId, p_actor: project.requester_id, p_reason: reason })
  if (error) {
    const msg = error.message.includes('uq_cancel_open_per_project')
      ? 'There is already an open issue on this project.'
      : error.message
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  if (project.awarded_provider_id) {
    await notify(db, project.awarded_provider_id, {
      type: 'protest_raised',
      title: 'Completion disputed',
      body: `The requester raised an issue on "${project.title}". Zirclaire is reviewing it.`,
      link: '/projects',
    })
  }
  await notifyRoles(db, ['admin', 'master'], {
    type: 'protest_review',
    title: 'Completion protest',
    body: `A completion on "${project.title}" was disputed and needs review.`,
    link: '/admin/cancellations',
  })
  return { ok: true }
})
