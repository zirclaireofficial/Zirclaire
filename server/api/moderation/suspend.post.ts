// POST /api/moderation/suspend   { userId, reason }   (admin or master)
// Suspends an account: blocks its writes and hides it from others. Not a
// deletion — nothing is removed, and unsuspend restores everything.
//
// Reach: an admin may suspend members (requester/provider). A master may also
// suspend admins. Nobody may suspend a master.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { userId, reason } = await readBody(event)
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'userId is required' })
  if (userId === actor.id) throw createError({ statusCode: 400, statusMessage: 'You cannot suspend yourself' })

  const db = serviceClient(event)
  const { data: target, error: tErr } = await db
    .from('profiles')
    .select('id, role, is_suspended')
    .eq('id', userId)
    .maybeSingle()
  if (tErr) throw createError({ statusCode: 400, statusMessage: tErr.message })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Member not found' })

  // Permission by target role.
  if (target.role === 'master') {
    throw createError({ statusCode: 403, statusMessage: 'A master cannot be suspended' })
  }
  if (target.role === 'admin' && actor.role !== 'master') {
    throw createError({ statusCode: 403, statusMessage: 'Only a master can suspend an admin' })
  }

  const { data, error } = await db
    .from('profiles')
    .update({
      is_suspended: true,
      suspended_reason: reason || null,
      suspended_at: new Date().toISOString(),
      suspended_by: actor.id,
    })
    .eq('id', userId)
    .select('id, is_suspended, suspended_reason')
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, {
    action: 'member.suspend',
    target_type: 'profile',
    target_id: userId,
    summary: `Suspended a ${target.role}${reason ? ` — ${reason}` : ''}`,
    detail: { reason: reason || null },
  })
  return { profile: data }
})
