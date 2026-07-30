// POST /api/messages/close-ticket   { conversationId }   (assigned admin or master)
// Closes a support ticket. An admin may close only a ticket they are handling;
// a master may close any. Recorded in the audit log.

import { serviceClient, requireStaff } from '../../utils/auth'
import { logAction } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  const { conversationId } = await readBody(event)
  if (!conversationId) throw createError({ statusCode: 400, statusMessage: 'conversationId is required' })

  const db = serviceClient(event)
  const { data: convo } = await db
    .from('conversations')
    .select('id, type, assigned_admin_id, ticket_number, closed_at')
    .eq('id', conversationId)
    .maybeSingle()
  if (!convo || convo.type !== 'support') throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  if (convo.closed_at) throw createError({ statusCode: 400, statusMessage: 'Ticket is already closed' })
  if (actor.role !== 'master' && convo.assigned_admin_id !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'You can only close tickets you are handling' })
  }

  const { data, error } = await db
    .from('conversations')
    .update({ closed_at: new Date().toISOString(), closed_by: actor.id })
    .eq('id', conversationId)
    .select()
    .single()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  await logAction(event, actor, {
    action: 'ticket.close',
    target_type: 'conversation',
    target_id: conversationId,
    summary: `Closed support ticket #${convo.ticket_number ?? '—'}`,
  })
  return { conversation: data }
})
