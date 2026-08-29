<script setup lang="ts">
// Admin APPROVAL queue (approve-before-pay). Lists projects awaiting approval
// (status 'submitted'). Approving notifies the requester to pay; the project
// then shows as payment-pending until the gateway confirms (status funded/live).
import { useProjectActions } from '~/features/projects/application/useProjectActions'
import type { Database } from '~/shared/types/database'
import AdminProjectDetail from './AdminProjectDetail.vue'

const { approveProject } = useProjectActions()
const supabase = useSupabaseClient<Database>()
const toast = useToast()

type Row = Database['public']['Tables']['projects']['Row']

const items = ref<Row[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)
const selected = ref<string | null>(null)

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'submitted')
    .order('created_at', { ascending: true })
  items.value = (data as Row[]) ?? []
  loading.value = false
}
onMounted(load)

async function approve(p: Row) {
  busy.value = p.id
  try {
    await approveProject(p.id)
    toast.add({ title: 'Approved', description: `${p.title} — the requester has been notified to pay.`, color: 'success' })
    items.value = items.value.filter((x) => x.id !== p.id)
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({
      title: 'Could not approve',
      description: err?.data?.statusMessage ?? 'Another admin may have just handled it.',
      color: 'error',
    })
    await load() // conflict — refresh to the real state (same pattern as claim)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="zc-card h-32 animate-pulse" />
    </div>

    <div v-else-if="!items.length" class="flex flex-col items-center gap-2 py-20 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-check" class="size-6 text-success" />
      </div>
      <p class="font-medium">Nothing to approve</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">No projects are awaiting approval.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="p in items" :key="p.id" class="zc-card p-4">
        <div class="flex items-start justify-between gap-2">
          <h2 class="font-medium leading-tight">{{ p.title }}</h2>
          <span class="shrink-0 text-xl font-semibold tabular-nums">RM {{ p.budget_myr }}</span>
        </div>

        <p v-if="p.description" class="mt-2 line-clamp-3 text-sm text-stone-600 dark:text-stone-300">
          {{ p.description }}
        </p>

        <div class="mt-3 flex items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 p-2.5 text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-800/40">
          <UIcon name="i-lucide-info" class="size-3.5 shrink-0 text-primary" />
          Approving notifies the requester to pay. Money is only taken after they pay.
        </div>

        <div class="mt-3 flex gap-2">
          <UButton
            color="primary"
            block
            class="zc-tap"
            :loading="busy === p.id"
            icon="i-lucide-check"
            label="Approve"
            @click="approve(p)"
          />
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-eye"
            class="zc-tap"
            label="View"
            @click="selected = p.id"
          />
        </div>
      </article>
    </div>

    <AdminProjectDetail v-if="selected" :project-id="selected" @close="selected = null" />
  </div>
</template>
