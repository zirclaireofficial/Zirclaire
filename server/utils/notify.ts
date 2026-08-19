// Notify a user — inserts one in-site notification. Server-side only (runs with
// the service role, since clients can't insert notifications). Reusable for any
// event: project approved, payment received, awarded, work submitted, etc.
//
//   await notify(db, requesterId, {
//     type: 'project_approved',
//     title: 'Project approved',
//     body: 'Your project is approved — pay now to make it live.',
//     link: '/projects',
//   })
import type { SupabaseClient } from '@supabase/supabase-js'

export interface NotifyInput {
  type: string
  title: string
  body?: string
  link?: string
}

export async function notify(db: SupabaseClient, userId: string, n: NotifyInput) {
  await db.from('notifications').insert({
    user_id: userId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
  })
}

/** Notify every user holding one of the given roles (e.g. staff, masters). */
export async function notifyRoles(db: SupabaseClient, roles: string[], n: NotifyInput) {
  const { data } = await db.from('profiles').select('id').in('role', roles)
  for (const r of (data ?? []) as Array<{ id: string }>) await notify(db, r.id, n)
}
