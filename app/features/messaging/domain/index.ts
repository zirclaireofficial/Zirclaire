// messaging/domain — pure types, rules, and ports for direct messaging.
// NO imports of Nuxt, Supabase, or any other layer.

export type ConversationType = 'project' | 'support'

export interface PartyRef {
  id: string
  member_id: string | null
  full_name: string | null
  profile_picture: string | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null // null for automated (bot) messages
  body: string
  is_system: boolean
  created_at: string
}

/** A thread as it appears in the inbox list. */
export interface ConversationSummary {
  id: string
  type: ConversationType
  project_id: string | null
  project_title: string | null
  assigned_admin_id: string | null
  last_message_at: string | null
  last_read_at: string | null
  /** The other party (for a 1:1 project thread) or null for support. */
  counterpart: PartyRef | null
  unread: boolean
}

/** A support ticket — used by both the live queue and the open/closed log. */
export interface SupportTicket {
  id: string
  ticket_number: number | null
  created_by: string | null
  last_message_at: string | null
  assigned_admin_id: string | null
  closed_at: string | null
  requester: PartyRef | null
  handler: PartyRef | null // the admin handling it, once claimed
  preview: string | null
}

export function isTicketOpen(t: SupportTicket): boolean {
  return !t.closed_at
}

/** One of the member's own tickets, with its messages — for the continuous
 *  service-desk view where tickets are shown in sequence, divided by a line. */
export interface SupportTicketThread {
  id: string
  ticket_number: number | null
  closed_at: string | null
  created_at: string
  messages: Message[]
}

/** A thread in the master's oversight list (any type, any participants). */
export interface OversightThread {
  id: string
  type: ConversationType
  ticket_number: number | null
  project_title: string | null
  assigned_admin_id: string | null
  last_message_at: string | null
  participants: PartyRef[]
  preview: string | null
}

/** Human-facing ticket label, e.g. "#1042". */
export function ticketLabel(n: number | null): string {
  return n ? `#${n}` : '#—'
}

// --- Rules -----------------------------------------------------------------

export function canSend(body: string): boolean {
  return body.trim().length > 0
}

/** Is a message unread for this viewer? (Their own messages never count.) */
export function isUnread(msgAt: string | null, lastReadAt: string | null): boolean {
  if (!msgAt) return false
  if (!lastReadAt) return true
  return new Date(msgAt).getTime() > new Date(lastReadAt).getTime()
}

export function conversationTitle(c: ConversationSummary): string {
  if (c.type === 'support') return 'Service desk'
  return c.counterpart?.full_name || c.project_title || 'Conversation'
}

// --- Port ------------------------------------------------------------------

export interface MessagingRepository {
  listConversations(): Promise<ConversationSummary[]>
  listMessages(conversationId: string): Promise<Message[]>
  sendMessage(conversationId: string, body: string): Promise<Message>
  markRead(conversationId: string): Promise<void>
  /** Admin: the shared support queue (unclaimed + own claimed). */
  supportQueue(): Promise<SupportTicket[]>
  /** Master: every conversation on the platform, for oversight. */
  oversight(): Promise<OversightThread[]>
  /** The member's own support tickets, each with its messages (continuous view). */
  myTickets(): Promise<SupportTicketThread[]>
}
