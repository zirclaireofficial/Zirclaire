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

  /** Order a tier. Server creates a pre-awarded, pre-funded project. */
  function orderTier(tierId: string) {
    return authedFetch<{ project: { id: string } }>('/api/services/order', {
      method: 'POST',
      body: { tierId },
    })
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
