// POST /api/cancellations/attachment-url   { messageId }
// Short-lived signed URL for a dispute-message attachment — only for a party to
// the request (their own channel) or staff. Mirrors the read RLS on
// dispute_messages so a party can't peek at the other channel.

import { serviceClient, getCallerProfile } from '../../utils/auth'
import { signedDeliveryUrl } from '../../utils/cloudinary'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  const { messageId } = await readBody(event)
  if (!messageId) throw createError({ statusCode: 400, statusMessage: 'messageId is required' })

  const db = serviceClient(event)
  const { data: msg } = await db
    .from('dispute_messages')
    .select('id, request_id, party, attachment_url, attachment_type')
    .eq('id', messageId)
    .maybeSingle()
  if (!msg || !msg.attachment_url) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  const isStaff = profile.role === 'admin' || profile.role === 'master'
  let entitled = isStaff
  if (!entitled) {
    const { data: req } = await db
      .from('cancellation_requests')
      .select('requested_by, provider_id')
      .eq('id', msg.request_id)
      .maybeSingle()
    // A party may only see the attachment in THEIR channel.
    entitled =
      (msg.party === 'requester' && req?.requested_by === profile.id) ||
      (msg.party === 'provider' && req?.provider_id === profile.id)
  }
  if (!entitled) {
    throw createError({ statusCode: 403, statusMessage: 'Not your dispute channel' })
  }

  const config = useRuntimeConfig(event)
  const apiSecret = config.cloudinaryApiSecret as string
  const cloudName =
    (config.public as { cloudinary?: { cloudName?: string } })?.cloudinary?.cloudName ||
    process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!apiSecret || !cloudName) {
    throw createError({ statusCode: 500, statusMessage: 'Cloudinary is not configured' })
  }

  const resourceType = msg.attachment_type === 'file' ? 'raw' : 'image'
  return { url: signedDeliveryUrl(msg.attachment_url, cloudName, apiSecret, resourceType) }
})
