// POST /api/projects/mark-complete   { projectId }   (awarded provider)
// The provider declares the work done. Starts the 48h window during which the
// requester can confirm early or protest; otherwise the nightly sweep completes
// it. A deliverable must already be uploaded.
import { serviceClient } from '../../utils/auth'
import { requireAwardedProvider } from '../../utils/projects'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  const { project } = await requireAwardedProvider(event, projectId)
  const db = serviceClient(event)

  if (!['in_progress', 'submitted_work', 'revision_requested'].includes(project.status)) {
    throw createError({ statusCode: 400, statusMessage: 'This project can\'t be marked complete from its current state' })
  }
  const { count } = await db
    .from('deliverables').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
  if (!count) {
    throw createError({ statusCode: 400, statusMessage: 'Upload your deliverable before marking the project complete' })
  }

  await db
    .from('projects')
    .update({ status: 'submitted_work', completion_marked_at: new Date().toISOString() })
    .eq('id', projectId)

  await notify(db, project.requester_id, {
    type: 'completion_marked',
    title: 'Work marked complete',
    body: `The provider marked "${project.title}" complete. You have 48 hours to confirm or raise an issue — otherwise it completes automatically.`,
    link: '/projects',
  })
  return { ok: true }
})
