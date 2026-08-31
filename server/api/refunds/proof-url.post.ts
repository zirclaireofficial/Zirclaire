// POST /api/refunds/proof-url  { refundId }  (staff)
// Signed URL to view a paid refund's proof-of-payment (private upload).
import { serviceClient, requireStaff } from '../../utils/auth'
import { signedDeliveryUrl } from '../../utils/cloudinary'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { refundId } = await readBody(event)
  if (!refundId) throw createError({ statusCode: 400, statusMessage: 'refundId is required' })

  const db = serviceClient(event)
  const { data: r } = await db.from('refunds').select('proof_url').eq('id', refundId).maybeSingle()
  if (!r?.proof_url) throw createError({ statusCode: 404, statusMessage: 'No proof on file' })

  const config = useRuntimeConfig(event)
  const apiSecret = config.cloudinaryApiSecret as string
  const cloudName =
    (config.public as { cloudinary?: { cloudName?: string } })?.cloudinary?.cloudName ||
    process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!apiSecret || !cloudName) throw createError({ statusCode: 500, statusMessage: 'Cloudinary is not configured' })

  return { url: signedDeliveryUrl(r.proof_url, cloudName, apiSecret, 'image') }
})
