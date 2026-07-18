// POST /api/projects/accept   { projectId }   (SR, owns project)
// Moves in_review → finished (SR accepts the work) and records a review row.
// The admin then clears payment via /api/projects/clear.

import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'

export default defineEventHandler(async (event) => {
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  const { profile } = await requireProjectOwner(event, projectId)

  const db = serviceClient(event)
  const { data, error } = await db.rpc('accept_work', {
    p_project: projectId,
    p_reviewer: profile.id,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
