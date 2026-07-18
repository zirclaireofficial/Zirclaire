// POST /api/projects/request-revision   { projectId, reason }   (SR, owns project)
// Moves in_review → revision_requested and records a review row.

import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'

export default defineEventHandler(async (event) => {
  const { projectId, reason } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  const { profile } = await requireProjectOwner(event, projectId)

  const db = serviceClient(event)
  const { data, error } = await db.rpc('request_revision', {
    p_project: projectId,
    p_reviewer: profile.id,
    p_reason: reason ?? null,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
