<script setup lang="ts">
// The public royalty store — browse published novels, research and journals.
// Public read (SEO); buying needs an approved account (handled in the detail).

import { useRoyalties } from '~/features/royalties/application/useRoyalties'
import { useMe } from '~/features/auth/application/useMe'
import { WORK_TYPES } from '~/features/royalties/domain'
import type { StoreItem, WorkType } from '~/features/royalties/domain'
import RoyaltyCard from './RoyaltyCard.vue'
import RoyaltyDetail from './RoyaltyDetail.vue'

const { browseStore } = useRoyalties()
const { me } = useMe()
const toast = useToast()

const items = ref<StoreItem[]>([])
const loading = ref(true)
const type = ref<WorkType | null>(null)
const search = ref('')
const selected = ref<StoreItem | null>(null)

// Requesters (owners of completed deliverables) are the sellers here.
const isSeller = computed(() => me.value?.role === 'service_requester' && me.value?.kyc_status === 'approved')

const FILTERS = [{ value: null, label: 'All' }, ...WORK_TYPES]

async function load() {
  loading.value = true
  try {
    items.value = await browseStore(type.value)
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load the store', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
watch(type, load, { immediate: true })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(
    (i) => i.title.toLowerCase().includes(q) || i.creator?.full_name?.toLowerCase().includes(q),
  )
})

function onPurchased() {
  // Reflect the new "owned" + sold count without a full refetch feel.
  load()
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between">
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Royalties</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Novels, research and journals from the community.</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton to="/services" size="xs" color="neutral" variant="soft" icon="i-lucide-briefcase" label="Services" class="zc-tap" />
        <UButton v-if="isSeller" to="/royalties/publish" size="xs" color="primary" icon="i-lucide-plus" label="Sell a work" class="zc-tap" />
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="f in FILTERS"
        :key="f.label"
        class="zc-tap rounded-full border px-3 py-1 text-xs transition"
        :class="type === f.value
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'border-stone-200 text-stone-500 hover:border-stone-300 dark:border-stone-800 dark:text-stone-400'"
        @click="type = (f.value as WorkType | null)"
      >
        {{ f.label }}
      </button>
    </div>

    <UInput v-model="search" icon="i-lucide-search" placeholder="Search titles or authors" class="w-full" />

    <div v-if="loading" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div v-for="i in 4" :key="i" class="zc-card h-56 animate-pulse" />
    </div>

    <div v-else-if="!filtered.length" class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-16 text-center dark:border-stone-800">
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
        <UIcon name="i-lucide-book-open-text" class="size-6 text-primary" />
      </div>
      <p class="font-medium">Nothing here yet</p>
      <p class="max-w-xs text-sm text-stone-500 dark:text-stone-400">
        {{ isSeller ? 'Be the first to list a completed work.' : 'Published works will appear here.' }}
      </p>
      <UButton v-if="isSeller" to="/royalties/publish" color="primary" size="sm" label="Sell a work" class="zc-tap mt-1" />
    </div>

    <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <RoyaltyCard v-for="i in filtered" :key="i.id" :item="i" @open="selected = $event" />
    </div>

    <RoyaltyDetail v-if="selected" :item="selected" @close="selected = null" @purchased="onPurchased" />
  </div>
</template>
