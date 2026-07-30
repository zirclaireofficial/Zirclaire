// POST /api/royalties/unpublish   { itemId }   (admin or master)
// Reverses a royalty approval — pulls the work from the store (status back to
// 'pending'). Existing purchases are unaffected. Fully reversible: approving
// again re-lists it.

import { serviceClient, requireStaff } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { itemId } = await readBody(event)
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'itemId is required' })

  const db = serviceClient(event)
  const { data, error } = await db
    .from('royalty_items')
    .update({ status: 'pending' })
    .eq('id', itemId)
    .eq('status', 'approved')
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { item: data }
})
