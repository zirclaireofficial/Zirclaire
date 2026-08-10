// social/application — instantiates the repository (infrastructure) and hands
// back the use-cases. This is how UI gets feed data without touching Supabase.

import type { Database } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'
import { createSupabaseSocialRepository } from '../infrastructure'
import { createSocialUseCases } from './index'

export function useSocial() {
  const supabase = useSupabaseClient<Database>()
  const repo = createSupabaseSocialRepository(supabase)
  const useCases = createSocialUseCases(repo)

  /** Ask the AI sweeper to screen a just-published post (best-effort, flag-only). */
  function screenPost(postId: string) {
    return authedFetch('/api/ai/screen-post', { method: 'POST', body: { postId } })
  }

  return { ...useCases, screenPost }
}
