<script setup lang="ts">
// Master oversight of ALL conversations — every service-desk ticket and every
// buyer↔provider project thread. Read-only: the master watches, it doesn't
// impersonate. Filter by type; open any thread to read the full exchange.

import { useMessaging } from '~/features/messaging/application/useMessaging'
import { ticketLabel } from '~/features/messaging/domain'
import type { OversightThread } from '~/features/messaging/domain'
import MessageThread from './MessageThread.vue'

const { oversight } = useMessaging()
const user = useSupabaseUser()
const toast = useToast()

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? '')

const threads = ref<OversightThread[]>([])
const loading = ref(true)
const filter = ref<'all' | 'support' | 'project'>('all')
const openId = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    threads.value = await oversight()
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not load conversations', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() =>
  filter.value === 'all' ? threads.value : threads.value.filter((t) => t.type === filter.value),
)
const openThread = computed(() => threads.value.find((t) => t.id === openId.value) ?? null)

function title(t: OversightThread) {
  if (t.type === 'support') return `Ticket ${ticketLabel(t.ticket_number)}`
  return t.project_title || 'Project thread'
}
function people(t: OversightThread) {
  return t.participants.map((p) => p.full_name || p.member_id || 'Member').join(' ↔ ') || '—'
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
      <UIcon name="i-lucide-eye" class="size-6 text-primary" />
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Conversation oversight</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Every service-desk ticket and project thread. Read-only.</p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[24rem_1fr]">
      <div :class="openId ? 'hidden lg:block' : ''">
        <div class="mb-3 flex gap-1.5">
          <button
            v-for="f in (['all','support','project'] as const)"
            :key="f"
            class="zc-tap rounded-full border px-3 py-1 text-xs capitalize transition"
            :class="filter === f ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400'"
            @click="filter = f"
          >
            {{ f === 'all' ? 'All' : f === 'support' ? 'Service desk' : 'Projects' }}
          </button>
        </div>

        <div v-if="loading" class="space-y-2">
          <div v-for="i in 4" :key="i" class="zc-card h-16 animate-pulse" />
        </div>
        <p v-else-if="!filtered.length" class="py-10 text-center text-sm text-stone-500 dark:text-stone-400">No conversations.</p>

        <div v-else class="space-y-1.5">
          <button
            v-for="t in filtered"
            :key="t.id"
            class="zc-tap flex w-full items-center gap-3 rounded-xl p-3 text-left transition"
            :class="openId === t.id ? 'bg-primary/10' : 'hover:bg-stone-100 dark:hover:bg-stone-800'"
            @click="openId = t.id"
          >
            <div class="flex size-9 shrink-0 items-center justify-center rounded-full" :class="t.type === 'support' ? 'bg-primary/10' : 'bg-stone-200 dark:bg-stone-800'">
              <UIcon :name="t.type === 'support' ? 'i-lucide-life-buoy' : 'i-lucide-folder-kanban'" class="size-4" :class="t.type === 'support' ? 'text-primary' : 'text-stone-500'" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-medium">{{ title(t) }}</span>
                <span class="shrink-0 text-[11px] text-stone-400">{{ ago(t.last_message_at) }}</span>
              </div>
              <p class="truncate text-xs text-stone-500 dark:text-stone-400">{{ people(t) }}</p>
              <p v-if="t.preview" class="truncate text-xs text-stone-400">{{ t.preview }}</p>
            </div>
          </button>
        </div>
      </div>

      <div
        v-if="openThread"
        class="fixed inset-0 z-40 bg-white dark:bg-stone-900 lg:static lg:z-auto lg:h-[calc(100vh-9rem)] lg:rounded-2xl lg:border lg:border-stone-200 lg:dark:border-stone-800"
      >
        <MessageThread
          :conversation-id="openThread.id"
          :current-user-id="currentUserId"
          :title="title(openThread)"
          :subtitle="people(openThread)"
          read-only
        >
          <template #back>
            <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" class="lg:hidden" @click="openId = null" />
          </template>
        </MessageThread>
      </div>
      <div v-else class="hidden items-center justify-center rounded-2xl border border-stone-200 text-sm text-stone-400 lg:flex dark:border-stone-800">
        Select a conversation to read
      </div>
    </div>
  </div>
</template>
