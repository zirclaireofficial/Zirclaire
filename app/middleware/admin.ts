// Route guard for admin-only pages. Applied via definePageMeta({ middleware: 'admin' }).
// Reads the caller's role directly (RLS lets you read your own profile). The
// admin API routes enforce admin server-side too, so this is the UX gate.
import type { Database } from '~/shared/types/database'

export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  const uid = (user.value as { sub?: string }).sub
  const supabase = useSupabaseClient<Database>()
  const { data } = await supabase.from('profiles').select('role').eq('id', uid!).maybeSingle()

  if (data?.role !== 'admin') return navigateTo('/')
})
