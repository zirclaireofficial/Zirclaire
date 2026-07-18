// POST /api/moderation/remove-comment   { commentId }   (Admin)
// Hard-deletes a comment (comments have no soft-remove state). Its media and
// any replies cascade via the foreign keys.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { commentId } = await readBody(event)
  if (!commentId) throw createError({ statusCode: 400, statusMessage: 'commentId is required' })

  const db = serviceClient(event)
  const { error } = await db.from('comments').delete().eq('id', commentId)
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
