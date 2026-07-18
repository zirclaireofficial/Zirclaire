// POST /api/projects/fund   { projectId, amount }   (Admin)
// Confirms escrow funding: submitted → funded, records the fund ledger entry.

import { serviceClient, requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { projectId, amount } = await readBody(event)
  if (!projectId || !amount || amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'projectId and a positive amount are required' })
  }

  const db = serviceClient(event)
  const { data, error } = await db.rpc('fund_project', {
    p_project: projectId,
    p_amount: amount,
    p_actor: admin.id,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { project: data }
})
