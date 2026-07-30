// POST /api/kyc/approve   { profileId }
// Admin approves a pending profile. Flipping kyc_status to 'approved' fires the
// database trigger that generates the localized member_id (e.g. MYRSR00001),
// so the returned profile already carries it.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { profileId } = await readBody(event)
  if (!profileId) throw createError({ statusCode: 400, statusMessage: 'profileId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('profiles')
    .update({
      kyc_status: 'approved',
      kyc_reviewed_by: actor.id,
      kyc_reviewed_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .eq('kyc_status', 'pending') // only pending profiles can be approved
    .select()
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: `Approve failed (is it still pending?): ${error.message}` })
  await logAction(event, actor, {
    action: 'kyc.approve',
    target_type: 'profile',
    target_id: profileId,
    summary: `Approved ${data.full_name} (${data.member_id})`,
  })
  return { profile: data }
})
