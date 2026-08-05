// POST /api/messages/support-send   { body }   (any signed-in member)
// The member's service-desk send. Routes the message to their currently OPEN
// ticket, or opens a NEW ticket if their last one is closed (or they have
// none). This is why support messages go through the server rather than a
// direct insert: the server decides which ticket the message belongs to.

import { serviceClient, requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { body } = await readBody(event)
  if (!body || !String(body).trim()) throw createError({ statusCode: 400, statusMessage: 'Message is required' })

  const db = serviceClient(event)

  // start_support_conversation resumes an open ticket or opens a fresh one.
  const { data: convo, error: cErr } = await db.rpc('start_support_conversation', { p_actor: user.id })
  if (cErr || !convo) throw createError({ statusCode: 400, statusMessage: cErr?.message ?? 'Could not open a ticket' })

  const { data: message, error: mErr } = await db
    .from('messages')
    .insert({ conversation_id: convo.id, sender_id: user.id, body: String(body).trim() })
    .select('id, conversation_id, sender_id, body, is_system, created_at')
    .single()
  if (mErr) throw createError({ statusCode: 400, statusMessage: mErr.message })

  return { conversationId: convo.id, ticketNumber: convo.ticket_number, message }
})
