// POST /api/kyc/reject   { profileId, reason }
// Admin rejects a pending profile, recording the reason. No member_id is issued.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { profileId, reason } = await readBody(event)
  if (!profileId) throw createError({ statusCode: 400, statusMessage: 'profileId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('profiles')
    .update({
      kyc_status: 'rejected',
      kyc_reject_reason: reason ?? null,
      kyc_reviewed_by: admin.id,
      kyc_reviewed_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .eq('kyc_status', 'pending')
    .select()
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: `Reject failed (is it still pending?): ${error.message}` })
  return { profile: data }
})
