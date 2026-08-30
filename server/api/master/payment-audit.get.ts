// GET /api/master/payment-audit?all=1   (Master)
// Read-only reconciliation: for every project, compare its budget, the payments
// recorded against it, and the escrow ledger's actual 'fund' entries, and flag
// anything that doesn't line up — paid-but-not-funded, double/overpayment,
// amount mismatches, funded-with-no-payment, stranded unconfirmed payments.
// Purely diagnostic; moves no money.
import { serviceClient, requireMaster } from '../../utils/auth'

const PRE_FUND = ['draft', 'submitted', 'approved']
const CANCELLED = ['cancelled', 'expired']
const EPS = 0.01

type Pay = { project_id: string; status: string; amount_myr: number | string; toyyibpay_billcode: string | null; reference: string | null; created_at: string }

export default defineEventHandler(async (event) => {
  await requireMaster(event)
  const all = getQuery(event).all === '1'
  const db = serviceClient(event)

  const [{ data: projects }, { data: payments }, { data: ledger }] = await Promise.all([
    db.from('projects').select('id, title, status, budget_myr, funded_amount_myr, requester_id, created_at').limit(2000),
    db.from('payments').select('project_id, status, amount_myr, toyyibpay_billcode, reference, created_at').limit(5000),
    db.from('escrow_ledger').select('project_id, entry_type, amount_myr').eq('entry_type', 'fund').limit(5000),
  ])

  const payByProject = new Map<string, Pay[]>()
  for (const p of (payments ?? []) as Pay[]) {
    const list = payByProject.get(p.project_id) ?? []
    list.push(p); payByProject.set(p.project_id, list)
  }
  const fundByProject = new Map<string, number>()
  for (const l of ledger ?? []) {
    fundByProject.set(l.project_id, (fundByProject.get(l.project_id) ?? 0) + Number(l.amount_myr))
  }

  const rows: any[] = []
  const summary: Record<string, number> = {
    projects: (projects ?? []).length, issues: 0,
    paid_not_funded: 0, overpaid: 0, amount_mismatch: 0, funded_no_payment: 0, unconfirmed_payment: 0, stranded_claimed: 0,
  }

  for (const proj of projects ?? []) {
    const budget = Number(proj.budget_myr)
    const pays = payByProject.get(proj.id) ?? []
    const verified = pays.filter((p) => p.status === 'verified')
    const claimedWithBill = pays.filter((p) => p.status === 'claimed' && p.toyyibpay_billcode)
    const verifiedPaid = verified.reduce((s, p) => s + Number(p.amount_myr), 0)
    const fundedInEscrow = fundByProject.get(proj.id) ?? 0
    const isPreFund = PRE_FUND.includes(proj.status)
    const isCancelled = CANCELLED.includes(proj.status)
    const isSimulated = pays.some((p) => p.reference === 'SIMULATED')

    const flags: string[] = []

    // Paid but the project never funded.
    if (isPreFund && verified.length >= 1) flags.push('paid_not_funded')
    // A bill exists on an unfunded project but we haven't confirmed it — needs a gateway re-check.
    if (isPreFund && verified.length === 0 && claimedWithBill.length >= 1) flags.push('unconfirmed_payment')
    // More than one successful payment, or total paid exceeds the budget.
    if (verified.length > 1 || verifiedPaid > budget + EPS) flags.push('overpaid')
    // Money is (or was) held, but the amounts don't agree.
    if (!isPreFund && !isCancelled) {
      if (Math.abs(fundedInEscrow - budget) > EPS) flags.push('amount_mismatch')
      if (verified.length === 0 && !isSimulated) flags.push('funded_no_payment')
      // Extra unconsumed bill sitting on an already-funded project → possible overpayment.
      if (claimedWithBill.length >= 1) flags.push('stranded_claimed')
    }

    for (const f of flags) if (f in summary) summary[f]++
    if (flags.length) summary.issues++

    if (flags.length || all) {
      rows.push({
        id: proj.id,
        title: proj.title,
        status: proj.status,
        requester_id: proj.requester_id,
        budget_myr: budget,
        funded_in_escrow: Number(fundedInEscrow.toFixed(2)),
        verified_paid: Number(verifiedPaid.toFixed(2)),
        verified_count: verified.length,
        surplus: Number(Math.max(0, verifiedPaid - budget).toFixed(2)),
        flags,
        severity: flags.some((f) => ['paid_not_funded', 'overpaid', 'amount_mismatch', 'funded_no_payment'].includes(f))
          ? 'error' : flags.length ? 'warn' : 'ok',
        payments: pays
          .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
          .map((p) => ({ status: p.status, amount_myr: Number(p.amount_myr), billcode: p.toyyibpay_billcode, reference: p.reference, created_at: p.created_at })),
      })
    }
  }

  // Problems first (error > warn > ok), then most recent.
  const rank = (s: string) => (s === 'error' ? 0 : s === 'warn' ? 1 : 2)
  rows.sort((a, b) => rank(a.severity) - rank(b.severity))

  return { summary, rows }
})
