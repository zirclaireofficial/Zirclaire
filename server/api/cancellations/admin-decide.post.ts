// POST /api/cancellations/admin-decide  { requestId, decision, reason }  (staff)
// Admin rules on a contested cancellation (approved = <50%/eligible, denied =
// substantially complete). Provisional: opens a 48h appeal window for either
// party. No money moves yet — the nightly finalizer or a master appeal does it.
import { serviceClient } from '../../utils/auth'
import { requireStaff } from '../../utils/auth'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { requestId, decision, reason } = await readBody(event)
  if (!requestId || !['approved', 'denied'].includes(decision)) {
    throw createError({ statusCode: 400, statusMessage: 'requestId and a valid decision are required' })
  }
  const staff = await requireStaff(event)
  const db = serviceClient(event)

  const { data: req } = await db
    .from('cancellation_requests')
    .select('requested_by, provider_id, projects(title)')
    .eq('id', requestId)
    .single()
  if (!req) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  const r = req as unknown as { requested_by: string; provider_id: string | null; projects: { title: string } | null }
  const title = r.projects?.title ?? 'the project'

  const { error } = await db.rpc('admin_decide_cancellation', {
    p_request: requestId, p_admin: staff.id, p_decision: decision, p_reason: reason ?? null,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  const approved = decision === 'approved'
  const line = approved
    ? `Zirclaire approved the cancellation of "${title}". It will finalize in 48 hours unless appealed.`
    : `Zirclaire declined the cancellation of "${title}". The project continues. You have 48 hours to appeal.`
  await notify(db, r.requested_by, {
    type: 'cancellation_decision', title: 'Cancellation decision', body: line, link: '/projects',
  })
  if (r.provider_id) {
    await notify(db, r.provider_id, {
      type: 'cancellation_decision', title: 'Cancellation decision',
      body: approved
        ? `Zirclaire approved cancelling "${title}". It finalizes in 48 hours unless appealed.`
        : `Zirclaire declined the cancellation of "${title}"; please continue. Either party may appeal within 48 hours.`,
      link: '/projects',
    })
  }
  return { ok: true }
})
