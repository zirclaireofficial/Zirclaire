// POST /api/moderation/remove-post   { postId }   (Admin)
// Soft-removes a post (status → 'removed'), which drops it from the public
// feed_posts view immediately. This is also the exact lever the future
// automated sweeper will pull.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { postId } = await readBody(event)
  if (!postId) throw createError({ statusCode: 400, statusMessage: 'postId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('posts')
    .update({ status: 'removed' })
    .eq('id', postId)
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { post: data }
})
