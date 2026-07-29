// POST /api/royalties/approve   { itemId }   (Admin)
// Publishes a pending royalty item — flips status to 'approved', which makes
// it appear in the public royalty_store view. Mirrors KYC approval.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { itemId } = await readBody(event)
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'itemId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('royalty_items')
    .update({ status: 'approved', reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('status', 'pending')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { item: data }
})
