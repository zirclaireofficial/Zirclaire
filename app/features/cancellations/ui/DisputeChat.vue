<script setup lang="ts">
// A private dispute channel. For a user it's their own channel (the Platform
// appears as "Zirclaire Review Team"). For staff it's one named party's channel.
import { useCancellations } from '../application/useCancellations'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import { attachmentTypeOf } from '~/features/messaging/domain'
import type { DisputeMessage } from '../application/useCancellations'

const props = defineProps<{
  requestId: string
  mode: 'user' | 'staff'
  party?: 'requester' | 'provider' // required when mode = staff
  disabled?: boolean               // hide the composer (e.g. resolved case)
}>()

const { messages, sendMessage, attachmentUrl } = useCancellations()
const { upload } = useMediaUpload()
const supabase = useSupabaseClient()

const MAX_MB = 15
const items = ref<DisputeMessage[]>([])
const draft = ref('')
const sending = ref(false)
const box = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pendingFile = ref<File | null>(null)
const openingId = ref<string | null>(null)

const otherLabel = computed(() =>
  props.mode === 'staff'
    ? (props.party === 'requester' ? 'Requester' : 'Provider')
    : 'Zirclaire Review Team',
)

function scroll() {
  nextTick(() => { if (box.value) box.value.scrollTop = box.value.scrollHeight })
}

async function load() {
  items.value = await messages(props.requestId, props.mode === 'staff' ? props.party : undefined)
  scroll()
}

// A platform bubble is "mine" in staff view; a user bubble is "mine" in user view.
function isMine(m: DisputeMessage) {
  return props.mode === 'staff' ? m.sender_side === 'platform' : m.sender_side === 'user'
}

function pickFile() {
  fileInput.value?.click()
}
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  if (f && f.size > MAX_MB * 1024 * 1024) {
    useToast().add({ title: 'File too large', description: `Attachments must be under ${MAX_MB} MB.`, color: 'error' })
    return
  }
  pendingFile.value = f
  if (fileInput.value) fileInput.value.value = ''
}
function clearFile() {
  pendingFile.value = null
}

async function send() {
  const body = draft.value.trim()
  const file = pendingFile.value
  if ((!body && !file) || sending.value) return
  sending.value = true
  try {
    let attachment = null
    if (file) {
      const up = await upload(file, 'message-attachment')
      attachment = { url: up.publicId, type: attachmentTypeOf(file.type), name: file.name }
    }
    await sendMessage(props.requestId, body, props.mode === 'staff' ? props.party : undefined, attachment)
    draft.value = ''
    pendingFile.value = null
    await load()
  } catch (e) {
    useToast().add({ title: 'Could not send', description: (e as { message?: string })?.message, color: 'error' })
  } finally {
    sending.value = false
  }
}

async function openAttachment(m: DisputeMessage) {
  if (!m.attachment_url || openingId.value) return
  openingId.value = m.id
  try {
    const { url } = await attachmentUrl(m.id)
    window.open(url, '_blank', 'noopener')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    useToast().add({ title: 'Could not open attachment', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    openingId.value = null
  }
}

function attachIcon(type: string | null) {
  return type === 'image' ? 'i-lucide-image' : type === 'pdf' ? 'i-lucide-file-text' : 'i-lucide-paperclip'
}

let channel: ReturnType<typeof supabase.channel> | null = null
onMounted(async () => {
  await load()
  const name = `dispute:${props.requestId}:${props.party ?? 'me'}`
  try {
    channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `request_id=eq.${props.requestId}` },
        (payload) => {
          const m = payload.new as DisputeMessage
          if (props.mode === 'staff' && m.party !== props.party) return
          if (!items.value.some((x) => x.id === m.id)) { items.value = [...items.value, m]; scroll() }
        })
      .subscribe()
  } catch { channel = null }
})
onBeforeUnmount(() => { if (channel) supabase.removeChannel(channel) })
</script>

<template>
  <div class="flex flex-col rounded-xl border border-stone-200 dark:border-stone-800">
    <div ref="box" class="max-h-64 min-h-24 space-y-2 overflow-y-auto p-3">
      <p v-if="!items.length" class="py-6 text-center text-xs text-stone-400">
        No messages yet.
      </p>
      <div v-for="m in items" :key="m.id" class="flex" :class="isMine(m) ? 'justify-end' : 'justify-start'">
        <div
          class="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
          :class="isMine(m)
            ? 'bg-primary text-white'
            : 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100'"
        >
          <p v-if="!isMine(m)" class="mb-0.5 text-[10px] font-medium opacity-70">{{ otherLabel }}</p>
          <p v-if="m.body" class="whitespace-pre-wrap leading-snug">{{ m.body }}</p>
          <button
            v-if="m.attachment_url"
            type="button"
            class="zc-tap mt-1 flex items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition"
            :class="isMine(m) ? 'bg-white/15 hover:bg-white/25' : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20'"
            :disabled="openingId === m.id"
            @click="openAttachment(m)"
          >
            <UIcon :name="openingId === m.id ? 'i-lucide-loader-circle' : attachIcon(m.attachment_type)" :class="['size-3.5 shrink-0', openingId === m.id && 'animate-spin']" />
            <span class="max-w-[10rem] truncate">{{ m.attachment_name || 'Attachment' }}</span>
            <UIcon name="i-lucide-external-link" class="size-3 shrink-0 opacity-70" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="!disabled" class="border-t border-stone-100 p-2 dark:border-stone-800">
      <div v-if="pendingFile" class="mb-2 flex items-center gap-2 rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs dark:bg-stone-800">
        <UIcon name="i-lucide-paperclip" class="size-3.5 shrink-0 text-stone-500" />
        <span class="min-w-0 flex-1 truncate">{{ pendingFile.name }}</span>
        <button type="button" class="zc-tap text-stone-400 hover:text-stone-600" aria-label="Remove attachment" @click="clearFile">
          <UIcon name="i-lucide-x" class="size-3.5" />
        </button>
      </div>
      <div class="flex items-end gap-2">
        <input ref="fileInput" type="file" class="hidden" @change="onFile" >
        <UButton icon="i-lucide-paperclip" color="neutral" variant="ghost" :disabled="sending" aria-label="Attach a file" @click="pickFile" />
        <UTextarea
          v-model="draft"
          :rows="1"
          autoresize
          placeholder="Type a message…"
          class="flex-1"
          @keydown.enter.exact.prevent="send"
        />
        <UButton icon="i-lucide-send" color="primary" :loading="sending" :disabled="!draft.trim() && !pendingFile" aria-label="Send" @click="send" />
      </div>
    </div>
  </div>
</template>
