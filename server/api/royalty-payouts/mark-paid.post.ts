// POST /api/royalty-payouts/mark-paid   { payoutId, reference, proofUrl }  (staff)
// Manual royalty payout to the owner (15%). Admin pays by hand, uploads proof
// (mandatory), records it here. Atomic pending -> paid; owner is notified.
import { serviceClient, requireStaff } from '../../utils/auth'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { payoutId, reference, proofUrl } = await readBody(event)
  if (!payoutId) throw createError({ statusCode: 400, statusMessage: 'payoutId is required' })
  if (!proofUrl) throw createError({ statusCode: 400, statusMessage: 'Proof of payment is required' })
  await requireStaff(event)
  const db = serviceClient(event)

  const { data, error } = await db
    .from('royalty_payouts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      manual_reference: reference?.trim() || null,
      proof_url: proofUrl,
      proof_uploaded_at: new Date().toISOString(),
    })
    .eq('id', payoutId)
    .eq('status', 'pending')
    .select('id, owner_id, amount_myr')
    .maybeSingle()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 409, statusMessage: 'This payout was already handled.' })

  const row = data as unknown as { owner_id: string; amount_myr: number }
  await notify(db, row.owner_id, {
    type: 'royalty_paid',
    title: 'Royalty paid',
    body: `Your royalty payout of RM ${row.amount_myr} has been sent.`,
    link: '/royalties',
  })
  return { ok: true }
})
