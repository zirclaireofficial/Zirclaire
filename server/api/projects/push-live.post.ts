// POST /api/projects/push-live   { projectId, deadline? }   (Admin)
// funded → live. If no explicit deadline is given, it is computed from the
// project's timeline_minutes (starting now).

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { projectId, deadline } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const db = serviceClient(event)

  let dl = deadline
  if (!dl) {
    const { data: proj } = await db
      .from('projects')
      .select('timeline_minutes')
      .eq('id', projectId)
      .single()
    const mins = proj?.timeline_minutes ?? 0
    dl = new Date(Date.now() + mins * 60_000).toISOString()
  }

  const { data, error } = await db.rpc('push_project_live', {
    p_project: projectId,
    p_deadline: dl,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
