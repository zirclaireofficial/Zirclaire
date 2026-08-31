<script setup lang="ts">
// A single conversation: message history + composer, live via realtime.
// Presentational about who's who — it just renders messages and sends.

import { useMessaging } from '~/features/messaging/application/useMessaging'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import { useMediaViewer } from '~/shared/lib/useMediaViewer'
import { usePublicMedia } from '~/shared/lib/media'
import { attachmentTypeOf } from '~/features/messaging/domain'
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

const emit = defineEmits<{ sent: [conversationId: string] }>()

const { listMessages, sendMessage, attachmentUrl, markRead, subscribe } = useMessaging()
const { upload } = useMediaUpload()
const { open: openMedia } = useMediaViewer()
const { publicMediaUrl } = usePublicMedia()
const toast = useToast()

const MAX_MB = 15

const messages = ref<Message[]>([])
const loading = ref(true)
const body = ref('')
const sending = ref(false)
const scroller = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pendingFile = ref<File | null>(null)
const openingId = ref<string | null>(null)
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

function pickFile() {
  fileInput.value?.click()
}
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  if (f && f.size > MAX_MB * 1024 * 1024) {
    toast.add({ title: 'File too large', description: `Attachments must be under ${MAX_MB} MB.`, color: 'error' })
    return
  }
  pendingFile.value = f
  if (fileInput.value) fileInput.value.value = '' // allow re-picking the same file
}
function clearFile() {
  pendingFile.value = null
}

async function send() {
  const text = body.value.trim()
  const file = pendingFile.value
  if ((!text && !file) || sending.value) return
  sending.value = true
  body.value = ''
  pendingFile.value = null
  try {
    let attachment = null
    if (file) {
      const up = await upload(file, 'message-attachment')
      attachment = { url: up.publicId, type: attachmentTypeOf(file.type), name: file.name }
    }
    const m = await sendMessage(props.conversationId, text, attachment)
    messages.value.push(m)
    scrollToEnd()
    emit('sent', props.conversationId)
  } catch (e) {
    const err = e as { message?: string }
    body.value = text // restore on failure
    pendingFile.value = file
    toast.add({ title: 'Could not send', description: err?.message, color: 'error' })
  } finally {
    sending.value = false
  }
}

/** Fetch a fresh signed URL and open the attachment in a new tab. */
async function openAttachment(m: Message) {
  if (!m.attachment || openingId.value) return
  openingId.value = m.id
  try {
    const { url } = await attachmentUrl(m.id)
    openMedia(url, { type: m.attachment.type, name: m.attachment.name ?? 'attachment' })
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not open attachment', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    openingId.value = null
  }
}

function attachIcon(type: string) {
  return type === 'image' ? 'i-lucide-image' : type === 'pdf' ? 'i-lucide-file-text' : 'i-lucide-paperclip'
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
      <slot name="back" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium leading-tight">{{ title }}</p>
        <p v-if="subtitle" class="truncate text-xs text-stone-500 dark:text-stone-400">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
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
            <p v-if="m.body" class="whitespace-pre-wrap">{{ m.body }}</p>

            <button
              v-if="m.attachment"
              type="button"
              class="zc-tap mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
              :class="m.sender_id === currentUserId ? 'bg-white/15 hover:bg-white/25' : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20'"
              :disabled="openingId === m.id"
              @click="openAttachment(m)"
            >
              <UIcon :name="openingId === m.id ? 'i-lucide-loader-circle' : attachIcon(m.attachment.type)" :class="['size-4 shrink-0', openingId === m.id && 'animate-spin']" />
              <span class="max-w-[12rem] truncate">{{ m.attachment.name || 'Attachment' }}</span>
              <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0 opacity-70" />
            </button>

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
      <!-- Pending attachment chip -->
      <div v-if="pendingFile" class="mb-2 flex items-center gap-2 rounded-lg bg-stone-100 px-2.5 py-1.5 text-sm dark:bg-stone-800">
        <UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-stone-500" />
        <span class="min-w-0 flex-1 truncate">{{ pendingFile.name }}</span>
        <button type="button" class="zc-tap text-stone-400 hover:text-stone-600" aria-label="Remove attachment" @click="clearFile">
          <UIcon name="i-lucide-x" class="size-4" />
        </button>
      </div>

      <div class="flex items-end gap-2">
        <input ref="fileInput" type="file" class="hidden" @change="onFile" >
        <UButton
          icon="i-lucide-paperclip"
          color="neutral"
          variant="ghost"
          class="zc-tap shrink-0"
          :disabled="sending"
          aria-label="Attach a file"
          @click="pickFile"
        />
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
          :disabled="!body.trim() && !pendingFile"
          aria-label="Send"
          @click="send"
        />
      </div>
    </div>
  </div>
</template>
