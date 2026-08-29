// POST /api/cancellations/message  { requestId, body, party? }
// The private dispute chat. A party writes to their own channel; staff write to
// a named party's channel as "Zirclaire Review Team" (users never see tiers).
import { serviceClient, getCallerProfile } from '../../utils/auth'
import { notify, notifyRoles } from '../../utils/notify'

const ATTACH_TYPES = ['image', 'pdf', 'file']

export default defineEventHandler(async (event) => {
  const { requestId, body, party, attachment } = await readBody(event)
  const text = body ? String(body).trim() : ''
  const hasAttachment = attachment && typeof attachment.url === 'string'
  if (!requestId || (!text && !hasAttachment)) {
    throw createError({ statusCode: 400, statusMessage: 'requestId and a message or attachment are required' })
  }
  if (hasAttachment && !ATTACH_TYPES.includes(attachment.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid attachment type' })
  }
  const profile = await getCallerProfile(event)
  const db = serviceClient(event)

  const { data: req } = await db
    .from('cancellation_requests')
    .select('requested_by, provider_id, projects(title)')
    .eq('id', requestId)
    .single()
  if (!req) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  const r = req as unknown as { requested_by: string; provider_id: string | null; projects: { title: string } | null }
  const title = r.projects?.title ?? 'your project'

  const isStaff = profile.role === 'admin' || profile.role === 'master'
  let channel: 'requester' | 'provider'
  let side: 'platform' | 'user'

  if (isStaff) {
    if (party !== 'requester' && party !== 'provider') {
      throw createError({ statusCode: 400, statusMessage: 'party is required (requester|provider)' })
    }
    channel = party
    side = 'platform'
  } else if (profile.id === r.requested_by) {
    channel = 'requester'; side = 'user'
  } else if (profile.id === r.provider_id) {
    channel = 'provider'; side = 'user'
  } else {
    throw createError({ statusCode: 403, statusMessage: 'Not a party to this request' })
  }

  const { error } = await db.from('dispute_messages').insert({
    request_id: requestId, party: channel, sender_side: side, sender_id: profile.id, body: text,
    attachment_url: hasAttachment ? attachment.url : null,
    attachment_type: hasAttachment ? attachment.type : null,
    attachment_name: hasAttachment ? (attachment.name ?? null) : null,
  })
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Notify the other end.
  if (side === 'platform') {
    const target = channel === 'requester' ? r.requested_by : r.provider_id
    if (target) {
      await notify(db, target, {
        type: 'dispute_message',
        title: 'Zirclaire Review Team',
        body: `New message about "${title}".`,
        link: '/projects',
      })
    }
  } else {
    await notifyRoles(db, ['admin', 'master'], {
      type: 'dispute_message',
      title: 'New dispute message',
      body: `A party replied in the review of "${title}".`,
      link: '/admin/cancellations',
    })
  }
  return { ok: true }
})
