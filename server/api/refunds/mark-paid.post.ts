// POST /api/refunds/mark-paid   { refundId, reference, proofUrl }   (MASTER)
// The Master has refunded the requester by hand and uploaded proof. Records it.
// Proof MANDATORY. Atomic: only a pending refund flips to paid.
import { serviceClient, requireMaster } from '../../utils/auth'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { refundId, reference, proofUrl } = await readBody(event)
  if (!refundId) throw createError({ statusCode: 400, statusMessage: 'refundId is required' })
  if (!proofUrl) throw createError({ statusCode: 400, statusMessage: 'Proof of payment is required' })
  await requireMaster(event)
  const db = serviceClient(event)

  const { data, error } = await db
    .from('refunds')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      manual_reference: reference?.trim() || null,
      proof_url: proofUrl,
      proof_uploaded_at: new Date().toISOString(),
    })
    .eq('id', refundId)
    .eq('status', 'pending')
    .select('id, requester_id, amount_myr, project_id, projects(title)')
    .maybeSingle()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 409, statusMessage: 'This refund was already handled.' })

  const row = data as unknown as { requester_id: string; projects: { title: string } | null }
  await notify(db, row.requester_id, {
    type: 'refund_paid',
    title: 'Refund sent',
    body: `Your refund for "${row.projects?.title ?? 'a project'}" has been sent.`,
    link: '/projects',
  })
  return { ok: true }
})
