// POST /api/moderation/restore-comment   { commentId }   (admin or master)
// Reverses a comment removal — status back to 'active'.

import { serviceClient, requireStaff } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { commentId } = await readBody(event)
  if (!commentId) throw createError({ statusCode: 400, statusMessage: 'commentId is required' })

  const db = serviceClient(event)
  const { error } = await db
    .from('comments')
    .update({ status: 'active' })
    .eq('id', commentId)
    .eq('status', 'removed')
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
