// GET /api/cron/reconcile-payments   (Vercel Cron — nightly maintenance)
// Two jobs run here so we stay within the Hobby plan's cron limit:
//
//   A. Unclosed-project sweep (Terms §11) — runs in EVERY mode. Past-deadline
//      projects with no submission are auto-refunded 95%; the rest are flagged
//      for a human. See server/utils/expiry.ts.
//
//   B. Payment reconciliation (Xendit modes only) — safety net for a lost/late
//      webhook. Finds 'approved' projects whose invoice Xendit reports as PAID
//      but that never got funded, and funds them — exactly what the webhook
//      would have done. SAFE BY DESIGN — it can never fund by mistake:
//        1. only 'approved' projects that HAVE an invoice,
//        2. funds ONLY if Xendit confirms PAID/SETTLED,
//        3. fund_project is atomic (WHERE status='approved'), so a concurrent
//           webhook or re-run can never double-fund.
import { serviceClient } from '../../utils/auth'
import { isXendit, isToyyibpay } from '../../utils/payments'
import { getInvoice } from '../../utils/xendit'
import { getBillStatus } from '../../utils/toyyibpay'
import { notify } from '../../utils/notify'
import { runExpirySweep, runCancellationFinalizer, runCompletionSweep } from '../../utils/expiry'

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, 'authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = serviceClient(event)

  // (A) Unclosed-project sweep — always runs.
  const expiry = await runExpirySweep(db)

  // (A2) Auto-complete projects past their 48h completion window (no protest).
  const completions = await runCompletionSweep(db)

  // (B) Mature cancellation decisions past their 48h appeal window — always runs.
  const cancellations = await runCancellationFinalizer(db)

  // (C) ToyyibPay reconciliation — recover any bill paid but not funded (lost
  // callback). Same safety as the webhook: verify with ToyyibPay, fund only if
  // paid, fund_project is atomic on status='approved'.
  if (isToyyibpay()) {
    const { data: rows } = await db
      .from('payments')
      .select('id, toyyibpay_billcode, projects!inner(id, status, title, budget_myr, requester_id, timeline_minutes)')
      .eq('status', 'claimed')
      .not('toyyibpay_billcode', 'is', null)
      .eq('projects.status', 'approved')
      .limit(100)
    const results: Array<Record<string, unknown>> = []
    for (const r of rows ?? []) {
      const project = (r as unknown as { projects: {
        id: string; status: string; title: string; budget_myr: number; requester_id: string; timeline_minutes: number | null
      } }).projects
      if (!project || project.status !== 'approved') continue
      let st
      try { st = await getBillStatus(r.toyyibpay_billcode as string) } catch { continue }
      if (!st.paid) continue
      try {
        await db.from('payments').update({ status: 'verified', paid_at: new Date().toISOString() }).eq('id', r.id)
        await db.rpc('fund_project', { p_project: project.id, p_amount: project.budget_myr, p_actor: project.requester_id })
        const mins = project.timeline_minutes ?? 2880
        await db.rpc('push_project_live', { p_project: project.id, p_deadline: new Date(Date.now() + mins * 60_000).toISOString() })
        await notify(db, project.requester_id, {
          type: 'payment_received',
          title: 'Payment received',
          body: `"${project.title}" is funded and now live for providers to apply.`,
          link: '/projects',
        })
        results.push({ project: project.id, funded: true })
      } catch {
        results.push({ project: project.id, funded: false, note: 'already funded / race' })
      }
    }
    return { expiry, cancellations, checked: (rows ?? []).length, recovered: results.filter((x) => x.funded).length, results }
  }

  // (C) Xendit reconciliation — Xendit mode only.
  if (!isXendit()) return { expiry, completions, cancellations, payments: 'skipped (no gateway reconciliation)' }

  // Claimed (unpaid-in-our-records) invoices whose project is still 'approved'.
  const { data: rows } = await db
    .from('payments')
    .select('id, xendit_invoice_id, projects!inner(id, status, title, budget_myr, requester_id, timeline_minutes)')
    .eq('status', 'claimed')
    .not('xendit_invoice_id', 'is', null)
    .eq('projects.status', 'approved')
    .limit(100)

  const results: Array<Record<string, unknown>> = []

  for (const r of rows ?? []) {
    const project = (r as unknown as { projects: {
      id: string; status: string; title: string; budget_myr: number; requester_id: string; timeline_minutes: number | null
    } }).projects
    if (!project || project.status !== 'approved') continue

    // Ask Xendit the truth. Only PAID/SETTLED invoices get funded.
    let inv
    try {
      inv = await getInvoice(r.xendit_invoice_id as string)
    } catch {
      continue // couldn't reach Xendit for this one — try again next run
    }
    if (inv.status !== 'PAID' && inv.status !== 'SETTLED') continue

    try {
      await db
        .from('payments')
        .update({ status: 'verified', xendit_status: inv.status, paid_at: new Date().toISOString() })
        .eq('id', r.id)
      await db.rpc('fund_project', {
        p_project: project.id,
        p_amount: project.budget_myr,
        p_actor: project.requester_id,
      })
      const mins = project.timeline_minutes ?? 2880
      const deadline = new Date(Date.now() + mins * 60_000).toISOString()
      await db.rpc('push_project_live', { p_project: project.id, p_deadline: deadline })
      await notify(db, project.requester_id, {
        type: 'payment_received',
        title: 'Payment received',
        body: `"${project.title}" is funded and now live for providers to apply.`,
        link: '/projects',
      })
      results.push({ project: project.id, funded: true })
    } catch {
      // fund_project rejected — the webhook likely funded it first. Harmless.
      results.push({ project: project.id, funded: false, note: 'already funded / race' })
    }
  }

  return {
    expiry,
    checked: (rows ?? []).length,
    recovered: results.filter((x) => x.funded).length,
    results,
  }
})
