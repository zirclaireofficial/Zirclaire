// GET /api/master/audit?limit=100   (Master)
// The audit trail, newest first, with each actor's name/member id resolved.

import { serviceClient, requireMaster } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireMaster(event)
  const q = getQuery(event)
  const limit = Math.min(Number(q.limit) || 100, 300)

  const db = serviceClient(event)
  const { data: entries, error } = await db
    .from('audit_log')
    .select('id, actor_id, actor_role, action, target_type, target_id, summary, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  const actorIds = [...new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean))] as string[]
  const actors: Record<string, { full_name: string; member_id: string | null }> = {}
  if (actorIds.length) {
    const { data: profs } = await db.from('profiles').select('id, full_name, member_id').in('id', actorIds)
    for (const p of profs ?? []) actors[p.id] = { full_name: p.full_name, member_id: p.member_id }
  }

  return {
    entries: (entries ?? []).map((e) => ({
      ...e,
      actor: e.actor_id ? actors[e.actor_id] ?? null : null,
    })),
  }
})
