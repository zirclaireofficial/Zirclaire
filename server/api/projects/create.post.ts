// POST /api/projects/create   (Service Requester)
// Creates a project already in 'submitted' state — i.e. sent to the admin
// for funding. Assign mode is supported via assigned_provider_id.

import { serviceClient } from '../../utils/auth'
import { requireApproved } from '../../utils/projects'

export default defineEventHandler(async (event) => {
  const profile = await requireApproved(event)
  if (profile.role !== 'service_requester') {
    throw createError({ statusCode: 403, statusMessage: 'Only requesters create projects' })
  }
  const b = await readBody(event)
  if (!b.title) throw createError({ statusCode: 400, statusMessage: 'title is required' })
  if (!b.budget_myr || b.budget_myr < 100 || b.budget_myr > 4000) {
    throw createError({ statusCode: 400, statusMessage: 'Budget must be between RM 100 and RM 4000' })
  }

  const db = serviceClient(event)
  const { data, error } = await db
    .from('projects')
    .insert({
      requester_id: profile.id,
      title: b.title,
      description: b.description ?? null,
      subcategory_id: b.subcategory_id ?? null,
      requirements: b.requirements ?? null,
      budget_myr: b.budget_myr,
      timeline_minutes: b.timeline_minutes ?? null,
      assigned_provider_id: b.assigned_provider_id ?? null,
      status: 'submitted',
    })
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  // Optional example attachments (Cloudinary references, uploaded client-side).
  if (Array.isArray(b.attachments) && b.attachments.length) {
    const rows = b.attachments
      .filter((a: { media_url?: string }) => a?.media_url)
      .map((a: { media_url: string; media_type?: string; label?: string }) => ({
        project_id: data.id,
        media_url: a.media_url,
        media_type: a.media_type ?? null,
        label: a.label ?? null,
      }))
    if (rows.length) await db.from('project_attachments').insert(rows)
  }

  return { project: data }
})
