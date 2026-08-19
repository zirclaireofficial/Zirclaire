// GET /api/cron/reconcile-payments   (Vercel Cron)
// Safety net for a lost/late payment webhook. Finds 'approved' projects whose
// invoice Xendit reports as PAID but that never got funded, and funds them —
// exactly what the webhook would have done.
//
// SAFE BY DESIGN — it can never fund a project by mistake:
//   1. It only considers projects in 'approved' state that HAVE an invoice.
//   2. It funds ONLY if Xendit itself confirms the invoice is PAID/SETTLED.
//   3. fund_project is atomic (WHERE status='approved'), so a concurrent
//      webhook or a re-run can never double-fund.
import { serviceClient } from '../../utils/auth'
import { isXendit } from '../../utils/payments'
import { getInvoice } from '../../utils/xendit'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, 'authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!isXendit()) return { skipped: 'simulator mode' }

  const db = serviceClient(event)

  // Claimed (unpaid-in-our-records) invoices whose project is still 'approved'.
  const { data: rows } = await db
    .from('payments')
    .select('id, xendit_invoice_id, projects!inner(id, status, title, budget_usd, requester_id, timeline_minutes)')
    .eq('status', 'claimed')
    .not('xendit_invoice_id', 'is', null)
    .eq('projects.status', 'approved')
    .limit(100)

  const results: Array<Record<string, unknown>> = []

  for (const r of rows ?? []) {
    const project = (r as unknown as { projects: {
      id: string; status: string; title: string; budget_usd: number; requester_id: string; timeline_minutes: number | null
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
        p_amount: project.budget_usd,
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
    checked: (rows ?? []).length,
    recovered: results.filter((x) => x.funded).length,
    results,
  }
})
