// GET /api/master/financials   (Master)
// Full money oversight for the master: the live Xendit balance plus itemized
// incoming (payments) and outgoing (payouts) logs. Aggregated totals live in
// /api/master/stats; this is the ledger-level detail + the gateway balance.
// Runs with the service role behind requireMaster.
import { serviceClient, requireMaster } from '../../utils/auth'
import { isXendit, paymentMode } from '../../utils/payments'
import { getBalance } from '../../utils/xendit'

export default defineEventHandler(async (event) => {
  await requireMaster(event)
  const db = serviceClient(event)

  // Live Xendit balance — only meaningful in gateway mode; fail soft so the
  // page still loads if the gateway is unreachable.
  let xenditBalance: number | null = null
  let xenditError: string | null = null
  if (isXendit()) {
    try {
      xenditBalance = (await getBalance()).balance
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      xenditError = err?.data?.message ?? err?.message ?? 'Could not fetch Xendit balance'
    }
  }

  // Incoming — money in (project funding invoices).
  const { data: incoming } = await db
    .from('payments')
    .select('id, project_id, amount_myr, status, method, xendit_status, reference, paid_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  // Outgoing — money out (provider payouts).
  const { data: outgoing } = await db
    .from('payouts')
    .select('id, project_id, provider_id, amount_myr, status, xendit_payout_id, failed_reason, paid_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return {
    mode: paymentMode(),
    xenditBalance,
    xenditError,
    incoming: incoming ?? [],
    outgoing: outgoing ?? [],
  }
})
