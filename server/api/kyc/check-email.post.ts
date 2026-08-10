// POST /api/kyc/check-email   { email }   (public, pre-signup)
// Tells the signup form whether an account already exists for this email, so it
// can block a second account on the same address before sending a code.

import { serviceClient } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)
  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'email is required' })
  }
  const db = serviceClient(event)
  const { data } = await db
    .from('profiles')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle()
  return { exists: !!data }
})
