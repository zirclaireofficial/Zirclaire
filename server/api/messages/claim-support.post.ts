// POST /api/messages/claim-support   { conversationId }   (Admin)
// Claims a support thread from the shared queue. Atomic: fails if another
// admin already claimed it, and joins the admin as a participant so they can
// reply.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { conversationId } = await readBody(event)
  if (!conversationId) throw createError({ statusCode: 400, statusMessage: 'conversationId is required' })

  const db = serviceClient(event)
  const { data, error } = await db.rpc('claim_support_conversation', {
    p_convo: conversationId,
    p_admin: admin.id,
  })
  if (error) throw createError({ statusCode: 409, statusMessage: error.message })
  return { conversation: data }
})
