// POST /api/payouts/proof-url  { payoutId }  (staff)
// Signed URL to view a paid payout's proof-of-payment (private upload).
import { serviceClient, requireStaff } from '../../utils/auth'
import { signedDeliveryUrl } from '../../utils/cloudinary'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { payoutId } = await readBody(event)
  if (!payoutId) throw createError({ statusCode: 400, statusMessage: 'payoutId is required' })

  const db = serviceClient(event)
  const { data: p } = await db.from('payouts').select('proof_url').eq('id', payoutId).maybeSingle()
  if (!p?.proof_url) throw createError({ statusCode: 404, statusMessage: 'No proof on file' })

  const config = useRuntimeConfig(event)
  const apiSecret = config.cloudinaryApiSecret as string
  const cloudName =
    (config.public as { cloudinary?: { cloudName?: string } })?.cloudinary?.cloudName ||
    process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!apiSecret || !cloudName) throw createError({ statusCode: 500, statusMessage: 'Cloudinary is not configured' })

  return { url: signedDeliveryUrl(p.proof_url, cloudName, apiSecret, 'image') }
})
