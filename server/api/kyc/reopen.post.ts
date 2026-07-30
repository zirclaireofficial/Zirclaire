// POST /api/kyc/reopen   { profileId }   (admin or master)
// Reverses a KYC rejection — puts the applicant back to 'pending' for another
// review. Only valid from 'rejected' (you don't "reopen" an approved member;
// that's suspension, a separate action).

import { serviceClient, requireStaff } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { profileId } = await readBody(event)
  if (!profileId) throw createError({ statusCode: 400, statusMessage: 'profileId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('profiles')
    .update({ kyc_status: 'pending', kyc_reject_reason: null })
    .eq('id', profileId)
    .eq('kyc_status', 'rejected')
    .select('id, kyc_status')
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { profile: data }
})
