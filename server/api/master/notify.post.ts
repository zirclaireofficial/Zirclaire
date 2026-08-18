// POST /api/master/notify   (Master)
// Push an in-site notification to an audience:
//   audience: 'all' | 'admins' | 'providers' | 'requesters' | 'selected'
//   (for 'selected', pass userIds: string[])
// Inserts one notification row per recipient (bulk). Runs as service role.
import { serviceClient, requireMaster } from '../../utils/auth'
import { logAction } from '../../utils/audit'

const AUDIENCES = ['all', 'admins', 'providers', 'requesters', 'selected'] as const

export default defineEventHandler(async (event) => {
  const master = await requireMaster(event)
  const body = await readBody(event)
  const audience = body?.audience as (typeof AUDIENCES)[number]
  const title = body?.title as string
  const message = body?.body as string | undefined
  const link = body?.link as string | undefined
  const userIds = body?.userIds as string[] | undefined

  if (!title || typeof title !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'title is required' })
  }
  if (!AUDIENCES.includes(audience)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid audience' })
  }

  const db = serviceClient(event)

  // Resolve recipients.
  let recipientIds: string[] = []
  if (audience === 'selected') {
    if (!Array.isArray(userIds) || !userIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'select at least one user' })
    }
    recipientIds = userIds
  } else {
    let q = db.from('profiles').select('id')
    if (audience === 'admins') q = q.in('role', ['admin', 'master'])
    else if (audience === 'providers') q = q.eq('role', 'service_provider')
    else if (audience === 'requesters') q = q.eq('role', 'service_requester')
    // 'all' -> no filter
    const { data } = await q
    recipientIds = (data ?? []).map((r: { id: string }) => r.id)
  }

  if (!recipientIds.length) return { sent: 0 }

  const rows = recipientIds.map((uid) => ({
    user_id: uid,
    type: 'announcement',
    title,
    body: message ?? null,
    link: link ?? null,
  }))

  // Insert in chunks so a very large audience doesn't hit payload limits.
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from('notifications').insert(rows.slice(i, i + CHUNK))
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  }

  await logAction(event, master, {
    action: 'notification.broadcast',
    target_type: 'notification',
    target_id: null,
    summary: `Sent "${title}" to ${recipientIds.length} ${audience === 'selected' ? 'selected user(s)' : audience}`,
  })

  return { sent: recipientIds.length }
})
