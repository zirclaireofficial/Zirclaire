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

export interface PaymentLog {
  id: string
  project_id: string | null
  amount_usd: number
  status: string
  method: string | null
  xendit_status: string | null
  reference: string | null
  paid_at: string | null
  created_at: string
}
export interface PayoutLog {
  id: string
  project_id: string | null
  provider_id: string | null
  amount_myr: number
  status: string
  xendit_payout_id: string | null
  failed_reason: string | null
  paid_at: string | null
  created_at: string
}
export interface MasterFinancials {
  mode: 'xendit' | 'simulator'
  xenditBalance: number | null
  xenditError: string | null
  incoming: PaymentLog[]
  outgoing: PayoutLog[]
}

export function useMaster() {
  const stats = () => authedFetch<MasterStats>('/api/master/stats')
  const audit = (limit = 100) => authedFetch<{ entries: AuditEntry[] }>(`/api/master/audit?limit=${limit}`)
  const financials = () => authedFetch<MasterFinancials>('/api/master/financials')
  const sendNotification = (payload: {
    audience: 'all' | 'admins' | 'providers' | 'requesters' | 'selected'
    userIds?: string[]
    title: string
    body?: string
    link?: string
  }) => authedFetch<{ sent: number }>('/api/master/notify', { method: 'POST', body: payload })
  const createAdmin = (email: string, password: string, fullName: string) =>
    authedFetch<{ profile: { member_id: string; full_name: string; email: string } }>('/api/master/create-admin', {
      method: 'POST',
      body: { email, password, fullName },
    })
  return { stats, audit, financials, sendNotification, createAdmin }
}
