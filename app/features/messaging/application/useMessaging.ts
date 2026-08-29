// messaging/application — repository wiring, privileged actions (opening a
// project thread, starting/claiming support), and the realtime helper.

import type { Database } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'
import { createSupabaseMessagingRepository, toMessage } from '../infrastructure'
import { canSend } from '../domain'
import type { Message, MessageAttachment } from '../domain'

export function useMessaging() {
  const supabase = useSupabaseClient<Database>()
  const repo = createSupabaseMessagingRepository(supabase)

  function sendMessage(conversationId: string, body: string, attachment?: MessageAttachment | null) {
    if (!canSend(body, !!attachment)) throw new Error('Write something or attach a file first.')
    return repo.sendMessage(conversationId, body, attachment)
  }

  /** Get a short-lived signed URL to view/download a message's attachment. */
  function attachmentUrl(messageId: string) {
    return authedFetch<{ url: string }>('/api/messages/attachment-url', {
      method: 'POST',
      body: { messageId },
    })
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
   *  ticket, or opens a new one if their last ticket is closed. Returns the
   *  saved message so the UI can show it immediately. */
  async function supportSend(body: string, attachment?: MessageAttachment | null) {
    const res = await authedFetch<{ conversationId: string; ticketNumber: number | null; message: any }>(
      '/api/messages/support-send',
      { method: 'POST', body: { body, attachment } },
    )
    return { ...res, message: toMessage(res.message) as Message }
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
        (payload) => onInsert(toMessage(payload.new)),
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
    attachmentUrl,
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
