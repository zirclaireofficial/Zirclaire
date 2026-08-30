// POST /api/projects/accept  { projectId }  (requester)
// The requester's deliberate confirmation that the work is done. Accepts the
// submission (-> finished) and clears the project (-> closed + provider payout).
// This is the one path that releases the money; a dispute is separate.
import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'
import { notify, notifyRoles } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  const { profile, project } = await requireProjectOwner(event, projectId)
  const db = serviceClient(event)

  // Don't accept (and release money) while a cancellation/protest is open.
  const { count: open } = await db
    .from('cancellation_requests').select('id', { count: 'exact', head: true })
    .eq('project_id', projectId).in('status', ['pending_provider', 'in_arbitration', 'awaiting_appeal', 'appealed'])
  if ((open ?? 0) > 0) {
    throw createError({ statusCode: 400, statusMessage: 'There is an open dispute on this project — resolve it before accepting.' })
  }

  const { error: aErr } = await db.rpc('accept_work', { p_project: projectId, p_reviewer: profile.id })
  if (aErr) throw createError({ statusCode: 400, statusMessage: aErr.message })

  const { error: cErr } = await db.rpc('clear_project', { p_project: projectId, p_actor: profile.id })
  if (cErr) {
    // Accepted but not yet cleared (e.g. an open cancellation). Surface it; the
    // project is 'finished' and a retry/clear will finish the money side.
    throw createError({ statusCode: 400, statusMessage: `Accepted, but could not release payment yet: ${cErr.message}` })
  }

  if (project.awarded_provider_id) {
    await notify(db, project.awarded_provider_id, {
      type: 'work_accepted',
      title: 'Work accepted',
      body: `The requester accepted "${project.title}". Your payout is being prepared.`,
      link: '/projects',
    })
  }
  await notifyRoles(db, ['master'], {
    type: 'payout_due',
    title: 'Payout due',
    body: `"${project.title}" was accepted — a provider payout is ready to send.`,
    link: '/master/payouts',
  })
  return { ok: true }
})
