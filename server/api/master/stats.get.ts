// GET /api/master/stats   (Master)
// Platform performance: members, projects, and finances. Runs with the service
// role (so it sees everything) behind requireMaster. Each figure is defined in
// the response so the console's (i) explainers can stay accurate.

import { serviceClient, requireMaster } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireMaster(event)
  const db = serviceClient(event)

  const countWhere = async (table: string, col: string, val: string) => {
    const { count } = await (db as any)
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(col, val)
    return count ?? 0
  }
  const countAll = async (table: string) => {
    const { count } = await (db as any).from(table).select('id', { count: 'exact', head: true })
    return count ?? 0
  }

  // --- Members ---
  const [members, providers, requesters, admins, pendingKyc, suspended] = await Promise.all([
    countAll('profiles'),
    countWhere('profiles', 'role', 'service_provider'),
    countWhere('profiles', 'role', 'service_requester'),
    countWhere('profiles', 'role', 'admin'),
    countWhere('profiles', 'kyc_status', 'pending'),
    (async () => {
      const { count } = await (db as any).from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', true)
      return count ?? 0
    })(),
  ])

  // --- Projects by status ---
  const { data: projRows } = await (db as any).from('projects').select('status')
  const projectsByStatus: Record<string, number> = {}
  for (const r of projRows ?? []) projectsByStatus[r.status] = (projectsByStatus[r.status] ?? 0) + 1
  const projectsTotal = (projRows ?? []).length

  // --- Escrow money (project side) ---
  const { data: ledger } = await (db as any).from('escrow_ledger').select('entry_type, amount_usd')
  const money = { funded: 0, commission: 0, payout: 0, refund: 0, held: 0 }
  for (const e of ledger ?? []) {
    const amt = Number(e.amount_usd)
    money.held += amt
    if (e.entry_type === 'fund') money.funded += amt
    else if (e.entry_type === 'commission') money.commission += -amt
    else if (e.entry_type === 'payout') money.payout += -amt
    else if (e.entry_type === 'refund') money.refund += -amt
  }

  // --- Royalty money ---
  const { data: royLedger } = await (db as any).from('royalty_ledger').select('entry_type, amount_usd')
  const royalty = { sales: 0, commission: 0, payout: 0 }
  for (const e of royLedger ?? []) {
    const amt = Number(e.amount_usd)
    if (e.entry_type === 'sale') royalty.sales += amt
    else if (e.entry_type === 'commission') royalty.commission += -amt
    else if (e.entry_type === 'payout') royalty.payout += -amt
  }

  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    members: { total: members, providers, requesters, admins, pendingKyc, suspended },
    projects: { total: projectsTotal, byStatus: projectsByStatus },
    money: {
      funded: round2(money.funded),
      commission: round2(money.commission),
      payout: round2(money.payout),
      refund: round2(money.refund),
      held: round2(money.held),
    },
    royalty: {
      sales: round2(royalty.sales),
      commission: round2(royalty.commission),
      payout: round2(royalty.payout),
    },
    // Total platform earnings across both revenue lines.
    platformearnings: round2(money.commission + royalty.commission),
  }
})
