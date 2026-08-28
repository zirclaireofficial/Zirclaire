// POST /api/projects/confirm-complete   { projectId }   (SR, owns project)
// The requester accepts the completed work now (skips the 48h wait). Closes the
// project, writes the 20/80 ledger, and creates the manual payout row → master
// is notified to pay the provider.
import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'
import { notify, notifyRoles } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  const { project } = await requireProjectOwner(event, projectId)
  const db = serviceClient(event)

  const { error } = await db.rpc('complete_project', { p_project: projectId, p_actor: project.requester_id })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  if (project.awarded_provider_id) {
    await notify(db, project.awarded_provider_id, {
      type: 'work_accepted',
      title: 'Work accepted',
      body: `"${project.title}" was accepted. Your payment is being processed.`,
      link: '/projects',
    })
  }
  await notifyRoles(db, ['master'], {
    type: 'payout_due',
    title: 'Payout due',
    body: `"${project.title}" is complete — a provider payout is ready to send.`,
    link: '/master/payouts',
  })
  return { ok: true }
})
