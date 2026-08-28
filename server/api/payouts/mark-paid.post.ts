// POST /api/payouts/mark-paid   { payoutId, reference, proofUrl }   (MASTER)
// Manual provider payout: after master has transferred the money by hand and
// uploaded proof of payment, they record it here. Proof is MANDATORY. Atomic:
// only a pending payout flips to paid, so it can't be double-marked.
import { serviceClient, requireMaster } from '../../utils/auth'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { payoutId, reference, proofUrl } = await readBody(event)
  if (!payoutId) throw createError({ statusCode: 400, statusMessage: 'payoutId is required' })
  if (!proofUrl) throw createError({ statusCode: 400, statusMessage: 'Proof of payment is required' })
  await requireMaster(event)
  const db = serviceClient(event)

  const { data, error } = await db
    .from('payouts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      manual_reference: reference?.trim() || null,
      proof_url: proofUrl,
      proof_uploaded_at: new Date().toISOString(),
    })
    .eq('id', payoutId)
    .eq('status', 'pending')            // only from pending — one winner
    .select('id, provider_id, amount_myr, project_id, projects(title)')
    .maybeSingle()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  if (!data) {
    throw createError({ statusCode: 409, statusMessage: 'This payout was already handled.' })
  }

  const row = data as unknown as { provider_id: string; amount_myr: number; projects: { title: string } | null }
  await notify(db, row.provider_id, {
    type: 'payout_paid',
    title: 'Payment sent',
    body: `Your payout for "${row.projects?.title ?? 'a project'}" has been sent.`,
    link: '/projects',
  })
  return { ok: true }
})
