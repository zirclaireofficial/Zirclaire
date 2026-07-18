// POST /api/media/sign   { purpose }
// Returns a short-lived Cloudinary upload signature for a specific purpose
// (which fixes the destination folder + access mode). The browser then uploads
// the file directly to Cloudinary using these values.
//
// Authorization by purpose:
//   kyc / profile          -> any authenticated user (needed during signup,
//                             before approval).
//   post                   -> approved Service Provider.
//   deliverable            -> approved Service Provider.
//   project-attachment     -> approved Service Requester.

import { requireUser, getCallerProfile } from '../../utils/auth'
import { signParams, MEDIA_PURPOSES, type MediaPurpose } from '../../utils/cloudinary'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { purpose } = await readBody(event)
  const cfg = MEDIA_PURPOSES[purpose as MediaPurpose]
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'invalid or missing purpose' })

  // Purpose-specific authorization.
  if (purpose === 'post' || purpose === 'deliverable' || purpose === 'project-attachment') {
    const profile = await getCallerProfile(event)
    if (profile.kyc_status !== 'approved') {
      throw createError({ statusCode: 403, statusMessage: 'Account not approved' })
    }
    if ((purpose === 'post' || purpose === 'deliverable') && profile.role !== 'service_provider') {
      throw createError({ statusCode: 403, statusMessage: 'Providers only' })
    }
    if (purpose === 'project-attachment' && profile.role !== 'service_requester') {
      throw createError({ statusCode: 403, statusMessage: 'Requesters only' })
    }
  }

  const config = useRuntimeConfig(event)
  const apiKey = config.cloudinaryApiKey as string
  const apiSecret = config.cloudinaryApiSecret as string
  const cloudName =
    (config.public as any)?.cloudinary?.cloudName ||
    process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!apiKey || !apiSecret || !cloudName) {
    throw createError({ statusCode: 500, statusMessage: 'Cloudinary is not configured' })
  }

  const timestamp = Math.round(Date.now() / 1000)
  const paramsToSign: Record<string, string | number> = {
    folder: cfg.folder,
    timestamp,
  }
  if (cfg.private) paramsToSign.access_mode = 'authenticated'

  const signature = signParams(paramsToSign, apiSecret)

  // The client must send exactly these signed params (plus api_key + file) to
  // the upload URL, or Cloudinary will reject the signature.
  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder: cfg.folder,
    accessMode: cfg.private ? 'authenticated' : 'public',
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
  }
})
