// POST /api/payments/claim   { projectId, method, reference? }   (SR, owns project)
// Records a (simulated) payment for a submitted project. Creates a `claimed`
// payment row — the admin verifies it before escrow is funded. No real charge.

import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'

const METHODS = ['binance', 'touch_n_go']

export default defineEventHandler(async (event) => {
  const { projectId, method, reference } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  if (!METHODS.includes(method)) throw createError({ statusCode: 400, statusMessage: 'invalid payment method' })

  const { project } = await requireProjectOwner(event, projectId)
  if (project.status !== 'submitted') {
    throw createError({ statusCode: 400, statusMessage: 'This project is not awaiting funding' })
  }

  const db = serviceClient(event)
  const { data, error } = await db
    .from('payments')
    .insert({
      project_id: projectId,
      payer_id: project.requester_id,
      method,
      amount_myr: project.budget_myr,
      reference: reference ?? null,
    })
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { payment: data }
})
