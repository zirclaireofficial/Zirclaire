// $fetch wrapper that attaches the current Supabase access token as a Bearer
// header. Ensures our server routes can identify the caller even when the SSR
// auth cookie hasn't propagated yet (e.g. immediately after sign-up).

import type { Database } from '~/shared/types/database'

export async function authedFetch<T>(url: string, options: Record<string, unknown> = {}): Promise<T> {
  const supabase = useSupabaseClient<Database>()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return $fetch<T>(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
