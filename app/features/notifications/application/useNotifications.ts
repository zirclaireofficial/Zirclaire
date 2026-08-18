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

  /** Subscribe to new notifications for this user. Returns a cleanup fn. */
  function subscribe(): () => void {
    const id = uid()
    if (!id) return () => {}
    const channel = supabase
      .channel(`notifications:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${id}` },
        (payload) => { items.value = [payload.new as AppNotification, ...items.value] },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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
