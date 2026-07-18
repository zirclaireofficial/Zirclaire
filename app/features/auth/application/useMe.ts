// Current user's profile (role, approval, member id) — cached across the app.
// Reads directly via RLS (you can always read your own profile).

import type { Database } from '~/shared/types/database'

export type Me = {
  role: 'service_requester' | 'service_provider' | 'admin'
  kyc_status: 'pending' | 'approved' | 'rejected'
  member_id: string | null
  full_name: string
}

export function useMe() {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient<Database>()
  const me = useState<Me | null>('zc-me', () => null)
  const loading = useState<boolean>('zc-me-loading', () => false)

  async function load(force = false) {
    if (me.value && !force) return me.value
    const uid = (user.value as { sub?: string } | null)?.sub
    if (!uid) {
      me.value = null
      return null
    }
    loading.value = true
    const { data } = await supabase
      .from('profiles')
      .select('role, kyc_status, member_id, full_name')
      .eq('id', uid)
      .maybeSingle()
    me.value = (data as Me) ?? null
    loading.value = false
    return me.value
  }

  return { me, loading, load }
}
