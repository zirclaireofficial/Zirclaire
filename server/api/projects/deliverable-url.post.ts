// POST /api/projects/deliverable-url  { projectId }  (project party or staff)
// Short-lived signed URL to view the project's latest deliverable — the file is
// private, so this is the gate. Only the requester, the awarded provider, or
// staff may fetch it.
import { serviceClient, getCallerProfile } from '../../utils/auth'
import { signedDeliveryUrl } from '../../utils/cloudinary'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  const { projectId } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const db = serviceClient(event)
  const { data: project } = await db
    .from('projects').select('requester_id, awarded_provider_id').eq('id', projectId).maybeSingle()
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

  const isStaff = profile.role === 'admin' || profile.role === 'master'
  const isParty = project.requester_id === profile.id || project.awarded_provider_id === profile.id
  if (!isStaff && !isParty) throw createError({ statusCode: 403, statusMessage: 'Not your project' })

  const { data: d } = await db
    .from('deliverables').select('media_url, media_type')
    .eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle()
  if (!d) throw createError({ statusCode: 404, statusMessage: 'No deliverable submitted yet' })

  const config = useRuntimeConfig(event)
  const apiSecret = config.cloudinaryApiSecret as string
  const cloudName =
    (config.public as { cloudinary?: { cloudName?: string } })?.cloudinary?.cloudName ||
    process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!apiSecret || !cloudName) throw createError({ statusCode: 500, statusMessage: 'Cloudinary is not configured' })

  const resourceType = d.media_type === 'pdf' ? 'image' : d.media_type === 'video' ? 'video' : 'raw'
  return { url: signedDeliveryUrl(d.media_url, cloudName, apiSecret, resourceType), mediaType: d.media_type }
})
