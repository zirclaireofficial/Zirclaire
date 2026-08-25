// POST /api/royalties/publish  { projectId, workType, title, description, price, coverImage }
// A requester lists a COMPLETED project's deliverable for resale (Terms §16A).
// Server-side so we can verify ownership + closed status and pull the
// deliverable file — the client never handles the private file URL.
import { serviceClient } from '../../utils/auth'
import { requireApproved } from '../../utils/projects'

const WORK_TYPES = ['novel', 'research', 'journal']

export default defineEventHandler(async (event) => {
  const { projectId, workType, title, description, price, coverImage } = await readBody(event)
  if (!projectId || !title?.trim() || !workType || !price) {
    throw createError({ statusCode: 400, statusMessage: 'projectId, title, work type and price are required' })
  }
  if (!WORK_TYPES.includes(workType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid work type' })
  }
  if (Number(price) <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Price must be greater than zero' })
  }

  const profile = await requireApproved(event)
  if (profile.role !== 'service_requester') {
    throw createError({ statusCode: 403, statusMessage: 'Only requesters can list a completed project' })
  }
  const db = serviceClient(event)

  // Must own the project, and it must be completed (closed = delivered + paid).
  const { data: project } = await db
    .from('projects')
    .select('id, requester_id, status')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  if (project.requester_id !== profile.id) {
    throw createError({ statusCode: 403, statusMessage: 'Not your project' })
  }
  if (project.status !== 'closed') {
    throw createError({ statusCode: 400, statusMessage: 'Only completed projects can be listed for resale' })
  }

  // One listing per project.
  const { data: existing } = await db
    .from('royalty_items').select('id').eq('project_id', projectId).maybeSingle()
  if (existing) {
    throw createError({ statusCode: 400, statusMessage: 'This project is already listed' })
  }

  // The downloadable file is the project's latest deliverable.
  const { data: deliverable } = await db
    .from('deliverables')
    .select('media_url, media_type')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!deliverable) {
    throw createError({ statusCode: 400, statusMessage: 'This project has no deliverable to list' })
  }

  const { data, error } = await db
    .from('royalty_items')
    .insert({
      creator_id: profile.id,       // the OWNER (requester)
      project_id: projectId,
      work_type: workType,
      title: String(title).trim(),
      description: description?.trim() || null,
      price_usd: price,
      file_url: deliverable.media_url,
      file_type: deliverable.media_type,
      cover_image: coverImage ?? null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { id: data.id }
})
