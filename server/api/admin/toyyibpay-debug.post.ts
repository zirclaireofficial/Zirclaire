// POST /api/admin/toyyibpay-debug   { projectId? , billCode? }   (Admin)
// Diagnostic for "money taken but project not funded". Reports the config, the
// stored payment row(s), the project status, and the LIVE ToyyibPay status of
// each bill — so we can see exactly where funding is breaking. Read-only.
import { serviceClient, requireAdmin } from '../../utils/auth'
import { getBillStatus } from '../../utils/toyyibpay'
import { isToyyibpay, paymentMode } from '../../utils/payments'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { projectId, billCode } = await readBody(event)
  const db = serviceClient(event)

  const config = {
    paymentMode: paymentMode(),
    isToyyibpay: isToyyibpay(),
    env: process.env.TOYYIBPAY_ENV ?? '(unset → sandbox)',
    hasSecretKey: !!process.env.TOYYIBPAY_SECRET_KEY,
    hasCategoryCode: !!process.env.TOYYIBPAY_CATEGORY_CODE,
    paymentChannel: process.env.TOYYIBPAY_PAYMENT_CHANNEL ?? '(default 2)',
    callbackOrigin: getRequestURL(event).origin, // what we'd hand ToyyibPay as the callback base
  }

  // Gather the payment rows in scope.
  let query = db.from('payments').select('id, project_id, status, amount_myr, reference, toyyibpay_billcode, paid_at, created_at')
  if (projectId) query = query.eq('project_id', projectId)
  if (billCode) query = query.eq('toyyibpay_billcode', billCode)
  const { data: payments } = await query.order('created_at', { ascending: false }).limit(20)

  // Project status (if a projectId was given, or infer from the first payment).
  const pid = projectId ?? payments?.[0]?.project_id
  let project: Record<string, unknown> | null = null
  if (pid) {
    const { data } = await db.from('projects')
      .select('id, title, status, budget_myr, funded_amount_myr, requester_id, timeline_minutes')
      .eq('id', pid).maybeSingle()
    project = data ?? null
  }

  // Live status of each bill we know about (this also logs the raw payload).
  const bills: Array<Record<string, unknown>> = []
  const codes = [...new Set([...(payments ?? []).map((p) => p.toyyibpay_billcode).filter(Boolean), billCode].filter(Boolean))] as string[]
  for (const code of codes) {
    try {
      const st = await getBillStatus(code)
      bills.push({ billCode: code, ...st })
    } catch (err) {
      bills.push({ billCode: code, error: (err as { message?: string })?.message ?? String(err) })
    }
  }

  return { config, project, payments: payments ?? [], bills }
})
