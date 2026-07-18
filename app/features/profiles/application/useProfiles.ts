// profiles/application — instantiates the repository and hands back use-cases.

import type { Database } from '~/shared/types/database'
import { createSupabaseProfileRepository } from '../infrastructure'
import { createProfileUseCases } from './index'

export function useProfiles() {
  const supabase = useSupabaseClient<Database>()
  const repo = createSupabaseProfileRepository(supabase)
  return createProfileUseCases(repo)
}
