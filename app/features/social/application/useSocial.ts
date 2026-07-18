// social/application — instantiates the repository (infrastructure) and hands
// back the use-cases. This is how UI gets feed data without touching Supabase.

import type { Database } from '~/shared/types/database'
import { createSupabaseSocialRepository } from '../infrastructure'
import { createSocialUseCases } from './index'

export function useSocial() {
  const supabase = useSupabaseClient<Database>()
  const repo = createSupabaseSocialRepository(supabase)
  return createSocialUseCases(repo)
}
