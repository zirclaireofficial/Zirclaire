// POST /api/payments/create-invoice   { projectId }   (SR, owns project)
// Starts funding a submitted project.
//   xendit mode    -> creates a hosted Xendit invoice; the project is funded
//                     ONLY when the webhook confirms payment (never here).
//   simulator mode -> funds + launches instantly (fake money), clearly labelled.
import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'
import { isXendit, paymentMode } from '../../utils/payments'
import { createInvoice, getInvoice } from '../../utils/xendit'

export default defineEventHandler(async (event) => {
  const { projectId, returnUrl } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const { project } = await requireProjectOwner(event, projectId)
  if (project.status !== 'approved') {
    throw createError({ statusCode: 400, statusMessage: 'This project is not approved for payment yet' })
  }

  const db = serviceClient(event)
  const amount = Number(project.budget_usd) // treated as MYR

  // ---- Simulator: fake, instant funding (local dev / fallback) ----
  if (!isXendit()) {
    await db.from('payments').insert({
      project_id: projectId,
      payer_id: project.requester_id,
      method: 'touch_n_go',
      amount_usd: amount,
      status: 'verified',
      reference: 'SIMULATED',
    })
    await db.rpc('fund_project', { p_project: projectId, p_amount: amount, p_actor: project.requester_id })
    const mins = project.timeline_minutes ?? 2880
    const deadline = new Date(Date.now() + mins * 60_000).toISOString()
    const { data } = await db.rpc('push_project_live', { p_project: projectId, p_deadline: deadline })
    return { mode: 'simulator' as const, funded: true, project: data }
  }

  // ---- Idempotency: reuse an existing unpaid invoice ----
  // A double-click or a retry-after-timeout must NOT create a second invoice
  // (which could lead to a double charge). If this project already has a
  // pending invoice, return it instead of making a new one.
  const { data: existing } = await db
    .from('payments')
    .select('xendit_invoice_id')
    .eq('project_id', projectId)
    .eq('status', 'claimed')
    .not('xendit_invoice_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing?.xendit_invoice_id) {
    try {
      const inv = await getInvoice(existing.xendit_invoice_id)
      if (inv.status === 'PENDING') {
        return { mode: paymentMode(), invoiceUrl: inv.invoice_url, invoiceId: inv.id, reused: true }
      }
    } catch {
      // Couldn't fetch it (expired/deleted) — fall through and make a fresh one.
    }
  }

  // ---- Xendit: real hosted invoice; funding waits for the webhook ----
  const invoice = await createInvoice({
    externalId: `zc-fund-${projectId}-${Date.now()}`,
    amount,
    description: `Zirclaire — fund project "${project.title}"`,
    successRedirectUrl: typeof returnUrl === 'string' ? returnUrl : undefined,
  })

  await db.from('payments').insert({
    project_id: projectId,
    payer_id: project.requester_id,
    amount_usd: amount,
    reference: invoice.external_id,
    xendit_invoice_id: invoice.id,
    xendit_status: invoice.status,
    status: 'claimed', // becomes 'verified' when the webhook confirms payment
  })

  return {
    mode: paymentMode(),
    invoiceUrl: invoice.invoice_url,
    invoiceId: invoice.id,
  }
})
