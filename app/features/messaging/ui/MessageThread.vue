<script setup lang="ts">
// A single conversation: message history + composer, live via realtime.
// Presentational about who's who — it just renders messages and sends.

import { useMessaging } from '~/features/messaging/application/useMessaging'
import { usePublicMedia } from '~/shared/lib/media'
import type { Message } from '~/features/messaging/domain'

const props = defineProps<{
  conversationId: string
  currentUserId: string
  title: string
  /** Optional subtitle, e.g. the project title or member ID. */
  subtitle?: string | null
  /** Master oversight: read the thread without a composer. */
  readOnly?: boolean
}>()

const { listMessages, sendMessage, markRead, subscribe } = useMessaging()
const { publicMediaUrl } = usePublicMedia()
const toast = useToast()

const messages = ref<Message[]>([])
const loading = ref(true)
const body = ref('')
const sending = ref(false)
const scroller = ref<HTMLElement | null>(null)
let unsub: (() => void) | null = null

async function scrollToEnd() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function load() {
  loading.value = true
  try {
    messages.value = await listMessages(props.conversationId)
    await markRead(props.conversationId)
    await scrollToEnd()
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load messages', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}

watch(
  () => props.conversationId,
  (id) => {
    unsub?.()
    load()
    unsub = subscribe(id, (m) => {
      // Ignore our own echo (already appended optimistically).
      if (messages.value.some((x) => x.id === m.id)) return
      messages.value.push(m)
      if (m.sender_id !== props.currentUserId) markRead(id)
      scrollToEnd()
    })
  },
  { immediate: true },
)
onBeforeUnmount(() => unsub?.())

async function send() {
  const text = body.value.trim()
  if (!text || sending.value) return
  sending.value = true
  body.value = ''
  try {
    const m = await sendMessage(props.conversationId, text)
    messages.value.push(m)
    scrollToEnd()
  } catch (e) {
    const err = e as { message?: string }
    body.value = text // restore on failure
    toast.add({ title: 'Could not send', description: err?.message, color: 'error' })
  } finally {
    sending.value = false
  }
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
      <slot name="back" />
      <div class="min-w-0">
        <p class="truncate font-medium leading-tight">{{ title }}</p>
        <p v-if="subtitle" class="truncate text-xs text-stone-500 dark:text-stone-400">{{ subtitle }}</p>
      </div>
    </div>

    <div ref="scroller" class="flex-1 space-y-2 overflow-y-auto p-4">
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
      </div>

      <p v-else-if="!messages.length" class="py-10 text-center text-sm text-stone-500 dark:text-stone-400">
        No messages yet.
      </p>

      <template v-for="m in messages" :key="m.id">
        <!-- Service desk (bot) — an incoming message on the left, labelled. -->
        <div v-if="m.is_system" class="flex flex-col items-start">
          <span class="mb-0.5 ml-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
            <UIcon name="i-lucide-headset" class="size-3" /> Service desk
          </span>
          <div class="max-w-[78%] rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2 text-[15px] leading-relaxed text-stone-900 dark:bg-stone-800 dark:text-stone-100">
            <p class="whitespace-pre-wrap">{{ m.body }}</p>
            <p class="mt-0.5 text-[10px] text-stone-400">{{ time(m.created_at) }}</p>
          </div>
        </div>

        <div v-else class="flex" :class="m.sender_id === currentUserId ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed"
            :class="m.sender_id === currentUserId
              ? 'rounded-br-md bg-primary text-white'
              : 'rounded-bl-md bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'"
          >
            <p class="whitespace-pre-wrap">{{ m.body }}</p>
            <p class="mt-0.5 text-[10px]" :class="m.sender_id === currentUserId ? 'text-white/70' : 'text-stone-400'">
              {{ time(m.created_at) }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <div v-if="readOnly" class="border-t border-stone-200 p-3 text-center text-xs text-stone-400 dark:border-stone-800">
      <UIcon name="i-lucide-eye" class="mr-1 inline size-3.5" /> Oversight — read only
    </div>
    <div v-else class="border-t border-stone-200 p-3 dark:border-stone-800">
      <div class="flex items-end gap-2">
        <UTextarea
          v-model="body"
          :rows="1"
          autoresize
          placeholder="Write a message…"
          class="w-full"
          @keydown.enter.exact.prevent="send"
        />
        <UButton
          icon="i-lucide-send-horizontal"
          color="primary"
          class="zc-tap shrink-0"
          :loading="sending"
          :disabled="!body.trim()"
          aria-label="Send"
          @click="send"
        />
      </div>
    </div>
  </div>
</template>
