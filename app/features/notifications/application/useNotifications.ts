// notifications/application — the in-site notification centre. Reads the
// caller's own notifications (RLS scopes them), streams new ones over Supabase
// realtime, and marks them read. State is shared (useState) so the header bell
// and any page stay in sync. New notifications are created server-side.

export interface AppNotification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

// One shared realtime channel for the whole app, reference-counted — several
// bells (desktop + mobile) can subscribe without opening duplicate channels
// (Supabase throws if the same channel name is subscribed twice).
let sharedChannel: ReturnType<ReturnType<typeof useSupabaseClient>['channel']> | null = null
let subscriberCount = 0

export function useNotifications() {
  // No Database generic: the `notifications` table may not be in the generated
  // types yet, and this table is simple enough not to need them.
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const items = useState<AppNotification[]>('notifications', () => [])
  const unread = computed(() => items.value.filter((n) => !n.read_at).length)

  function uid(): string | null {
    const u = user.value as unknown as { id?: string; sub?: string } | null
    return u?.id ?? u?.sub ?? null
  }

  async function load() {
    if (!uid()) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    items.value = (data as AppNotification[]) ?? []
  }

  /** Subscribe to new notifications for this user. Returns a cleanup fn.
   *  Uses a single shared channel across all callers (reference-counted). */
  function subscribe(): () => void {
    const id = uid()
    if (!id) return () => {}
    subscriberCount++
    if (!sharedChannel) {
      const topic = `notifications:${id}`
      // Defensive: drop any leftover channel with this topic (e.g. a prior
      // mount whose cleanup didn't run, or an HMR reload) so we never call
      // .on() on an already-subscribed channel — the cause of the crash.
      for (const ch of supabase.getChannels()) {
        if (ch.topic === topic || ch.topic === `realtime:${topic}`) {
          supabase.removeChannel(ch)
        }
      }
      try {
        sharedChannel = supabase
          .channel(topic)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${id}` },
            (payload) => { items.value = [payload.new as AppNotification, ...items.value] },
          )
          .subscribe()
      } catch {
        sharedChannel = null // realtime hiccup shouldn't crash the app
      }
    }
    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1)
      if (subscriberCount === 0 && sharedChannel) {
        supabase.removeChannel(sharedChannel)
        sharedChannel = null
      }
    }
  }

  async function markRead(id: string) {
    const n = items.value.find((x) => x.id === id)
    if (!n || n.read_at) return
    n.read_at = new Date().toISOString()
    await supabase.from('notifications').update({ read_at: n.read_at }).eq('id', id)
  }

  async function markAllRead() {
    if (!unread.value) return
    const now = new Date().toISOString()
    items.value.forEach((n) => { if (!n.read_at) n.read_at = now })
    await supabase.from('notifications').update({ read_at: now }).is('read_at', null)
  }

  return { items, unread, load, subscribe, markRead, markAllRead }
}
