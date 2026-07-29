<script setup lang="ts">
// Admin approval for service listings. Mirrors the royalty queue: see the
// listing and its tiers, then approve or reject with a reason.

import { useServices, useServiceModeration } from '~/features/services/application/useServices'
import { usePublicMedia } from '~/shared/lib/media'
import type { PendingService } from '~/features/services/domain'

const { pendingForAdmin } = useServices()
const { approve, reject } = useServiceModeration()
const { thumbUrl } = usePublicMedia()
const toast = useToast()

const items = ref<PendingService[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)
const rejectingId = ref<string | null>(null)
const rejectReason = ref('')

async function load() {
  loading.value = true
  try {
    items.value = await pendingForAdmin()
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load the queue', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function onApprove(it: PendingService) {
  busy.value = it.id
  try {
    await approve(it.id)
    toast.add({ title: 'Published', description: `${it.title} is now in the store.`, color: 'success' })
    items.value = items.value.filter((x) => x.id !== it.id)
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Approve failed', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}

async function confirmReject(it: PendingService) {
  busy.value = it.id
  try {
    await reject(it.id, rejectReason.value)
    toast.add({ title: 'Rejected', color: 'neutral' })
    items.value = items.value.filter((x) => x.id !== it.id)
    rejectingId.value = null
    rejectReason.value = ''
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Reject failed', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="grid gap-4 lg:grid-cols-2">
      <div v-for="i in 2" :key="i" class="zc-card h-48 animate-pulse" />
    </div>

    <div v-else-if="!items.length" class="flex flex-col items-center gap-2 py-20 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-check" class="size-6 text-success" />
      </div>
      <p class="font-medium">Nothing to review</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">No services are waiting for approval.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="it in items" :key="it.id" class="zc-card p-4">
        <div class="flex gap-3">
          <img v-if="it.cover_image" :src="thumbUrl(it.cover_image, 200)" :alt="it.title" class="size-16 shrink-0 rounded-lg object-cover" >
          <div v-else class="flex size-16 shrink-0 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800">
            <UIcon name="i-lucide-briefcase" class="size-6 text-stone-400" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="truncate font-serif text-lg leading-tight">{{ it.title }}</h3>
            <p class="truncate text-xs text-stone-500 dark:text-stone-400">
              {{ it.provider?.full_name }} <span class="font-mono">{{ it.provider?.member_id }}</span>
            </p>
          </div>
        </div>

        <p v-if="it.description" class="mt-3 line-clamp-2 text-sm text-stone-600 dark:text-stone-300">{{ it.description }}</p>

        <div class="mt-3 space-y-1.5">
          <div v-for="t in it.tiers" :key="t.id" class="rounded-lg border border-stone-100 p-2.5 text-sm dark:border-stone-800">
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ t.name }}</span>
              <span class="font-semibold tabular-nums">${{ t.price_usd }}</span>
            </div>
            <p v-if="t.description" class="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{{ t.description }}</p>
          </div>
        </div>

        <div v-if="rejectingId === it.id" class="mt-4 space-y-2">
          <UTextarea v-model="rejectReason" placeholder="Reason (optional)" :rows="2" class="w-full" />
          <div class="flex gap-2">
            <UButton color="error" size="sm" label="Confirm reject" :loading="busy === it.id" @click="confirmReject(it)" />
            <UButton color="neutral" variant="ghost" size="sm" label="Cancel" @click="rejectingId = null" />
          </div>
        </div>

        <div v-else class="mt-4 flex gap-2">
          <UButton color="primary" size="sm" icon="i-lucide-check" label="Approve" class="zc-tap flex-1" :loading="busy === it.id" @click="onApprove(it)" />
          <UButton color="error" variant="soft" size="sm" icon="i-lucide-x" label="Reject" class="zc-tap" @click="rejectingId = it.id; rejectReason = ''" />
        </div>
      </article>
    </div>
  </div>
</template>
