<script setup lang="ts">
// The support ticket log. Tabs: Unclaimed / Open / Closed / All.
//   - Unclaimed = no agent yet (the bot may still be chatting, or it has
//     escalated and is waiting). Not closed.
//   - Open      = claimed by an agent, not closed.
//   - Closed    = resolved.
// Admin sees unclaimed tickets plus their own; master sees everything (RLS).
// Admin can claim an unclaimed ticket and close their own; master is read-only.

import { useMessaging, useSupportModeration } from '~/features/messaging/application/useMessaging'
import { useMe } from '~/features/auth/application/useMe'
import { ticketLabel } from '~/features/messaging/domain'
import type { SupportTicket } from '~/features/messaging/domain'
import MessageThread from './MessageThread.vue'

const { supportQueue } = useMessaging()
const { claim, close } = useSupportModeration()
const { me } = useMe()
const user = useSupabaseUser()
const toast = useToast()

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? '')
const isMaster = computed(() => me.value?.role === 'master')

type Tab = 'unclaimed' | 'open' | 'closed' | 'all'
const all = ref<SupportTicket[]>([])
const loading = ref(true)
const tab = ref<Tab>('unclaimed')
const openId = ref<string | null>(null)
const busy = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    all.value = await supportQueue()
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load tickets', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Categories (RLS has already scoped `all` to what this staff member may see).
const unclaimed = computed(() => all.value.filter((t) => !t.assigned_admin_id && !t.closed_at))
const open = computed(() => all.value.filter((t) => t.assigned_admin_id && !t.closed_at))
const closed = computed(() => all.value.filter((t) => t.closed_at))

const visible = computed(() => {
  if (tab.value === 'unclaimed') return unclaimed.value
  if (tab.value === 'open') return open.value
  if (tab.value === 'closed') return closed.value
  return all.value
})

const tabs = computed(() => [
  { key: 'unclaimed' as Tab, label: 'Unclaimed', count: unclaimed.value.length },
  { key: 'open' as Tab, label: 'Open', count: open.value.length },
  { key: 'closed' as Tab, label: 'Closed', count: closed.value.length },
  { key: 'all' as Tab, label: 'All', count: all.value.length },
])

const openTicket = computed(() => all.value.find((t) => t.id === openId.value) ?? null)
const openIsMine = computed(() => !!openTicket.value && openTicket.value.assigned_admin_id === currentUserId.value)
const openIsUnclaimed = computed(() => !!openTicket.value && !openTicket.value.assigned_admin_id && !openTicket.value.closed_at)
// Reply only if it's an admin's own, still-open ticket.
const threadReadOnly = computed(() => isMaster.value || !openIsMine.value || !!openTicket.value?.closed_at)

async function onClaim(t: SupportTicket) {
  busy.value = t.id
  try {
    await claim(t.id)
    await load()
    openId.value = t.id
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: 'Could not claim', description: err?.data?.statusMessage ?? 'Someone may have taken it first.', color: 'error' })
    await load()
  } finally {
    busy.value = null
  }
}

async function onClose(t: SupportTicket) {
  busy.value = t.id
  try {
    await close(t.id)
    toast.add({ title: `Ticket #${t.ticket_number} closed`, color: 'success' })
    openId.value = null
    await load()
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: 'Could not close', description: err?.data?.statusMessage, color: 'error' })
  } finally {
    busy.value = null
  }
}

function statusOf(t: SupportTicket) {
  if (t.closed_at) return { label: 'Closed', color: 'neutral' }
  if (t.assigned_admin_id) return { label: 'Open', color: 'primary' }
  return { label: 'Unclaimed', color: 'warning' }
}
function ago(iso: string | null) {
  if (!iso) return ''
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(m, 1)}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-ticket" class="size-6 text-primary" />
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Support tickets</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {{ isMaster ? 'Every ticket, all agents. Read-only.' : 'Unclaimed tickets and the ones you handle.' }}
        </p>
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="zc-tap rounded-full border px-3 py-1 text-xs transition"
        :class="tab === t.key ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400'"
        @click="tab = t.key; openId = null"
      >
        {{ t.label }} ({{ t.count }})
      </button>
    </div>

    <div class="grid gap-4 lg:grid-cols-[24rem_1fr]">
      <div :class="openId ? 'hidden lg:block' : ''">
        <div v-if="loading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="zc-card h-16 animate-pulse" />
        </div>
        <p v-else-if="!visible.length" class="py-10 text-center text-sm text-stone-500 dark:text-stone-400">
          No {{ tab === 'all' ? '' : tab }} tickets.
        </p>
        <div v-else class="space-y-1.5">
          <button
            v-for="t in visible"
            :key="t.id"
            class="zc-tap flex w-full items-start gap-3 rounded-xl p-3 text-left transition"
            :class="openId === t.id ? 'bg-primary/10' : 'hover:bg-stone-100 dark:hover:bg-stone-800'"
            @click="openId = t.id"
          >
            <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UIcon name="i-lucide-life-buoy" class="size-4 text-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1.5">
                  <span class="font-mono text-xs font-medium text-primary">{{ ticketLabel(t.ticket_number) }}</span>
                  <span class="truncate text-sm font-medium">{{ t.requester?.full_name ?? 'Member' }}</span>
                </span>
                <UBadge :color="(statusOf(t).color as any)" variant="soft" size="sm" class="shrink-0">{{ statusOf(t).label }}</UBadge>
              </div>
              <p class="truncate text-xs text-stone-500 dark:text-stone-400">{{ t.preview || '—' }}</p>
              <p class="mt-0.5 text-[11px] text-stone-400">
                {{ t.handler ? `Agent: ${t.handler.full_name}` : 'No agent yet' }} · {{ ago(t.last_message_at) }}
              </p>
            </div>
          </button>
        </div>
      </div>

      <div
        v-if="openTicket"
        class="fixed inset-0 z-40 bg-white dark:bg-stone-900 lg:static lg:z-auto lg:h-[calc(100vh-12rem)] lg:rounded-2xl lg:border lg:border-stone-200 lg:dark:border-stone-800"
      >
        <MessageThread
          :conversation-id="openTicket.id"
          :current-user-id="currentUserId"
          :title="`${ticketLabel(openTicket.ticket_number)} · ${openTicket.requester?.full_name ?? 'Member'}`"
          :subtitle="openTicket.closed_at ? 'Closed' : openIsUnclaimed ? 'Unclaimed — read-only until you claim' : openTicket.requester?.member_id"
          :read-only="threadReadOnly"
        >
          <template #back>
            <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" class="lg:hidden" @click="openId = null" />
          </template>
          <template #actions>
            <UButton
              v-if="!isMaster && openIsUnclaimed"
              color="primary"
              size="xs"
              icon="i-lucide-hand"
              label="Claim"
              class="zc-tap"
              :loading="busy === openTicket.id"
              @click="onClaim(openTicket)"
            />
            <UButton
              v-else-if="!isMaster && openIsMine && !openTicket.closed_at"
              color="success"
              variant="soft"
              size="xs"
              icon="i-lucide-check-check"
              label="Close"
              class="zc-tap"
              :loading="busy === openTicket.id"
              @click="onClose(openTicket)"
            />
          </template>
        </MessageThread>
      </div>
      <div v-else class="hidden items-center justify-center rounded-2xl border border-stone-200 text-sm text-stone-400 lg:flex dark:border-stone-800">
        Select a ticket
      </div>
    </div>
  </div>
</template>
