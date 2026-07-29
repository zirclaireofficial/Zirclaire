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
  sender_id: string
  body: string
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

/** A thread awaiting an admin in the support queue. */
export interface SupportTicket {
  id: string
  created_by: string | null
  last_message_at: string | null
  assigned_admin_id: string | null
  requester: PartyRef | null
  preview: string | null
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
}
