// Route guard for master-only pages. The server endpoints enforce master too;
// this is the UX gate.
import type { Database } from '~/shared/types/database'

export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')
  const uid = (user.value as { sub?: string }).sub
  const supabase = useSupabaseClient<Database>()
  const { data } = await supabase.from('profiles').select('role').eq('id', uid!).maybeSingle()
  if ((data as { role?: string } | null)?.role !== 'master') return navigateTo('/')
})
