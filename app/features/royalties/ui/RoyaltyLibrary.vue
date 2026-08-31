<script setup lang="ts">
// The buyer's library — works they've purchased, with a re-download button.
// Also where a creator downloads their own work (creator entitlement is
// checked server-side).

import { useRoyalties } from '~/features/royalties/application/useRoyalties'
import { useMediaViewer } from '~/shared/lib/useMediaViewer'
import { workTypeLabel } from '~/features/royalties/domain'
import type { PurchasedItem } from '~/features/royalties/domain'

const { myLibrary, downloadUrl } = useRoyalties()
const { download: saveFile } = useMediaViewer()
const toast = useToast()

const items = ref<PurchasedItem[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    items.value = await myLibrary()
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function download(it: PurchasedItem) {
  busy.value = it.item_id
  try {
    const url = await downloadUrl(it.item_id)
    await saveFile(url, it.title || 'work')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not get the file', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">My library</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Works you've purchased.</p>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 2" :key="i" class="zc-card h-16 animate-pulse" />
    </div>

    <div v-else-if="!items.length" class="flex flex-col items-center gap-2 py-16 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
        <UIcon name="i-lucide-library" class="size-6 text-stone-400" />
      </div>
      <p class="font-medium">Nothing yet</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">Works you buy show up here to download.</p>
      <UButton to="/royalties" color="primary" size="sm" label="Browse the store" class="zc-tap mt-1" />
    </div>

    <div v-else class="space-y-2">
      <div v-for="it in items" :key="it.purchase_id" class="zc-card flex items-center gap-3 p-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <UIcon name="i-lucide-book-open-text" class="size-5 text-primary" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ it.title }}</p>
          <p class="truncate text-xs text-stone-500 dark:text-stone-400">
            {{ workTypeLabel(it.work_type) }} · {{ it.creator?.full_name }}
          </p>
        </div>
        <UButton color="primary" variant="soft" size="sm" icon="i-lucide-download" label="Download" class="zc-tap shrink-0" :loading="busy === it.item_id" @click="download(it)" />
      </div>
    </div>
  </div>
</template>
