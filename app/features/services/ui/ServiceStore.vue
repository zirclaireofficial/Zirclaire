<script setup lang="ts">
// The public services store — browse provider offerings. Public read;
// ordering needs an approved account (handled in the detail sheet).

import { useServices } from '~/features/services/application/useServices'
import { useMe } from '~/features/auth/application/useMe'
import type { StoreService } from '~/features/services/domain'
import ServiceCard from './ServiceCard.vue'
import ServiceDetail from './ServiceDetail.vue'

const { browseStore } = useServices()
const { me } = useMe()
const toast = useToast()

const items = ref<StoreService[]>([])
const loading = ref(true)
const search = ref('')
const selected = ref<StoreService | null>(null)

const isProvider = computed(() => me.value?.role === 'service_provider' && me.value?.kyc_status === 'approved')

async function load() {
  loading.value = true
  try {
    items.value = await browseStore()
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load services', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(
    (s) => s.title.toLowerCase().includes(q) || s.provider?.full_name?.toLowerCase().includes(q),
  )
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between">
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">MyService</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Fixed-price services from verified providers.</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton to="/royalties" size="xs" color="neutral" variant="soft" icon="i-lucide-book-open-text" label="Royalties" class="zc-tap" />
        <UButton v-if="isProvider" to="/services/publish" size="xs" color="primary" icon="i-lucide-plus" label="New service" class="zc-tap" />
      </div>
    </div>

    <UInput v-model="search" icon="i-lucide-search" placeholder="Search services or providers" class="w-full" />

    <div v-if="loading" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div v-for="i in 4" :key="i" class="zc-card h-52 animate-pulse" />
    </div>

    <div v-else-if="!filtered.length" class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-16 text-center dark:border-stone-800">
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
        <UIcon name="i-lucide-briefcase" class="size-6 text-primary" />
      </div>
      <p class="font-medium">No services yet</p>
      <p class="max-w-xs text-sm text-stone-500 dark:text-stone-400">
        {{ isProvider ? 'Be the first to list a service.' : 'Provider services will appear here.' }}
      </p>
      <UButton v-if="isProvider" to="/services/publish" color="primary" size="sm" label="New service" class="zc-tap mt-1" />
    </div>

    <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <ServiceCard v-for="s in filtered" :key="s.id" :service="s" @open="selected = $event" />
    </div>

    <ServiceDetail v-if="selected" :service="selected" @close="selected = null" @ordered="load" />
  </div>
</template>
