// POST /api/projects/award   { projectId, applicationId }   (SR, owns project)
// Awards the job to a chosen applicant (atomic: project → awarded, chosen
// application → approved, the rest → rejected).

import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'

export default defineEventHandler(async (event) => {
  const { projectId, applicationId } = await readBody(event)
  if (!projectId || !applicationId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId and applicationId are required' })
  }
  await requireProjectOwner(event, projectId)

  const db = serviceClient(event)
  const { data, error } = await db.rpc('award_applicant', {
    p_project: projectId,
    p_application: applicationId,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
