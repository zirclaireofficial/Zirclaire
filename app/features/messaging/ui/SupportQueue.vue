<script setup lang="ts">
// The admin service desk. Shows support threads that are unclaimed (the shared
// queue) or claimed by this admin. Claiming is atomic — first admin wins.

import { useMessaging, useSupportModeration } from '~/features/messaging/application/useMessaging'
import { usePublicMedia } from '~/shared/lib/media'
import { ticketLabel } from '~/features/messaging/domain'
import type { SupportTicket } from '~/features/messaging/domain'
import MessageThread from './MessageThread.vue'

const { supportQueue } = useMessaging()
const { claim } = useSupportModeration()
const { publicMediaUrl } = usePublicMedia()
const user = useSupabaseUser()
const toast = useToast()

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? '')

const tickets = ref<SupportTicket[]>([])
const loading = ref(true)
const openId = ref<string | null>(null)
const claiming = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    tickets.value = await supportQueue()
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load the desk', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const openTicket = computed(() => tickets.value.find((t) => t.id === openId.value) ?? null)
const mine = computed(() => tickets.value.filter((t) => t.assigned_admin_id === currentUserId.value))
const unclaimed = computed(() => tickets.value.filter((t) => !t.assigned_admin_id))

async function onClaim(t: SupportTicket) {
  claiming.value = t.id
  try {
    await claim(t.id)
    await load()
    openId.value = t.id
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: 'Could not claim', description: err?.data?.statusMessage ?? 'Someone may have taken it first.', color: 'error' })
    await load()
  } finally {
    claiming.value = null
  }
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-life-buoy" class="size-6 text-primary" />
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Service desk</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Member support requests. Claim one to handle it.</p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div :class="openId ? 'hidden lg:block' : ''">
        <div v-if="loading" class="space-y-2">
          <div v-for="i in 2" :key="i" class="zc-card h-20 animate-pulse" />
        </div>

        <template v-else>
          <!-- Unclaimed queue -->
          <p class="zc-eyebrow mb-2">Waiting ({{ unclaimed.length }})</p>
          <p v-if="!unclaimed.length" class="mb-4 text-sm text-stone-500 dark:text-stone-400">Nothing waiting.</p>
          <div v-else class="mb-4 space-y-2">
            <div v-for="t in unclaimed" :key="t.id" class="zc-card p-3">
              <div class="flex items-center gap-2.5">
                <img v-if="t.requester?.profile_picture" :src="publicMediaUrl(t.requester.profile_picture)" :alt="t.requester.full_name ?? ''" class="size-9 shrink-0 rounded-full object-cover" >
                <div v-else class="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium dark:bg-stone-800">{{ initials(t.requester?.full_name) }}</div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono text-xs font-medium text-primary">{{ ticketLabel(t.ticket_number) }}</span>
                    <p class="truncate text-sm font-medium">{{ t.requester?.full_name ?? 'Member' }}</p>
                  </div>
                  <p class="truncate text-xs text-stone-500 dark:text-stone-400">{{ t.preview || 'New request' }}</p>
                </div>
              </div>
              <UButton class="zc-tap mt-2" color="primary" size="xs" block :label="`Claim ${ticketLabel(t.ticket_number)}`" :loading="claiming === t.id" @click="onClaim(t)" />
            </div>
          </div>

          <!-- Mine -->
          <p class="zc-eyebrow mb-2">Yours ({{ mine.length }})</p>
          <p v-if="!mine.length" class="text-sm text-stone-500 dark:text-stone-400">You haven't claimed any.</p>
          <div v-else class="space-y-1.5">
            <button
              v-for="t in mine"
              :key="t.id"
              class="zc-tap flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition"
              :class="openId === t.id ? 'bg-primary/10' : 'hover:bg-stone-100 dark:hover:bg-stone-800'"
              @click="openId = t.id"
            >
              <img v-if="t.requester?.profile_picture" :src="publicMediaUrl(t.requester.profile_picture)" :alt="t.requester.full_name ?? ''" class="size-9 shrink-0 rounded-full object-cover" >
              <div v-else class="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium dark:bg-stone-800">{{ initials(t.requester?.full_name) }}</div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="font-mono text-xs font-medium text-primary">{{ ticketLabel(t.ticket_number) }}</span>
                  <p class="truncate text-sm font-medium">{{ t.requester?.full_name ?? 'Member' }}</p>
                </div>
                <p class="truncate text-xs text-stone-500 dark:text-stone-400">{{ t.preview || '—' }}</p>
              </div>
            </button>
          </div>
        </template>
      </div>

      <!-- Open thread -->
      <div
        v-if="openTicket"
        class="fixed inset-0 z-40 bg-white dark:bg-stone-900 lg:static lg:z-auto lg:h-[calc(100vh-9rem)] lg:rounded-2xl lg:border lg:border-stone-200 lg:dark:border-stone-800"
      >
        <MessageThread
          :conversation-id="openTicket.id"
          :current-user-id="currentUserId"
          :title="openTicket.requester?.full_name ?? 'Member'"
          :subtitle="openTicket.requester?.member_id"
        >
          <template #back>
            <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" class="lg:hidden" @click="openId = null" />
          </template>
        </MessageThread>
      </div>

      <div v-else class="hidden items-center justify-center rounded-2xl border border-stone-200 text-sm text-stone-400 lg:flex dark:border-stone-800">
        Claim a request to reply
      </div>
    </div>
  </div>
</template>
