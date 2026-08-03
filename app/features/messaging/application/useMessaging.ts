// messaging/application — repository wiring, privileged actions (opening a
// project thread, starting/claiming support), and the realtime helper.

import type { Database } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'
import { createSupabaseMessagingRepository } from '../infrastructure'
import { canSend } from '../domain'
import type { Message } from '../domain'

export function useMessaging() {
  const supabase = useSupabaseClient<Database>()
  const repo = createSupabaseMessagingRepository(supabase)

  function sendMessage(conversationId: string, body: string) {
    if (!canSend(body)) throw new Error('Write something first.')
    return repo.sendMessage(conversationId, body)
  }

  /** Get-or-create the buyer↔provider thread for a project/order (server). */
  function openProjectThread(projectId: string) {
    return authedFetch<{ conversation: { id: string } }>('/api/messages/open-project', {
      method: 'POST',
      body: { projectId },
    })
  }

  /** Get-or-create the caller's service-desk thread (server). */
  function openSupportThread() {
    return authedFetch<{ conversation: { id: string } }>('/api/messages/open-support', { method: 'POST' })
  }

  /** Ask the AI assistant to respond in a support thread (best-effort). */
  function botReply(conversationId: string) {
    return authedFetch<{ action?: string; skipped?: boolean }>('/api/ai/support-reply', {
      method: 'POST',
      body: { conversationId },
    })
  }

  /** Send a service-desk message — the server routes it to the member's open
   *  ticket, or opens a new one if their last ticket is closed. */
  function supportSend(body: string) {
    return authedFetch<{ conversationId: string; ticketNumber: number | null }>('/api/messages/support-send', {
      method: 'POST',
      body: { body },
    })
  }

  /**
   * Live messages for one conversation. Returns an unsubscribe function.
   * Supabase realtime pushes new rows; RLS still applies to the stream.
   */
  function subscribe(conversationId: string, onInsert: (m: Message) => void) {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => onInsert(payload.new as Message),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }

  return {
    listConversations: () => repo.listConversations(),
    listMessages: (id: string) => repo.listMessages(id),
    markRead: (id: string) => repo.markRead(id),
    supportQueue: () => repo.supportQueue(),
    oversight: () => repo.oversight(),
    myTickets: () => repo.myTickets(),
    sendMessage,
    openProjectThread,
    openSupportThread,
    botReply,
    supportSend,
    subscribe,
  }
}

/** Staff: claim a support thread out of the shared queue, or close a ticket. */
export function useSupportModeration() {
  function claim(conversationId: string) {
    return authedFetch<{ conversation: { id: string } }>('/api/messages/claim-support', {
      method: 'POST',
      body: { conversationId },
    })
  }
  function close(conversationId: string) {
    return authedFetch<{ conversation: { id: string } }>('/api/messages/close-ticket', {
      method: 'POST',
      body: { conversationId },
    })
  }
  return { claim, close }
}
