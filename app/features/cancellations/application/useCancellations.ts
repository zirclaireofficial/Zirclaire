// cancellations/application — reads go through Supabase (RLS scopes rows to the
// two parties + staff); writes go through the server API (service role, which
// runs the atomic state functions and sends notifications). Users never learn
// which tier (admin/master) acted — the Platform speaks as "Zirclaire".

import { authedFetch } from '~/shared/lib/authedFetch'

export interface CancellationRequest {
  id: string
  project_id: string
  requested_by: string
  provider_id: string | null
  reason: string
  status: 'pending_provider' | 'in_arbitration' | 'awaiting_appeal' | 'appealed' | 'approved' | 'denied'
  provider_response: string | null
  admin_decision: string | null
  admin_reason: string | null
  admin_decided_at: string | null
  appealed_by: string | null
  appeal_reason: string | null
  master_decision: string | null
  master_reason: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  projects?: { title: string } | null
}

export interface DisputeMessage {
  id: string
  request_id: string
  party: 'requester' | 'provider'
  sender_side: 'platform' | 'user'
  body: string
  created_at: string
}

const OPEN = ['pending_provider', 'in_arbitration', 'awaiting_appeal', 'appealed']

export function useCancellations() {
  const supabase = useSupabaseClient()

  // ---- reads ----
  async function mine(): Promise<CancellationRequest[]> {
    const { data } = await supabase
      .from('cancellation_requests')
      .select('*, projects(title)')
      .order('created_at', { ascending: false })
    return (data as CancellationRequest[]) ?? []
  }

  async function forProject(projectId: string): Promise<CancellationRequest | null> {
    const { data } = await supabase
      .from('cancellation_requests')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
    return ((data as CancellationRequest[]) ?? [])[0] ?? null
  }

  /** Staff: cases still in flight. */
  async function queue(): Promise<CancellationRequest[]> {
    const { data } = await supabase
      .from('cancellation_requests')
      .select('*, projects(title)')
      .in('status', OPEN)
      .order('created_at')
    return (data as CancellationRequest[]) ?? []
  }

  async function messages(requestId: string, party?: 'requester' | 'provider'): Promise<DisputeMessage[]> {
    let q = supabase.from('dispute_messages').select('*').eq('request_id', requestId).order('created_at')
    if (party) q = q.eq('party', party)
    const { data } = await q
    return (data as DisputeMessage[]) ?? []
  }

  // ---- writes ----
  const request = (projectId: string, reason: string) =>
    authedFetch('/api/cancellations/request', { method: 'POST', body: { projectId, reason } })
  const respond = (requestId: string, accept: boolean) =>
    authedFetch('/api/cancellations/respond', { method: 'POST', body: { requestId, accept } })
  const appeal = (requestId: string, reason: string) =>
    authedFetch('/api/cancellations/appeal', { method: 'POST', body: { requestId, reason } })
  const adminDecide = (requestId: string, decision: 'approved' | 'denied', reason: string) =>
    authedFetch('/api/cancellations/admin-decide', { method: 'POST', body: { requestId, decision, reason } })
  const masterDecide = (requestId: string, decision: 'approved' | 'denied', reason: string) =>
    authedFetch('/api/cancellations/master-decide', { method: 'POST', body: { requestId, decision, reason } })
  const sendMessage = (requestId: string, body: string, party?: 'requester' | 'provider') =>
    authedFetch('/api/cancellations/message', { method: 'POST', body: { requestId, body, party } })

  return { mine, forProject, queue, messages, request, respond, appeal, adminDecide, masterDecide, sendMessage }
}

// Plain-language status shown to a USER (no tiers, no internal steps).
export function userStatusLabel(r: CancellationRequest): { label: string; color: string } {
  switch (r.status) {
    case 'pending_provider': return { label: 'Awaiting provider response', color: 'warning' }
    case 'in_arbitration': return { label: 'Under review by Zirclaire', color: 'neutral' }
    case 'awaiting_appeal': return { label: 'Decision made — appeal window open', color: 'primary' }
    case 'appealed': return { label: 'Appeal under final review', color: 'neutral' }
    case 'approved': return { label: 'Cancellation approved', color: 'success' }
    case 'denied': return { label: 'Cancellation declined', color: 'error' }
    default: return { label: r.status, color: 'neutral' }
  }
}
