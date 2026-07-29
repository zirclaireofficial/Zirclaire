// royalties/application — wires the repository to the use-cases, and exposes
// the privileged actions (purchase, approve, download) that go through the
// server. Reads use RLS; money and file access go through server routes.

import type { Database } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'
import { createSupabaseRoyaltyRepository } from '../infrastructure'
import { createRoyaltyUseCases } from './index'

export function useRoyalties() {
  const supabase = useSupabaseClient<Database>()
  const repo = createSupabaseRoyaltyRepository(supabase)
  const useCases = createRoyaltyUseCases(repo)

  /** Buy an item. Server records the sale + 15/85 split atomically. */
  function purchase(itemId: string, method: 'binance' | 'touch_n_go') {
    return authedFetch<{ purchase: { id: string; reference: string } }>('/api/royalties/purchase', {
      method: 'POST',
      body: { itemId, method },
    })
  }

  /** Get a signed, short-lived download URL. Server checks a purchase exists. */
  async function downloadUrl(itemId: string): Promise<string> {
    const res = await authedFetch<{ url: string }>('/api/royalties/download', {
      method: 'POST',
      body: { itemId },
    })
    return res.url
  }

  return { ...useCases, purchase, downloadUrl }
}

/** Admin-only: approve or reject a pending item. */
export function useRoyaltyModeration() {
  function approve(itemId: string) {
    return authedFetch('/api/royalties/approve', { method: 'POST', body: { itemId } })
  }
  function reject(itemId: string, reason: string) {
    return authedFetch('/api/royalties/reject', { method: 'POST', body: { itemId, reason } })
  }
  return { approve, reject }
}
