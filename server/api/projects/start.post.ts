// POST /api/projects/start   { projectId }   (SP, awarded provider)
// Moves awarded → in_progress.

import { serviceClient } from '../../utils/auth'
import { requireAwardedProvider } from '../../utils/projects'

export default defineEventHandler(async (event) => {
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  const { profile } = await requireAwardedProvider(event, projectId)

  const db = serviceClient(event)
  const { data, error } = await db.rpc('start_work', {
    p_project: projectId,
    p_provider: profile.id,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
