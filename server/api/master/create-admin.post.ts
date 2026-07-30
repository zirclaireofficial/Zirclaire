// POST /api/master/create-admin   { email, password, fullName }   (Master)
// The central point where admin accounts are made. Creates the auth user via
// GoTrue's admin API (auto-confirmed), then an approved admin profile so the
// member-ID trigger issues ADMxxxxx. Only the master may do this.

import { serviceClient, requireMaster } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const master = await requireMaster(event)
  const { email, password, fullName } = await readBody(event)

  if (!email || !password || !fullName) {
    throw createError({ statusCode: 400, statusMessage: 'email, password and fullName are required' })
  }
  if (String(password).length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  const db = serviceClient(event)

  // 1) Create the auth user (confirmed, no email step).
  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email: String(email).toLowerCase(),
    password: String(password),
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (authErr || !created.user) {
    throw createError({ statusCode: 400, statusMessage: authErr?.message ?? 'Could not create the auth user' })
  }
  const uid = created.user.id

  // 2) Profile as admin — pending first, then approved so the trigger issues
  //    the ADM member id.
  const { error: pErr } = await db
    .from('profiles')
    .insert({ id: uid, role: 'admin', full_name: fullName, email: String(email).toLowerCase(), kyc_status: 'pending' })
  if (pErr) {
    // Roll back the auth user so a failed profile doesn't strand an account.
    await db.auth.admin.deleteUser(uid)
    throw createError({ statusCode: 400, statusMessage: pErr.message })
  }
  const { data: profile, error: aErr } = await db
    .from('profiles')
    .update({ kyc_status: 'approved', kyc_reviewed_by: master.id, kyc_reviewed_at: new Date().toISOString() })
    .eq('id', uid)
    .select('id, member_id, full_name, email')
    .single()
  if (aErr) throw createError({ statusCode: 400, statusMessage: aErr.message })

  await logAction(event, master, {
    action: 'admin.create',
    target_type: 'profile',
    target_id: uid,
    summary: `Created admin ${profile.full_name} (${profile.member_id})`,
  })

  return { profile }
})
