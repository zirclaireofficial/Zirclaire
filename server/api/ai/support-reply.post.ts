// POST /api/ai/support-reply   { conversationId }   (the ticket owner)
// The service-desk assistant. Triggered after the member posts in their own
// support ticket. It is grounded on the knowledge base and a SAFE summary of
// the member's own records, and it can do exactly one thing: post a reply, or
// escalate to a human.
//
// Hard limits (by design):
//   * Read-only. It never writes to or changes any customer data.
//   * It only answers what the KB / provided context covers; anything else,
//     any request to take an action, or any uncertainty -> escalate.
//   * It is never given passwords, ID documents, phone numbers, or bank /
//     payout details. Those columns are simply not selected.
//   * A per-day call cap stops runaway spend; past the cap it escalates.

import { serviceClient, requireUser } from '../../utils/auth'
import { deepseekChat } from '../../utils/deepseek'

const DAILY_CALL_CAP = 1000

const ESCALATION_TEXT =
  'I can’t resolve that one myself, so I’ve passed your ticket to a support agent. They’ll reply here shortly.'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { conversationId } = await readBody(event)
  if (!conversationId) throw createError({ statusCode: 400, statusMessage: 'conversationId is required' })

  const db = serviceClient(event)

  const { data: convo } = await db
    .from('conversations')
    .select('id, type, created_by, assigned_admin_id, closed_at, escalated_at')
    .eq('id', conversationId)
    .maybeSingle()
  if (!convo || convo.type !== 'support') throw createError({ statusCode: 404, statusMessage: 'Not a support ticket' })
  if (convo.created_by !== user.id) throw createError({ statusCode: 403, statusMessage: 'Not your ticket' })

  // The bot only acts while no human has taken over and it hasn't already
  // escalated or been closed.
  if (convo.assigned_admin_id || convo.closed_at || convo.escalated_at) {
    return { skipped: true }
  }

  const escalate = async () => {
    await db.from('messages').insert({ conversation_id: conversationId, sender_id: null, body: ESCALATION_TEXT, is_system: true })
    await db.from('conversations').update({ escalated_at: new Date().toISOString() }).eq('id', conversationId)
    return { action: 'escalate' as const }
  }

  // --- spend guard ---
  const today = new Date().toISOString().slice(0, 10)
  const { data: usage } = await db.from('ai_usage').select('calls').eq('day', today).maybeSingle()
  if ((usage?.calls ?? 0) >= DAILY_CALL_CAP) return escalate()

  // --- context: knowledge base ---
  const { data: kb } = await db.from('kb').select('category, question, answer').eq('is_active', true)
  const kbText = (kb ?? []).map((k) => `[${k.category}] Q: ${k.question}\nA: ${k.answer}`).join('\n\n')

  // --- context: SAFE member summary (no passwords / bank / ID / phone) ---
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, member_id, role, kyc_status, is_suspended')
    .eq('id', user.id)
    .single()
  const { data: myProjects } = await db
    .from('projects')
    .select('title, status, budget_usd')
    .or(`requester_id.eq.${user.id},awarded_provider_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(10)
  const memberSummary = [
    `Name: ${profile?.full_name}`,
    `Member ID: ${profile?.member_id ?? 'not issued yet'}`,
    `Role: ${profile?.role}`,
    `Account status: ${profile?.is_suspended ? 'suspended' : profile?.kyc_status}`,
    `Their projects: ${(myProjects ?? []).map((p) => `"${p.title}" (${p.status}, $${p.budget_usd})`).join('; ') || 'none'}`,
  ].join('\n')

  // --- context: recent transcript ---
  const { data: msgs } = await db
    .from('messages')
    .select('sender_id, body, is_system')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20)
  const transcript = (msgs ?? []).map((m) => {
    const who = m.is_system ? 'Assistant' : m.sender_id === user.id ? 'Member' : 'Agent'
    return `${who}: ${m.body}`
  }).join('\n')

  const system = `You are Zirclaire's service-desk assistant. Reply in JSON only.

How to behave:
- If the member just greets you or their message is vague, short, or incomplete, do NOT escalate. Reply warmly and ask them to describe their issue — what happened and what they were trying to do. (action: "reply")
- If their question is answered by the Knowledge base or the Member summary, answer it concisely and formally. (action: "reply")
- Escalate to a human ONLY when one of these is true: they ask you to DO something (refund, cancel, change/unlock/fix their account, edit details); the issue is specific to their account beyond the summary below; they explicitly ask for a human; or you genuinely cannot help from the information provided even after they've explained. (action: "escalate")

Hard limits:
- Use ONLY the Knowledge base and Member summary. Never use outside knowledge or guess.
- You cannot perform actions or change anything, and you do not have passwords, bank/payout details, or ID documents.

Respond with a JSON object: {"action": "reply" | "escalate", "message": "<your message to the member>"}.
- "reply": answering a question, greeting them, or asking them to explain more.
- "escalate": handing to a human — put a short, polite hand-off line in "message".

Knowledge base:
${kbText}

Member summary:
${memberSummary}`

  // Count the call (best-effort upsert) before making it.
  await db.from('ai_usage').upsert(
    { day: today, calls: (usage?.calls ?? 0) + 1 },
    { onConflict: 'day' },
  )

  let parsed: { action?: string; message?: string } = {}
  try {
    const result = await deepseekChat(
      event,
      [
        { role: 'system', content: system },
        { role: 'user', content: `Conversation so far:\n${transcript}\n\nWrite the assistant's next reply as JSON.` },
      ],
      { json: true, maxTokens: 400, temperature: 0.3 },
    )
    parsed = JSON.parse(result.content)
  } catch {
    return escalate() // any API/parse failure -> hand to a human, never guess
  }

  // Only a genuine escalation hands off to a human. A "reply" (answer, greeting,
  // or a request for more detail) just posts and keeps the bot available.
  if (!parsed.message?.trim()) return escalate()
  if (parsed.action === 'escalate') return escalate()

  await db.from('messages').insert({
    conversation_id: conversationId,
    sender_id: null,
    body: parsed.message.trim(),
    is_system: true,
  })
  return { action: 'reply' }
})
