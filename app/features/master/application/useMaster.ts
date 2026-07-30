// master/application — thin client over the master-only server endpoints. All
// data is fetched through the server (service role) because the master reads
// across everything; the browser never gets elevated rights.

import { authedFetch } from '~/shared/lib/authedFetch'

export interface MasterStats {
  members: { total: number; providers: number; requesters: number; admins: number; pendingKyc: number; suspended: number }
  projects: { total: number; byStatus: Record<string, number> }
  money: { funded: number; commission: number; payout: number; refund: number; held: number }
  royalty: { sales: number; commission: number; payout: number }
  platformearnings: number
}

export interface AuditEntry {
  id: string
  actor_role: string | null
  action: string
  target_type: string | null
  target_id: string | null
  summary: string | null
  created_at: string
  actor: { full_name: string; member_id: string | null } | null
}

export function useMaster() {
  const stats = () => authedFetch<MasterStats>('/api/master/stats')
  const audit = (limit = 100) => authedFetch<{ entries: AuditEntry[] }>(`/api/master/audit?limit=${limit}`)
  const createAdmin = (email: string, password: string, fullName: string) =>
    authedFetch<{ profile: { member_id: string; full_name: string; email: string } }>('/api/master/create-admin', {
      method: 'POST',
      body: { email, password, fullName },
    })
  return { stats, audit, createAdmin }
}
