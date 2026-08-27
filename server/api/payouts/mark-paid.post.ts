// POST /api/payouts/mark-paid   { payoutId, reference }   (staff)
// Manual-payout model: after the admin has transferred the money by hand
// (Touch 'n Go / bank), they record it here. Atomic: only a pending payout
// flips to paid, so two admins can't double-mark.
import { serviceClient, requireStaff } from '../../utils/auth'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { payoutId, reference } = await readBody(event)
  if (!payoutId) throw createError({ statusCode: 400, statusMessage: 'payoutId is required' })
  const staff = await requireStaff(event)
  const db = serviceClient(event)

  const { data, error } = await db
    .from('payouts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      manual_reference: reference?.trim() || null,
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
