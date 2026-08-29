// POST /api/messages/attachment-url   { messageId }
// Returns a short-lived signed URL to view/download a message's private
// attachment — but only to a participant of that conversation (or staff).
// The attachment public_id never leaves the server otherwise.

import { serviceClient, getCallerProfile } from '../../utils/auth'
import { signedDeliveryUrl } from '../../utils/cloudinary'

export default defineEventHandler(async (event) => {
  const profile = await getCallerProfile(event)
  const { messageId } = await readBody(event)
  if (!messageId) throw createError({ statusCode: 400, statusMessage: 'messageId is required' })

  const db = serviceClient(event)
  const { data: msg } = await db
    .from('messages')
    .select('id, conversation_id, attachment_url, attachment_type')
    .eq('id', messageId)
    .maybeSingle()
  if (!msg || !msg.attachment_url) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  // Entitlement: staff can always view; otherwise the caller must be a
  // participant of the conversation (project threads) or the member who
  // opened it (support tickets).
  const isStaff = profile.role === 'admin' || profile.role === 'master'
  let entitled = isStaff
  if (!entitled) {
    const { count } = await db
      .from('conversation_participants')
      .select('user_id', { count: 'exact', head: true })
      .eq('conversation_id', msg.conversation_id)
      .eq('user_id', profile.id)
    entitled = (count ?? 0) > 0
  }
  if (!entitled) {
    const { data: convo } = await db
      .from('conversations')
      .select('created_by')
      .eq('id', msg.conversation_id)
      .maybeSingle()
    entitled = convo?.created_by === profile.id
  }
  if (!entitled) {
    throw createError({ statusCode: 403, statusMessage: 'Not your conversation' })
  }

  const config = useRuntimeConfig(event)
  const apiSecret = config.cloudinaryApiSecret as string
  const cloudName =
    (config.public as { cloudinary?: { cloudName?: string } })?.cloudinary?.cloudName ||
    process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!apiSecret || !cloudName) {
    throw createError({ statusCode: 500, statusMessage: 'Cloudinary is not configured' })
  }

  // Images + PDFs deliver as 'image' on Cloudinary; other docs as 'raw'.
  const resourceType = msg.attachment_type === 'file' ? 'raw' : 'image'
  return { url: signedDeliveryUrl(msg.attachment_url, cloudName, apiSecret, resourceType) }
})
