// POST /api/kyc/signup
// Creates the caller's profile row after they've signed up via Supabase Auth.
// The client uploads ID image + profile picture to Cloudinary first and passes
// the resulting references here. Profile starts as kyc_status = 'pending'.

import { serviceClient, requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  // Role: public signup is SR or SP only. Admins are provisioned internally.
  if (body.role !== 'service_requester' && body.role !== 'service_provider') {
    throw createError({ statusCode: 400, statusMessage: 'role must be service_requester or service_provider' })
  }
  if (!body.full_name || typeof body.full_name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'full_name is required' })
  }

  const db = serviceClient(event)

  // One profile per user.
  const { data: existing } = await db.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Profile already exists' })
  }

  const { data, error } = await db
    .from('profiles')
    .insert({
      id: user.id,
      role: body.role,
      full_name: body.full_name,
      email: user.email!,
      phone: body.phone ?? null,
      home_address: body.home_address ?? null,
      id_document_number: body.id_document_number ?? null,
      country_id: body.country_id ?? null,
      payout_provider: body.payout_provider ?? null,
      payout_account: body.payout_account ?? null,
      id_document_image: body.id_document_image ?? null,
      profile_picture: body.profile_picture ?? null,
      // kyc_status defaults to 'pending'; member_id stays null until approval
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { profile: data }
})
