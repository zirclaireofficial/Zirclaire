// Authorization helpers for project routes. The route decides WHO may act;
// the database function performs the atomic transition.

import type { H3Event } from 'h3'
import { serviceClient, getCallerProfile } from './auth'

/** Caller must be an approved user. */
export async function requireApproved(event: H3Event) {
  const profile = await getCallerProfile(event)
  if (profile.kyc_status !== 'approved') {
    throw createError({ statusCode: 403, statusMessage: 'Account not approved' })
  }
  return profile
}

export async function getProjectOr404(event: H3Event, projectId: string) {
  const db = serviceClient(event)
  const { data, error } = await db.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  return data
}

/** Caller must be the project's requester (owner). */
export async function requireProjectOwner(event: H3Event, projectId: string) {
  const profile = await requireApproved(event)
  const project = await getProjectOr404(event, projectId)
  if (project.requester_id !== profile.id) {
    throw createError({ statusCode: 403, statusMessage: 'Not your project' })
  }
  return { profile, project }
}

/** Caller must be the awarded provider on the project. */
export async function requireAwardedProvider(event: H3Event, projectId: string) {
  const profile = await requireApproved(event)
  const project = await getProjectOr404(event, projectId)
  if (project.awarded_provider_id !== profile.id) {
    throw createError({ statusCode: 403, statusMessage: 'Not the awarded provider' })
  }
  return { profile, project }
}
