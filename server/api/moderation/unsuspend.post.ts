// POST /api/moderation/unsuspend   { userId }   (admin or master)
// Lifts a suspension, restoring the account exactly as it was. Same reach
// rules as suspend (a master is needed to touch an admin).

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { userId } = await readBody(event)
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'userId is required' })

  const db = serviceClient(event)
  const { data: target } = await db.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  if (target.role === 'admin' && actor.role !== 'master') {
    throw createError({ statusCode: 403, statusMessage: 'Only a master can lift an admin suspension' })
  }

  const { data, error } = await db
    .from('profiles')
    .update({ is_suspended: false, suspended_reason: null, suspended_at: null, suspended_by: null })
    .eq('id', userId)
    .select('id, is_suspended')
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, {
    action: 'member.unsuspend',
    target_type: 'profile',
    target_id: userId,
    summary: `Lifted suspension on a ${target.role}`,
  })
  return { profile: data }
})
