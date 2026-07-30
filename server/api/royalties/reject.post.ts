// POST /api/royalties/reject   { itemId, reason }   (Admin)
// Declines a pending royalty item, recording the reason so the creator knows why.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { itemId, reason } = await readBody(event)
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'itemId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('royalty_items')
    .update({
      status: 'rejected',
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: reason || null,
    })
    .eq('id', itemId)
    .eq('status', 'pending')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  await logAction(event, actor, {
    action: 'royalty.reject',
    target_type: 'royalty',
    target_id: itemId,
    summary: `Rejected royalty work "${data.title}"${reason ? ` — ${reason}` : ''}`,
  })
  return { item: data }
})
