// POST /api/moderation/restore-post   { postId }   (admin or master)
// Reverses a post removal — status back to 'active', so it returns to the feed.
// One of the safe, fully reversible moderation actions.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { postId } = await readBody(event)
  if (!postId) throw createError({ statusCode: 400, statusMessage: 'postId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('posts')
    .update({ status: 'active' })
    .eq('id', postId)
    .eq('status', 'removed')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, { action: 'post.restore', target_type: 'post', target_id: postId, summary: 'Restored a removed post' })
  return { post: data }
})
