<script setup lang="ts">
// The member's service desk — one continuous chat across all their tickets.
// Each ticket is separated by a divider showing its number and status. Sending
// routes to their open ticket, or opens a new one if the last is closed.

import { useMessaging } from '~/features/messaging/application/useMessaging'
import { ticketLabel } from '~/features/messaging/domain'
import type { SupportTicketThread, Message } from '~/features/messaging/domain'

const emit = defineEmits<{ back: [] }>()

const { myTickets, supportSend, botReply, subscribe } = useMessaging()
const user = useSupabaseUser()
const toast = useToast()

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? '')

const tickets = ref<SupportTicketThread[]>([])
const loading = ref(true)
const body = ref('')
const sending = ref(false)
const scroller = ref<HTMLElement | null>(null)
let unsub: (() => void) | null = null

async function scrollToEnd() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

// The active (latest, still-open) ticket — what realtime watches.
const activeTicket = computed(() => {
  const last = tickets.value[tickets.value.length - 1]
  return last && !last.closed_at ? last : null
})

// True if a message id is already somewhere in local state (dedup against the
// realtime echo of a message we already appended).
function hasMessage(id: string) {
  return tickets.value.some((t) => t.messages.some((m) => m.id === id))
}

// Append a message to its ticket group, creating the group if it's a brand-new
// ticket. Safe: only ever called with a server-confirmed message (real id).
function appendMessage(m: Message, ticketNumber?: number | null) {
  if (hasMessage(m.id)) return
  const t = tickets.value.find((x) => x.id === m.conversation_id)
  if (t) {
    t.messages.push(m)
  } else {
    tickets.value.push({
      id: m.conversation_id,
      ticket_number: ticketNumber ?? null,
      closed_at: null,
      created_at: m.created_at,
      messages: [m],
    })
    resubscribe() // a new ticket became the active one
  }
  scrollToEnd()
}

function resubscribe() {
  unsub?.()
  unsub = null
  if (activeTicket.value) {
    // On an incoming message, append it (dedup by id) rather than reloading.
    unsub = subscribe(activeTicket.value.id, (m) => appendMessage(m))
  }
}

async function load() {
  try {
    tickets.value = await myTickets()
    resubscribe()
    await scrollToEnd()
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load your messages', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => unsub?.())

async function send() {
  const text = body.value.trim()
  if (!text || sending.value) return
  sending.value = true
  body.value = ''
  try {
    const res = await supportSend(text)
    // Show it immediately (server already saved it), no reload.
    appendMessage(res.message, res.ticketNumber)
    // The bot replies asynchronously; its message arrives over realtime.
    botReply(res.conversationId).catch(() => {})
  } catch (e) {
    body.value = text
    const err = e as { message?: string }
    toast.add({ title: 'Could not send', description: err?.message, color: 'error' })
  } finally {
    sending.value = false
  }
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function ticketDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function isMine(m: Message) {
  return m.sender_id === currentUserId.value
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" class="lg:hidden" @click="emit('back')" />
      <div class="flex size-8 items-center justify-center rounded-full bg-primary/10">
        <UIcon name="i-lucide-headset" class="size-4 text-primary" />
      </div>
      <div class="min-w-0">
        <p class="font-medium leading-tight">Service desk</p>
        <p class="truncate text-xs text-stone-500 dark:text-stone-400">
          {{ activeTicket ? `Ticket ${ticketLabel(activeTicket.ticket_number)} · open` : 'Send a message to open a ticket' }}
        </p>
      </div>
    </div>

    <div ref="scroller" class="flex-1 space-y-2 overflow-y-auto p-4">
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
      </div>

      <p v-else-if="!tickets.length" class="py-10 text-center text-sm text-stone-500 dark:text-stone-400">
        How can we help? Send a message to start.
      </p>

      <template v-for="t in tickets" v-else :key="t.id">
        <!-- Ticket divider -->
        <div class="my-3 flex items-center gap-2 text-[11px] uppercase tracking-wide text-stone-400">
          <span class="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <span>{{ ticketLabel(t.ticket_number) }} · {{ ticketDate(t.created_at) }}{{ t.closed_at ? ' · closed' : '' }}</span>
          <span class="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        </div>

        <template v-for="m in t.messages" :key="m.id">
          <div v-if="m.is_system" class="flex flex-col items-start">
            <span class="mb-0.5 ml-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
              <UIcon name="i-lucide-headset" class="size-3" /> Service desk
            </span>
            <div class="max-w-[80%] rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2 text-[15px] leading-relaxed text-stone-900 dark:bg-stone-800 dark:text-stone-100">
              <p class="whitespace-pre-wrap">{{ m.body }}</p>
              <p class="mt-0.5 text-[10px] text-stone-400">{{ time(m.created_at) }}</p>
            </div>
          </div>
          <div v-else class="flex" :class="isMine(m) ? 'justify-end' : 'justify-start'">
            <div
              class="max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed"
              :class="isMine(m) ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'"
            >
              <p class="whitespace-pre-wrap">{{ m.body }}</p>
              <p class="mt-0.5 text-[10px]" :class="isMine(m) ? 'text-white/70' : 'text-stone-400'">{{ time(m.created_at) }}</p>
            </div>
          </div>
        </template>
      </template>
    </div>

    <div class="border-t border-stone-200 p-3 dark:border-stone-800">
      <div class="flex items-end gap-2">
        <UTextarea v-model="body" :rows="1" autoresize placeholder="Describe your issue…" class="w-full" @keydown.enter.exact.prevent="send" />
        <UButton icon="i-lucide-send-horizontal" color="primary" class="zc-tap shrink-0" :loading="sending" :disabled="!body.trim()" aria-label="Send" @click="send" />
      </div>
      <p v-if="!activeTicket && tickets.length" class="mt-1.5 text-center text-[11px] text-stone-400">
        Your last ticket is closed — a new message opens a new ticket.
      </p>
    </div>
  </div>
</template>
