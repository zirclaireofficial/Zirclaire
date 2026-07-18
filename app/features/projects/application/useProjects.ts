// projects/application — instantiates the repository (infrastructure) and hands
// back the use-cases. This is how UI gets project data without touching Supabase.

import type { Database } from '~/shared/types/database'
import { createSupabaseProjectRepository } from '../infrastructure'
import { createProjectUseCases } from './index'

export function useProjects() {
  const supabase = useSupabaseClient<Database>()
  const repo = createSupabaseProjectRepository(supabase)
  return createProjectUseCases(repo)
}
