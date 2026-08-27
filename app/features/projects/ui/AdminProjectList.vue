<script setup lang="ts">
// Every project on the platform, for the broker. Defaults to Live because
// that's what's actually in flight, but any status is one chip away.

import { useProjects } from '~/features/projects/application/useProjects'
import { formatRemaining } from '~/features/projects/domain'
import type { AdminProjectRow } from '~/features/projects/domain'
import AdminProjectDetail from './AdminProjectDetail.vue'

const { allProjects } = useProjects()
const toast = useToast()

const FILTERS = [
  { value: 'live', label: 'Live' },
  { value: 'submitted', label: 'Awaiting funding' },
  { value: 'funded', label: 'Funded' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'in_review', label: 'In review' },
  { value: 'finished', label: 'Finished' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: null, label: 'All' },
] as const

const status = ref<string | null>('live')
const search = ref('')
const rows = ref<AdminProjectRow[]>([])
const loading = ref(true)
const selected = ref<string | null>(null)

// Ticks the countdown without refetching.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => clearInterval(timer))

async function load() {
  loading.value = true
  try {
    rows.value = await allProjects(status.value)
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load projects', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
watch(status, load, { immediate: true })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.requester?.member_id?.toLowerCase().includes(q) ||
      p.provider?.member_id?.toLowerCase().includes(q),
  )
})

const statusColor = (s: string) =>
  (({
    live: 'primary',
    submitted: 'warning',
    finished: 'success',
    closed: 'success',
    cancelled: 'error',
  }) as Record<string, string>)[s] ?? 'neutral'

const money = (n: number | string | null) => (n === null ? '—' : `RM ${Number(n).toFixed(2)}`)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="f in FILTERS"
        :key="f.label"
        class="zc-tap rounded-full border px-3 py-1 text-xs transition"
        :class="status === f.value
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'border-stone-200 text-stone-500 hover:border-stone-300 dark:border-stone-800 dark:text-stone-400'"
        @click="status = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <UInput v-model="search" icon="i-lucide-search" placeholder="Search by title or member ID" class="w-full" />

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="zc-card h-20 animate-pulse" />
    </div>

    <div v-else-if="!filtered.length" class="flex flex-col items-center gap-2 py-16 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
        <UIcon name="i-lucide-folder-open" class="size-6 text-stone-400" />
      </div>
      <p class="font-medium">No projects here</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">Nothing matches this filter.</p>
    </div>

    <div v-else class="space-y-2">
      <button
        v-for="p in filtered"
        :key="p.id"
        class="zc-card zc-card-hover zc-tap w-full p-4 text-left"
        @click="selected = p.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="truncate font-medium">{{ p.title }}</h3>
              <UBadge :color="(statusColor(p.status) as any)" variant="soft" size="sm" class="shrink-0 capitalize">
                {{ p.status.replace(/_/g, ' ') }}
              </UBadge>
            </div>

            <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-user" class="size-3.5 shrink-0" />
                <span class="font-mono">{{ p.requester?.member_id ?? '—' }}</span>
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-hard-hat" class="size-3.5 shrink-0" />
                <span class="font-mono">{{ p.provider?.member_id ?? 'unawarded' }}</span>
              </span>
              <span v-if="p.status === 'live'" class="flex items-center gap-1">
                <UIcon name="i-lucide-users" class="size-3.5 shrink-0" />
                {{ p.applicant_count }} applicant{{ p.applicant_count === 1 ? '' : 's' }}
              </span>
              <span v-if="formatRemaining(p, now)" class="flex items-center gap-1 text-primary">
                <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" />
                {{ formatRemaining(p, now) }}
              </span>
            </div>
          </div>

          <div class="shrink-0 text-right">
            <div class="font-semibold tabular-nums">{{ money(p.budget_myr) }}</div>
            <UIcon name="i-lucide-chevron-right" class="mt-1 size-4 text-stone-400" />
          </div>
        </div>
      </button>
    </div>

    <AdminProjectDetail v-if="selected" :project-id="selected" @close="selected = null" />
  </div>
</template>
