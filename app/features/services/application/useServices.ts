// services/application — wires the repository to the use-cases, and exposes
// ordering (which creates a funded project through the server).

import type { Database } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'
import { createSupabaseServiceRepository } from '../infrastructure'
import { createServiceUseCases } from './index'

export function useServices() {
  const supabase = useSupabaseClient<Database>()
  const repo = createSupabaseServiceRepository(supabase)
  const useCases = createServiceUseCases(repo)

  /** Order a tier. Simulator funds instantly; gateway returns a pay URL and the
   *  order only starts once payment is confirmed. */
  function orderTier(tierId: string, returnUrl?: string) {
    return authedFetch<{ mode: string; invoiceUrl?: string; project?: { id: string }; projectId?: string }>(
      '/api/services/order',
      { method: 'POST', body: { tierId, returnUrl } },
    )
  }

  return { ...useCases, orderTier }
}

/** Admin-only: approve or reject a pending service listing. */
export function useServiceModeration() {
  function approve(serviceId: string) {
    return authedFetch('/api/services/approve', { method: 'POST', body: { serviceId } })
  }
  function reject(serviceId: string, reason: string) {
    return authedFetch('/api/services/reject', { method: 'POST', body: { serviceId, reason } })
  }
  return { approve, reject }
}
