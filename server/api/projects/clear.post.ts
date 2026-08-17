// POST /api/projects/clear   { projectId }   (Admin)
// finished → closed. Writes the commission (20%) and payout (80%) ledger
// entries atomically. This is the point at which the SP's payout is released.

import { serviceClient, requireAdmin } from '../../utils/auth'
import { isXendit, payoutChannel } from '../../utils/payments'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const db = serviceClient(event)
  const { data, error } = await db.rpc('clear_project', {
    p_project: projectId,
    p_actor: admin.id,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  // Phase 2 — schedule the provider's payout (80%) with a 24h buffer.
  // The UNIQUE(project_id) constraint means a repeated clear can't create a
  // second payout (the insert error is ignored on purpose = double-pay guard).
  if (isXendit() && data?.awarded_provider_id && data?.funded_amount_usd) {
    const amount = Math.round(Number(data.funded_amount_usd) * 0.8 * 100) / 100
    const { data: prov } = await db
      .from('profiles')
      .select('full_name, payout_account, payout_provider')
      .eq('id', data.awarded_provider_id)
      .maybeSingle()
    // 24h buffer by default; set PAYOUT_BUFFER_HOURS=0 to release immediately
    // (useful for demos so you don't have to wait a day to test payouts).
    const bufferHours = Number(process.env.PAYOUT_BUFFER_HOURS ?? 24)
    const releaseAt = new Date(Date.now() + bufferHours * 60 * 60 * 1000).toISOString()
    await db.from('payouts').insert({
      project_id: data.id,
      provider_id: data.awarded_provider_id,
      amount_myr: amount,
      channel_code: payoutChannel(prov?.payout_provider),
      account_number: prov?.payout_account ?? null,
      account_holder: prov?.full_name ?? null,
      status: 'pending',
      release_at: releaseAt,
    })
  }

  return { project: data }
})
