// GET /api/cron/release-payouts   (called by Vercel Cron on a schedule)
// Releases payouts whose 24h buffer has elapsed. Safe against double-payouts:
//   - only 'pending' rows past release_at are picked
//   - each is atomically flipped pending -> processing (one winner)
//   - the Xendit call carries an idempotency key (the payout id), so a retry
//     never sends money twice
//   - the final paid/failed comes from the webhook
// Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the
// CRON_SECRET env var is set. We require it.
import { serviceClient } from '../../utils/auth'
import { isXendit } from '../../utils/payments'
import { createPayout } from '../../utils/xendit'

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, 'authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!isXendit()) return { skipped: 'simulator mode' }

  const db = serviceClient(event)
  const nowIso = new Date().toISOString()

  const { data: due } = await db
    .from('payouts')
    .select('*')
    .eq('status', 'pending')
    .lte('release_at', nowIso)
    .limit(50)

  const results: Array<Record<string, unknown>> = []

  for (const p of due ?? []) {
    // Atomic claim — flip pending -> processing. Only the winner continues.
    const { data: claimed } = await db
      .from('payouts')
      .update({ status: 'processing', processing_at: nowIso })
      .eq('id', p.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle()
    if (!claimed) continue

    try {
      const payout = await createPayout({
        referenceId: `zc-payout-${p.id}`,
        channelCode: p.channel_code,
        accountHolder: p.account_holder ?? 'Zirclaire Provider',
        accountNumber: p.account_number ?? '',
        amount: Number(p.amount_myr),
        description: `Zirclaire payout for project ${p.project_id}`,
        idempotencyKey: p.id, // same key on every retry = never double-pays
      })
      await db.from('payouts').update({ xendit_payout_id: payout.id }).eq('id', p.id)
      results.push({ id: p.id, status: 'processing', xenditId: payout.id })
    } catch (err) {
      const e = err as { status?: number; data?: { message?: string }; message?: string }
      const attempts = (p.retry_count ?? 0) + 1
      const permanent = typeof e.status === 'number' && e.status >= 400 && e.status < 500
      const patch: Record<string, unknown> = {
        retry_count: attempts,
        failed_reason: e.data?.message ?? e.message ?? 'payout error',
        // Permanent (or too many tries) -> failed (admin handles it).
        // Transient -> back to pending so the next run retries (bounded by 3).
        status: permanent || attempts >= 3 ? 'failed' : 'pending',
      }
      await db.from('payouts').update(patch).eq('id', p.id)
      results.push({ id: p.id, status: patch.status, error: patch.failed_reason })
    }
  }

  return { processed: results.length, results }
})
