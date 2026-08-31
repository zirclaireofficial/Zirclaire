// POST /api/cancellations/request  { projectId, reason }   (SR, owns project)
// If the project has no awarded provider yet, it's just a withdrawal — refund
// directly (95%). If a provider is on it, open the consent + arbitration flow.
import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'
import { notify, notifyRoles } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { projectId, reason } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  if (!reason || !String(reason).trim()) {
    throw createError({ statusCode: 400, statusMessage: 'A reason is required' })
  }
  const { profile, project } = await requireProjectOwner(event, projectId)
  const db = serviceClient(event)

  // No provider yet → straightforward refund, no arbitration needed.
  if (!project.awarded_provider_id) {
    const { error } = await db.rpc('cancel_project', {
      p_project: projectId, p_reason: reason, p_actor: profile.id,
    })
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    await notifyRoles(db, ['master'], {
      type: 'refund_due', title: 'Refund due',
      body: `"${project.title}" was withdrawn — a 95% refund to the requester is ready to send.`,
      link: '/master/refunds',
    })
    return { direct: true }
  }

  // Provider on the job → consent flow.
  const { data, error } = await db.rpc('create_cancellation_request', {
    p_project: projectId, p_actor: profile.id, p_reason: reason,
  })
  if (error) {
    const msg = error.message.includes('48 hours')
      ? 'Cancellation isn\'t allowed within 48 hours of the deadline.'
      : error.message.includes('uq_cancel_open_per_project')
        ? 'A cancellation request is already open for this project.'
        : error.message
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  await notify(db, project.awarded_provider_id, {
    type: 'cancellation_requested',
    title: 'Cancellation requested',
    body: `The requester has asked to cancel "${project.title}". Please review and respond.`,
    link: '/projects',
  })
  return { request: data }
})
