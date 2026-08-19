// POST /api/cancellations/message  { requestId, body, party? }
// The private dispute chat. A party writes to their own channel; staff write to
// a named party's channel as "Zirclaire Review Team" (users never see tiers).
import { serviceClient, getCallerProfile } from '../../utils/auth'
import { notify, notifyRoles } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { requestId, body, party } = await readBody(event)
  if (!requestId || !body || !String(body).trim()) {
    throw createError({ statusCode: 400, statusMessage: 'requestId and body are required' })
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
    request_id: requestId, party: channel, sender_side: side, sender_id: profile.id, body: String(body).trim(),
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
