// POST /api/master/recheck-bill   { billCode }   (Master)
// On-demand: ask ToyyibPay the live status of a bill. Read-only — surfaces the
// truth for a flagged payment without moving any money.
import { requireMaster } from '../../utils/auth'
import { getBillStatus } from '../../utils/toyyibpay'

export default defineEventHandler(async (event) => {
  await requireMaster(event)
  const { billCode } = await readBody(event)
  if (!billCode) throw createError({ statusCode: 400, statusMessage: 'billCode is required' })
  try {
    const st = await getBillStatus(String(billCode))
    const label = st.paid ? 'Paid' : st.status === '2' ? 'Pending' : st.status === '3' ? 'Failed' : 'Unknown'
    return { billCode, ...st, label }
  } catch (err) {
    throw createError({ statusCode: 502, statusMessage: (err as { message?: string })?.message ?? 'ToyyibPay lookup failed' })
  }
})
