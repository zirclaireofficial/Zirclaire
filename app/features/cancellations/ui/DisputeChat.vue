<script setup lang="ts">
// A private dispute channel. For a user it's their own channel (the Platform
// appears as "Zirclaire Review Team"). For staff it's one named party's channel.
import { useCancellations } from '../application/useCancellations'
import type { DisputeMessage } from '../application/useCancellations'

const props = defineProps<{
  requestId: string
  mode: 'user' | 'staff'
  party?: 'requester' | 'provider' // required when mode = staff
  disabled?: boolean               // hide the composer (e.g. resolved case)
}>()

const { messages, sendMessage } = useCancellations()
const supabase = useSupabaseClient()

const items = ref<DisputeMessage[]>([])
const draft = ref('')
const sending = ref(false)
const box = ref<HTMLElement | null>(null)

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

async function send() {
  const body = draft.value.trim()
  if (!body || sending.value) return
  sending.value = true
  try {
    await sendMessage(props.requestId, body, props.mode === 'staff' ? props.party : undefined)
    draft.value = ''
    await load()
  } catch (e) {
    useToast().add({ title: 'Could not send', description: (e as { message?: string })?.message, color: 'error' })
  } finally {
    sending.value = false
  }
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
          <p class="whitespace-pre-wrap leading-snug">{{ m.body }}</p>
        </div>
      </div>
    </div>

    <div v-if="!disabled" class="flex items-end gap-2 border-t border-stone-100 p-2 dark:border-stone-800">
      <UTextarea
        v-model="draft"
        :rows="1"
        autoresize
        placeholder="Type a message…"
        class="flex-1"
        @keydown.enter.exact.prevent="send"
      />
      <UButton icon="i-lucide-send" color="primary" :loading="sending" :disabled="!draft.trim()" aria-label="Send" @click="send" />
    </div>
  </div>
</template>
