// POST /api/projects/open-review   { projectId }   (SR, owns project)
// Moves submitted_work → in_review.

import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'

export default defineEventHandler(async (event) => {
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  await requireProjectOwner(event, projectId)

  const db = serviceClient(event)
  const { data, error } = await db.rpc('open_review', { p_project: projectId })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
