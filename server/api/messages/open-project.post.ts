// POST /api/messages/open-project   { projectId }   (buyer or awarded provider)
// Gets or creates the project thread and returns its id. The DB function
// validates the caller is a party and the project has an awarded provider.

import { serviceClient, requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const db = serviceClient(event)
  const { data, error } = await db.rpc('open_project_conversation', {
    p_project: projectId,
    p_actor: user.id,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { conversation: data }
})
