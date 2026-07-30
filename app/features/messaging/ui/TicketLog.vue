<script setup lang="ts">
// The support ticket log. Open/closed tabs.
//  - Admin: only their own tickets. Can open to reply, and close open ones.
//  - Master: every ticket from every admin, read-only (cannot participate).

import { useMessaging, useSupportModeration } from '~/features/messaging/application/useMessaging'
import { useMe } from '~/features/auth/application/useMe'
import { ticketLabel, isTicketOpen } from '~/features/messaging/domain'
import type { SupportTicket } from '~/features/messaging/domain'
import MessageThread from './MessageThread.vue'

const { supportQueue } = useMessaging()
const { close } = useSupportModeration()
const { me } = useMe()
const user = useSupabaseUser()
const toast = useToast()

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? '')
const isMaster = computed(() => me.value?.role === 'master')

const all = ref<SupportTicket[]>([])
const loading = ref(true)
const tab = ref<'open' | 'closed'>('open')
const openId = ref<string | null>(null)
const closing = ref<string | null>(null)

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

// Admin sees only their own; master sees all.
const scoped = computed(() =>
  isMaster.value ? all.value : all.value.filter((t) => t.assigned_admin_id === currentUserId.value),
)
const visible = computed(() =>
  scoped.value.filter((t) => (tab.value === 'open' ? isTicketOpen(t) : !isTicketOpen(t))),
)
const openCount = computed(() => scoped.value.filter(isTicketOpen).length)
const closedCount = computed(() => scoped.value.filter((t) => !isTicketOpen(t)).length)

const openTicket = computed(() => all.value.find((t) => t.id === openId.value) ?? null)
// Master never participates; admin can reply only while the ticket is open.
const threadReadOnly = computed(() => isMaster.value || (openTicket.value ? !isTicketOpen(openTicket.value) : true))

async function onClose(t: SupportTicket) {
  closing.value = t.id
  try {
    await close(t.id)
    toast.add({ title: `Ticket #${t.ticket_number} closed`, color: 'success' })
    openId.value = null
    await load()
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: 'Could not close', description: err?.data?.statusMessage, color: 'error' })
  } finally {
    closing.value = null
  }
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
          {{ isMaster ? 'Every ticket, all agents. Read-only.' : 'Tickets assigned to you.' }}
        </p>
      </div>
    </div>

    <div class="flex gap-1.5">
      <button
        class="zc-tap rounded-full border px-3 py-1 text-xs transition"
        :class="tab === 'open' ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400'"
        @click="tab = 'open'; openId = null"
      >
        Open ({{ openCount }})
      </button>
      <button
        class="zc-tap rounded-full border px-3 py-1 text-xs transition"
        :class="tab === 'closed' ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400'"
        @click="tab = 'closed'; openId = null"
      >
        Closed ({{ closedCount }})
      </button>
    </div>

    <div class="grid gap-4 lg:grid-cols-[24rem_1fr]">
      <div :class="openId ? 'hidden lg:block' : ''">
        <div v-if="loading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="zc-card h-16 animate-pulse" />
        </div>
        <p v-else-if="!visible.length" class="py-10 text-center text-sm text-stone-500 dark:text-stone-400">
          No {{ tab }} tickets.
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
                <span class="shrink-0 text-[11px] text-stone-400">{{ ago(t.last_message_at) }}</span>
              </div>
              <p class="truncate text-xs text-stone-500 dark:text-stone-400">{{ t.preview || '—' }}</p>
              <p v-if="isMaster" class="mt-0.5 text-[11px] text-stone-400">
                {{ t.handler ? `Agent: ${t.handler.full_name}` : 'Unclaimed' }}
                <span v-if="t.closed_at"> · closed</span>
              </p>
            </div>
          </button>
        </div>
      </div>

      <div
        v-if="openTicket"
        class="fixed inset-0 z-40 bg-white dark:bg-stone-900 lg:static lg:z-auto lg:h-[calc(100vh-11rem)] lg:rounded-2xl lg:border lg:border-stone-200 lg:dark:border-stone-800"
      >
        <MessageThread
          :conversation-id="openTicket.id"
          :current-user-id="currentUserId"
          :title="`${ticketLabel(openTicket.ticket_number)} · ${openTicket.requester?.full_name ?? 'Member'}`"
          :subtitle="openTicket.closed_at ? 'Closed' : openTicket.requester?.member_id"
          :read-only="threadReadOnly"
        >
          <template #back>
            <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" class="lg:hidden" @click="openId = null" />
          </template>
          <template #actions>
            <UButton
              v-if="!isMaster && !openTicket.closed_at"
              color="success"
              variant="soft"
              size="xs"
              icon="i-lucide-check-check"
              label="Close"
              class="zc-tap"
              :loading="closing === openTicket.id"
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
