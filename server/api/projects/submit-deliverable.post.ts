// POST /api/projects/submit-deliverable
//   { projectId, mediaUrl, mediaType?, note? }   (SP, awarded provider)
// Moves in_progress|revision_requested → submitted_work and stores a new,
// versioned deliverable (Cloudinary reference). Media is uploaded client-side
// first; this stores the reference.

import { serviceClient } from '../../utils/auth'
import { requireAwardedProvider } from '../../utils/projects'

export default defineEventHandler(async (event) => {
  const { projectId, mediaUrl, mediaType, note } = await readBody(event)
  if (!projectId || !mediaUrl) {
    throw createError({ statusCode: 400, statusMessage: 'projectId and mediaUrl are required' })
  }
  const { profile } = await requireAwardedProvider(event, projectId)

  const db = serviceClient(event)
  const { data, error } = await db.rpc('submit_deliverable', {
    p_project: projectId,
    p_provider: profile.id,
    p_media_url: mediaUrl,
    p_media_type: mediaType ?? null,
    p_note: note ?? null,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
