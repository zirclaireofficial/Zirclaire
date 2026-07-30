// POST /api/moderation/remove-comment   { commentId }   (Admin)
// Soft-removes a comment (status -> 'removed'), hiding it from everyone but its
// author and staff. Reversible via restore-comment — nothing is destroyed.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { commentId } = await readBody(event)
  if (!commentId) throw createError({ statusCode: 400, statusMessage: 'commentId is required' })

  const db = serviceClient(event)
  const { error } = await db.from('comments').update({ status: 'removed' }).eq('id', commentId)
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, { action: 'comment.remove', target_type: 'comment', target_id: commentId, summary: 'Removed a comment' })
  return { ok: true }
})
