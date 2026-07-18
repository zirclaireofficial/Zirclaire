// Shared guards for privileged server routes.
// serverSupabaseServiceRole = the full-access (secret key) client, server only.
// serverSupabaseUser        = the caller's authenticated identity from their session.

import type { H3Event } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/shared/types/database'

/** The elevated, RLS-bypassing client. Never expose this to the browser. */
export function serviceClient(event: H3Event) {
  return serverSupabaseServiceRole<Database>(event)
}

/** Require a logged-in caller, or 401. */
export async function requireUser(event: H3Event) {
  // @nuxtjs/supabase v2 returns JWT *claims*, where the user id is `sub`.
  const claims = (await serverSupabaseUser(event)) as { sub?: string; email?: string } | null
  let id = claims?.sub
  let email = claims?.email

  // Fallback: a Bearer access token (belt-and-suspenders for edge cases).
  if (!id) {
    const authz = getHeader(event, 'authorization')
    const token = authz?.startsWith('Bearer ') ? authz.slice(7) : null
    if (token) {
      const { data } = await serviceClient(event).auth.getUser(token)
      id = data.user?.id
      email = data.user?.email ?? email
    }
  }

  if (!id) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated (no active session)' })
  }
  return { id, email }
}

/** Load the caller's profile row (service client, so it works pre-approval too). */
export async function getCallerProfile(event: H3Event) {
  const user = await requireUser(event)
  const db = serviceClient(event)
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 403, statusMessage: 'No profile for this user' })
  return data
}

/** Require the caller to be an admin, or 403. Returns the admin's profile. */
export async function requireAdmin(event: H3Event) {
  const profile = await getCallerProfile(event)
  if (profile.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
  return profile
}
