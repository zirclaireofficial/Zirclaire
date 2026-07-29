// messaging/infrastructure — the ONLY place that talks to Supabase for
// messaging. Reads conversations/messages via RLS (which already limits rows
// to participants and support-queue admins) and sends messages as a safe
// client write. Realtime subscription lives in the application layer.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/shared/types/database'
import type {
  MessagingRepository,
  ConversationSummary,
  Message,
  SupportTicket,
  PartyRef,
} from '../domain'

type Loose = SupabaseClient<Database> & { from: (t: string) => any }

export function createSupabaseMessagingRepository(client: SupabaseClient<Database>): MessagingRepository {
  const supabase = client as Loose

  async function currentUserId(): Promise<string | null> {
    const { data } = await client.auth.getSession()
    return data.session?.user?.id ?? null
  }

  async function fetchParties(ids: string[]): Promise<Map<string, PartyRef>> {
    const unique = [...new Set(ids)].filter(Boolean)
    if (!unique.length) return new Map()
    const { data } = await supabase
      .from('public_profiles')
      .select('id, member_id, full_name, profile_picture')
      .in('id', unique)
    return new Map((data ?? []).map((p: any) => [p.id as string, p as PartyRef]))
  }

  return {
    async listConversations(): Promise<ConversationSummary[]> {
      const uid = await currentUserId()
      if (!uid) return []

      // RLS returns the caller's threads (and, for admins, support-queue ones).
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('id, type, project_id, assigned_admin_id, last_message_at')
        .order('last_message_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      const rows = convos ?? []
      if (!rows.length) return []

      const ids = rows.map((c: any) => c.id)
      const [{ data: myParts }, { data: allParts }, { data: projects }] = await Promise.all([
        supabase.from('conversation_participants').select('conversation_id, last_read_at').eq('user_id', uid).in('conversation_id', ids),
        supabase.from('conversation_participants').select('conversation_id, user_id').in('conversation_id', ids),
        supabase.from('projects').select('id, title').in('id', rows.map((c: any) => c.project_id).filter(Boolean)),
      ])

      const myRead = new Map((myParts ?? []).map((p: any) => [p.conversation_id, p.last_read_at]))
      const projectTitle = new Map((projects ?? []).map((p: any) => [p.id, p.title]))

      // Counterpart = the other participant on a project thread.
      const otherByConvo = new Map<string, string>()
      for (const p of allParts ?? []) {
        if (p.user_id !== uid) otherByConvo.set(p.conversation_id as string, p.user_id as string)
      }
      const parties = await fetchParties([...otherByConvo.values()])

      return rows.map((c: any) => {
        const lastRead = myRead.get(c.id) ?? null
        const counterpartId = otherByConvo.get(c.id)
        return {
          id: c.id,
          type: c.type,
          project_id: c.project_id ?? null,
          project_title: c.project_id ? projectTitle.get(c.project_id) ?? null : null,
          assigned_admin_id: c.assigned_admin_id ?? null,
          last_message_at: c.last_message_at ?? null,
          last_read_at: lastRead,
          counterpart: counterpartId ? parties.get(counterpartId) ?? null : null,
          unread: !!c.last_message_at && (!lastRead || new Date(c.last_message_at) > new Date(lastRead)),
        }
      })
    },

    async listMessages(conversationId: string): Promise<Message[]> {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Message[]
    },

    async sendMessage(conversationId: string, body: string): Promise<Message> {
      const uid = await currentUserId()
      if (!uid) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: uid, body: body.trim() })
        .select('id, conversation_id, sender_id, body, created_at')
        .single()
      if (error) throw error
      return data as Message
    },

    async markRead(conversationId: string): Promise<void> {
      const uid = await currentUserId()
      if (!uid) return
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', uid)
    },

    async supportQueue(): Promise<SupportTicket[]> {
      // RLS: an admin sees support threads that are unclaimed or theirs.
      const { data, error } = await supabase
        .from('conversations')
        .select('id, created_by, assigned_admin_id, last_message_at')
        .eq('type', 'support')
        .order('last_message_at', { ascending: true, nullsFirst: true })
      if (error) throw error
      const rows = data ?? []
      if (!rows.length) return []

      const requesters = await fetchParties(rows.map((r: any) => r.created_by))
      // A small preview: the latest message per thread.
      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, body, created_at')
        .in('conversation_id', rows.map((r: any) => r.id))
        .order('created_at', { ascending: false })
      const preview = new Map<string, string>()
      for (const m of msgs ?? []) {
        if (!preview.has(m.conversation_id as string)) preview.set(m.conversation_id as string, m.body as string)
      }

      return rows.map((r: any) => ({
        id: r.id,
        created_by: r.created_by ?? null,
        last_message_at: r.last_message_at ?? null,
        assigned_admin_id: r.assigned_admin_id ?? null,
        requester: r.created_by ? requesters.get(r.created_by) ?? null : null,
        preview: preview.get(r.id) ?? null,
      }))
    },
  }
}
