// POST /api/projects/approve   { projectId }   (Admin)
// submitted -> approved. The requester is notified and can then pay. No money
// moves here — approval just unlocks payment (approve-before-pay).
import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const admin = await requireStaff(event)
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const db = serviceClient(event)
  const { data: project } = await db.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  if (project.status !== 'submitted') {
    throw createError({ statusCode: 400, statusMessage: `Project is ${project.status}, not awaiting approval` })
  }

  const { data, error } = await db.rpc('approve_project', { p_project: projectId, p_actor: admin.id })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  await notify(db, project.requester_id, {
    type: 'project_approved',
    title: 'Project approved',
    body: `"${project.title}" is approved — pay now to make it live.`,
    link: '/projects',
  })
  await logAction(event, admin, {
    action: 'project.approve',
    target_type: 'project',
    target_id: projectId,
    summary: `Approved "${project.title}"`,
  })

  return { project: data }
})
