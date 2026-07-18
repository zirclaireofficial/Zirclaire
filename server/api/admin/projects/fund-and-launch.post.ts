// POST /api/admin/projects/fund-and-launch   { projectId }   (Admin)
// The admin verifies the SR's payment, funds escrow, and pushes the project
// live — the whole "money secured → goes to the feed" step in one action.

import { serviceClient, requireAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const db = serviceClient(event)

  const { data: project } = await db.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  if (project.status !== 'submitted') {
    throw createError({ statusCode: 400, statusMessage: `Project is ${project.status}, not awaiting funding` })
  }

  // Mark the latest claimed payment as verified (if any).
  const { data: pay } = await db
    .from('payments')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'claimed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (pay) {
    await db
      .from('payments')
      .update({ status: 'verified', verified_by: admin.id, verified_at: new Date().toISOString() })
      .eq('id', pay.id)
  }

  // Fund escrow (submitted → funded, + fund ledger entry).
  const { error: fundErr } = await db.rpc('fund_project', {
    p_project: projectId,
    p_amount: project.budget_usd,
    p_actor: admin.id,
  })
  if (fundErr) throw createError({ statusCode: 400, statusMessage: fundErr.message })

  // Push live (funded → live), deadline from the project's timeline.
  const mins = project.timeline_minutes ?? 2880 // default 48h
  const deadline = new Date(Date.now() + mins * 60_000).toISOString()
  const { data, error: liveErr } = await db.rpc('push_project_live', {
    p_project: projectId,
    p_deadline: deadline,
  })
  if (liveErr) throw createError({ statusCode: 400, statusMessage: liveErr.message })

  return { project: data }
})
