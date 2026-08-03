<script setup lang="ts">
// The inbox: a thread list on the left, the open thread on the right (desktop)
// or a full-screen thread (mobile). Includes the service-desk entry.

import { useMessaging } from '~/features/messaging/application/useMessaging'
import { usePublicMedia } from '~/shared/lib/media'
import { conversationTitle } from '~/features/messaging/domain'
import type { ConversationSummary } from '~/features/messaging/domain'
import MessageThread from './MessageThread.vue'

const { listConversations, openSupportThread, botReply } = useMessaging()
const { publicMediaUrl } = usePublicMedia()
const user = useSupabaseUser()
const toast = useToast()

// After the member sends in their support thread, ask the assistant to reply.
// Best-effort: the bot's message arrives over realtime. It self-limits (does
// nothing once a human has claimed or it has escalated).
function onSent(conversationId: string) {
  const c = conversations.value.find((x) => x.id === conversationId)
  if (c?.type === 'support') botReply(conversationId).catch(() => {})
}

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? '')

const conversations = ref<ConversationSummary[]>([])
const loading = ref(true)
const openId = ref<string | null>(null)
const openingDesk = ref(false)

const route = useRoute()

async function load() {
  loading.value = true
  try {
    conversations.value = await listConversations()
    // Opened via a "Message" button: ?c=<conversationId>
    const c = route.query.c as string | undefined
    if (c && conversations.value.some((x) => x.id === c)) openId.value = c
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load your inbox', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const openConversation = computed(() => conversations.value.find((c) => c.id === openId.value) ?? null)

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function ago(iso: string | null) {
  if (!iso) return ''
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

async function contactDesk() {
  openingDesk.value = true
  try {
    const res = await openSupportThread()
    await load()
    openId.value = res.conversation.id
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: 'Could not open the service desk', description: err?.data?.statusMessage, color: 'error' })
  } finally {
    openingDesk.value = false
  }
}

function onOpen(id: string) {
  openId.value = id
  const c = conversations.value.find((x) => x.id === id)
  if (c) c.unread = false
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[20rem_1fr]">
    <!-- Thread list -->
    <div :class="openId ? 'hidden lg:block' : ''">
      <h1 class="zc-title mb-3 font-serif text-2xl leading-tight">Inbox</h1>

      <!-- Helpdesk entry — always available -->
      <button
        class="zc-card zc-card-hover zc-tap mb-3 flex w-full items-center gap-3 p-3 text-left"
        @click="contactDesk"
      >
        <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <UIcon v-if="!openingDesk" name="i-lucide-life-buoy" class="size-5 text-primary" />
          <UIcon v-else name="i-lucide-loader" class="size-5 animate-spin text-primary" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">Need help?</p>
          <p class="text-xs text-stone-500 dark:text-stone-400">Contact the Zirclaire service desk</p>
        </div>
        <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-stone-400" />
      </button>

      <div v-if="loading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="zc-card h-16 animate-pulse" />
      </div>

      <div v-else-if="!conversations.length" class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-14 text-center dark:border-stone-800">
        <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
          <UIcon name="i-lucide-message-square" class="size-6 text-primary" />
        </div>
        <p class="font-medium">No conversations</p>
        <p class="max-w-xs text-sm text-stone-500 dark:text-stone-400">
          Messaging opens when you're working together on a project or order.
        </p>
      </div>

      <div v-else class="space-y-1.5">
        <button
          v-for="c in conversations"
          :key="c.id"
          class="zc-tap flex w-full items-center gap-3 rounded-xl p-3 text-left transition"
          :class="openId === c.id ? 'bg-primary/10' : 'hover:bg-stone-100 dark:hover:bg-stone-800'"
          @click="onOpen(c.id)"
        >
          <div v-if="c.type === 'support'" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UIcon name="i-lucide-life-buoy" class="size-5 text-primary" />
          </div>
          <img v-else-if="c.counterpart?.profile_picture" :src="publicMediaUrl(c.counterpart.profile_picture)" :alt="c.counterpart.full_name ?? ''" class="size-10 shrink-0 rounded-full object-cover" >
          <div v-else class="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium dark:bg-stone-800">
            {{ initials(c.counterpart?.full_name) }}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-medium">{{ conversationTitle(c) }}</span>
              <span class="shrink-0 text-[11px] text-stone-400">{{ ago(c.last_message_at) }}</span>
            </div>
            <p class="truncate text-xs text-stone-500 dark:text-stone-400">
              {{ c.type === 'support' ? 'Service desk' : c.project_title || 'Project' }}
            </p>
          </div>
          <span v-if="c.unread" class="size-2 shrink-0 rounded-full bg-primary" />
        </button>
      </div>
    </div>

    <!-- Open thread -->
    <div
      v-if="openConversation"
      class="fixed inset-0 z-40 bg-white dark:bg-stone-900 lg:static lg:z-auto lg:h-[calc(100vh-6rem)] lg:rounded-2xl lg:border lg:border-stone-200 lg:dark:border-stone-800"
    >
      <MessageThread
        :conversation-id="openConversation.id"
        :current-user-id="currentUserId"
        :title="conversationTitle(openConversation)"
        :subtitle="openConversation.type === 'support' ? 'Service desk' : openConversation.project_title"
        @sent="onSent"
      >
        <template #back>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" class="lg:hidden" @click="openId = null" />
        </template>
      </MessageThread>
    </div>

    <div v-else class="hidden items-center justify-center rounded-2xl border border-stone-200 text-sm text-stone-400 lg:flex dark:border-stone-800">
      Select a conversation
    </div>
  </div>
</template>
