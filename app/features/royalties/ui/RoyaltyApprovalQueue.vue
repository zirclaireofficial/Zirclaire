<script setup lang="ts">
// Admin approval for the royalty store. Mirrors the KYC queue: see what was
// submitted, open the file to vet it, then approve or reject with a reason.

import { useRoyalties, useRoyaltyModeration } from '~/features/royalties/application/useRoyalties'
import { useKycAdmin } from '~/features/kyc/application/useKycAdmin'
import { usePublicMedia } from '~/shared/lib/media'
import { workTypeLabel } from '~/features/royalties/domain'
import type { PendingItem } from '~/features/royalties/domain'

const { pendingForAdmin } = useRoyalties()
const { approve, reject } = useRoyaltyModeration()
const { signedMedia } = useKycAdmin()
const { thumbUrl } = usePublicMedia()
const toast = useToast()

const items = ref<PendingItem[]>([])
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

async function onApprove(it: PendingItem) {
  busy.value = it.id
  try {
    await approve(it.id)
    toast.add({ title: 'Published', description: `${it.title} is now in the store.`, color: 'success' })
    items.value = items.value.filter((x) => x.id !== it.id)
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({
      title: 'Approve failed',
      description: err?.data?.statusMessage ?? 'Another admin may have just handled it.',
      color: 'error',
    })
    await load() // conflict — refresh to the real state
  } finally {
    busy.value = null
  }
}

async function confirmReject(it: PendingItem) {
  busy.value = it.id
  try {
    await reject(it.id, rejectReason.value)
    toast.add({ title: 'Rejected', color: 'neutral' })
    items.value = items.value.filter((x) => x.id !== it.id)
    rejectingId.value = null
    rejectReason.value = ''
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({
      title: 'Reject failed',
      description: err?.data?.statusMessage ?? 'Another admin may have just handled it.',
      color: 'error',
    })
    await load() // conflict — refresh to the real state
  } finally {
    busy.value = null
  }
}

// Vet the actual file — reuses the admin signed-media route (private assets).
const fileUrl = ref<string | null>(null)
async function viewFile(it: PendingItem) {
  try {
    fileUrl.value = await signedMedia(it.file_url)
    window.open(fileUrl.value, '_blank')
  } catch {
    toast.add({ title: 'Could not open the file', color: 'error' })
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="grid gap-4 lg:grid-cols-2">
      <div v-for="i in 2" :key="i" class="zc-card h-40 animate-pulse" />
    </div>

    <div v-else-if="!items.length" class="flex flex-col items-center gap-2 py-20 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-check" class="size-6 text-success" />
      </div>
      <p class="font-medium">Nothing to review</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">No works are waiting for approval.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="it in items" :key="it.id" class="zc-card p-4">
        <div class="flex gap-3">
          <img v-if="it.cover_image" :src="thumbUrl(it.cover_image, 200)" :alt="it.title" class="size-16 shrink-0 rounded-lg object-cover" >
          <div v-else class="flex size-16 shrink-0 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800">
            <UIcon name="i-lucide-book-open-text" class="size-6 text-stone-400" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <UBadge color="neutral" variant="soft" size="sm" class="capitalize">{{ workTypeLabel(it.work_type) }}</UBadge>
              <span class="font-semibold tabular-nums">${{ it.price_usd }}</span>
            </div>
            <h3 class="mt-1 truncate font-serif text-lg leading-tight">{{ it.title }}</h3>
            <p class="truncate text-xs text-stone-500 dark:text-stone-400">
              {{ it.creator?.full_name }} <span class="font-mono">{{ it.creator?.member_id }}</span>
            </p>
          </div>
        </div>

        <p v-if="it.description" class="mt-3 line-clamp-3 text-sm text-stone-600 dark:text-stone-300">{{ it.description }}</p>

        <UButton class="zc-tap mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-file-text" label="Open file" @click="viewFile(it)" />

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
