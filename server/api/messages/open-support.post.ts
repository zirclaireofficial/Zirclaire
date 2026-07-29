// POST /api/messages/open-support   (any signed-in member)
// Gets or creates the caller's service-desk thread and returns its id.

import { serviceClient, requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = serviceClient(event)
  const { data, error } = await db.rpc('start_support_conversation', { p_actor: user.id })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { conversation: data }
})
