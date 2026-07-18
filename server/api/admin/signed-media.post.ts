// POST /api/admin/signed-media   { publicId, resourceType? }   (Admin)
// Returns a short signed URL to view a private (authenticated) Cloudinary asset,
// e.g. a KYC ID document. Admin-only.

import { requireAdmin } from '../../utils/auth'
import { signedDeliveryUrl } from '../../utils/cloudinary'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { publicId, resourceType } = await readBody(event)
  if (!publicId) throw createError({ statusCode: 400, statusMessage: 'publicId is required' })

  const config = useRuntimeConfig(event)
  const apiSecret = config.cloudinaryApiSecret as string
  const cloudName =
    (config.public as { cloudinary?: { cloudName?: string } })?.cloudinary?.cloudName ||
    process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!apiSecret || !cloudName) {
    throw createError({ statusCode: 500, statusMessage: 'Cloudinary is not configured' })
  }

  return { url: signedDeliveryUrl(publicId, cloudName, apiSecret, resourceType || 'image') }
})
