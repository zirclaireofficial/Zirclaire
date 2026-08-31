<script setup lang="ts">
// A provider's awarded/active projects — shown ABOVE the live feed so their
// current work comes first. Clicking one opens the work view (brief, updates,
// submit).
import type { Database } from '~/shared/types/database'
import ProviderProjectDetail from './ProviderProjectDetail.vue'

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const toast = useToast()

type Row = Database['public']['Tables']['projects']['Row']
const ACTIVE = ['awarded', 'in_progress', 'revision_requested', 'submitted_work', 'in_review']
const DONE = ['closed', 'cancelled']

const rows = ref<Row[]>([])
const loading = ref(true)
const selected = ref<string | null>(null)

const activeRows = computed(() => rows.value.filter((p) => ACTIVE.includes(p.status)))
const completedRows = computed(() => rows.value.filter((p) => DONE.includes(p.status)))

async function load() {
  const uid = (user.value as { sub?: string } | null)?.sub
  if (!uid) { loading.value = false; return }
  loading.value = true
  try {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('awarded_provider_id', uid)
      .in('status', [...ACTIVE, ...DONE])
      .order('deadline_at', { ascending: true, nullsFirst: false })
    rows.value = (data as Row[]) ?? []
  } catch (e) {
    toast.add({ title: 'Could not load your work', description: (e as { message?: string })?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
watch(user, load, { immediate: true })

const statusColor = (s: string) =>
  (({ awarded: 'primary', in_progress: 'primary', revision_requested: 'warning', submitted_work: 'success', in_review: 'success', closed: 'success', cancelled: 'error' }) as Record<string, string>)[s] ?? 'neutral'
const money = (n: number | string | null) => (n === null ? '—' : `RM ${Number(n).toFixed(2)}`)
const deadline = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null)
</script>

<template>
  <section v-if="loading || rows.length" class="mb-6">
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 2" :key="i" class="zc-card h-20 animate-pulse" />
    </div>

    <template v-else>
      <!-- Active work -->
      <template v-if="activeRows.length">
        <div class="mb-3 flex items-center gap-2">
          <h2 class="zc-title font-serif text-xl leading-tight">Your work</h2>
          <UBadge color="primary" variant="soft" size="sm">{{ activeRows.length }}</UBadge>
        </div>
        <div class="space-y-2">
          <button v-for="p in activeRows" :key="p.id" class="zc-card zc-card-hover zc-tap w-full p-4 text-left" @click="selected = p.id">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="truncate font-medium">{{ p.title }}</h3>
                  <UBadge :color="(statusColor(p.status) as any)" variant="soft" size="sm" class="shrink-0 capitalize">{{ p.status.replace(/_/g, ' ') }}</UBadge>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                  <span class="tabular-nums font-medium">{{ money(p.budget_myr) }}</span>
                  <span v-if="deadline(p.deadline_at)" class="flex items-center gap-1">
                    <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" /> due {{ deadline(p.deadline_at) }}
                  </span>
                </div>
              </div>
              <UIcon name="i-lucide-chevron-right" class="mt-0.5 size-4 shrink-0 text-stone-400" />
            </div>
          </button>
        </div>
      </template>

      <!-- Completed / closed -->
      <template v-if="completedRows.length">
        <div class="mb-3 mt-6 flex items-center gap-2">
          <h2 class="zc-title font-serif text-xl leading-tight">Completed</h2>
          <UBadge color="neutral" variant="soft" size="sm">{{ completedRows.length }}</UBadge>
        </div>
        <div class="space-y-2">
          <button v-for="p in completedRows" :key="p.id" class="zc-card zc-card-hover zc-tap w-full p-4 text-left opacity-90" @click="selected = p.id">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="truncate font-medium">{{ p.title }}</h3>
                  <UBadge :color="(statusColor(p.status) as any)" variant="soft" size="sm" class="shrink-0 capitalize">{{ p.status === 'closed' ? 'completed' : p.status }}</UBadge>
                </div>
                <div class="mt-1 text-xs text-stone-500 dark:text-stone-400"><span class="tabular-nums font-medium">{{ money(p.budget_myr) }}</span></div>
              </div>
              <UIcon name="i-lucide-chevron-right" class="mt-0.5 size-4 shrink-0 text-stone-400" />
            </div>
          </button>
        </div>
      </template>
    </template>

    <ProviderProjectDetail v-if="selected" :project-id="selected" @close="selected = null" @changed="load" />

    <div class="mt-6 border-b border-stone-200 dark:border-stone-800" />
  </section>
</template>
