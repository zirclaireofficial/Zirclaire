// POST /api/royalties/download   { itemId }   (buyer / creator / admin)
// Returns a short-lived signed URL to the private downloadable file — but only
// after proving the caller is entitled to it. This is the gate that makes
// "buy once to download" real: the file_url never leaves the server otherwise.

import { serviceClient, getCallerProfile } from '../../utils/auth'
import { signedDeliveryUrl } from '../../utils/cloudinary'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  const { itemId } = await readBody(event)
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'itemId is required' })

  const db = serviceClient(event)
  const { data: item, error } = await db
    .from('royalty_items')
    .select('id, creator_id, file_url, file_type')
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Item not found' })

  // Entitlement: the creator and admins always; a buyer needs a purchase row.
  const isCreator = item.creator_id === profile.id
  const isAdmin = profile.role === 'admin'
  let entitled = isCreator || isAdmin
  if (!entitled) {
    const { count } = await db
      .from('royalty_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('item_id', itemId)
      .eq('buyer_id', profile.id)
    entitled = (count ?? 0) > 0
  }
  if (!entitled) {
    throw createError({ statusCode: 403, statusMessage: 'Purchase this work to download it' })
  }

  const config = useRuntimeConfig(event)
  const apiSecret = config.cloudinaryApiSecret as string
  const cloudName =
    (config.public as { cloudinary?: { cloudName?: string } })?.cloudinary?.cloudName ||
    process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!apiSecret || !cloudName) {
    throw createError({ statusCode: 500, statusMessage: 'Cloudinary is not configured' })
  }

  // Documents (PDF/EPUB) live under Cloudinary's 'raw'/'image' types; the
  // stored file was uploaded via the 'auto' endpoint, so use resource type
  // that matches. PDFs deliver as 'image' on Cloudinary; other docs as 'raw'.
  const resourceType = item.file_type === 'pdf' ? 'image' : 'raw'
  return { url: signedDeliveryUrl(item.file_url, cloudName, apiSecret, resourceType) }
})
