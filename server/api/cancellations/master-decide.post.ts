// POST /api/cancellations/master-decide  { requestId, decision, reason }  (master)
// Master's ruling on an appeal — final and binding. Executes the refund
// immediately if approved.
import { serviceClient, requireMaster } from '../../utils/auth'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { requestId, decision, reason } = await readBody(event)
  if (!requestId || !['approved', 'denied'].includes(decision)) {
    throw createError({ statusCode: 400, statusMessage: 'requestId and a valid decision are required' })
  }
  const master = await requireMaster(event)
  const db = serviceClient(event)

  const { data: req } = await db
    .from('cancellation_requests')
    .select('requested_by, provider_id, projects(title)')
    .eq('id', requestId)
    .single()
  if (!req) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  const r = req as unknown as { requested_by: string; provider_id: string | null; projects: { title: string } | null }
  const title = r.projects?.title ?? 'the project'

  const { error } = await db.rpc('master_decide_cancellation', {
    p_request: requestId, p_master: master.id, p_decision: decision, p_reason: reason ?? null,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  const approved = decision === 'approved'
  await notify(db, r.requested_by, {
    type: 'cancellation_resolved',
    title: approved ? 'Cancellation approved' : 'Cancellation declined',
    body: approved
      ? `Your appeal succeeded — "${title}" is cancelled and 95% has been refunded.`
      : `After final review, the cancellation of "${title}" was declined; the project continues.`,
    link: '/projects',
  })
  if (r.provider_id) {
    await notify(db, r.provider_id, {
      type: 'cancellation_resolved',
      title: approved ? 'Project cancelled' : 'Project continues',
      body: approved
        ? `After final review, "${title}" has been cancelled.`
        : `After final review, the cancellation of "${title}" was declined; please continue the work.`,
      link: '/projects',
    })
  }
  return { ok: true }
})
