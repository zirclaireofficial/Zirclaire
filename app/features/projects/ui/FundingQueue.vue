<script setup lang="ts">
import { useProjectActions } from '~/features/projects/application/useProjectActions'
import type { Database } from '~/shared/types/database'

const { fundAndLaunch } = useProjectActions()
const supabase = useSupabaseClient<Database>()
const toast = useToast()

type Row = Database['public']['Tables']['projects']['Row'] & {
  payments: { method: string; amount_usd: number; reference: string | null; status: string; created_at: string }[]
}

const items = ref<Row[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('projects')
    .select('*, payments(method, amount_usd, reference, status, created_at)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: true })
  items.value = (data as Row[]) ?? []
  loading.value = false
}
onMounted(load)

function claim(p: Row) {
  return (p.payments ?? [])
    .filter((x) => x.status === 'claimed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
}

async function launch(p: Row) {
  busy.value = p.id
  try {
    await fundAndLaunch(p.id)
    toast.add({ title: 'Funded & live', description: `${p.title} is now on the feed.`, color: 'success' })
    items.value = items.value.filter((x) => x.id !== p.id)
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not launch', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}

const methodLabel = (m: string) => (m === 'binance' ? 'Binance' : "Touch 'n Go")
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
      <p class="font-medium">Nothing to fund</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">No projects are awaiting funding.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="p in items" :key="p.id" class="zc-card p-4">
        <div class="flex items-start justify-between gap-2">
          <h2 class="font-medium leading-tight">{{ p.title }}</h2>
          <span class="shrink-0 text-xl font-semibold tabular-nums">${{ p.budget_usd }}</span>
        </div>

        <div class="mt-3 rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm dark:border-stone-800 dark:bg-stone-800/40">
          <template v-if="claim(p)">
            <div class="flex items-center gap-2 text-success">
              <UIcon name="i-lucide-badge-check" class="size-4" />
              <span class="font-medium">Payment claimed</span>
            </div>
            <div class="mt-1 grid grid-cols-2 gap-y-1 text-stone-600 dark:text-stone-300">
              <span class="text-stone-400">Method</span><span>{{ methodLabel(claim(p).method) }}</span>
              <span class="text-stone-400">Amount</span><span class="tabular-nums">${{ claim(p).amount_usd }}</span>
              <span class="text-stone-400">Reference</span><span class="font-mono">{{ claim(p).reference }}</span>
            </div>
          </template>
          <div v-else class="flex items-center gap-2 text-stone-500">
            <UIcon name="i-lucide-clock" class="size-4" /> Awaiting the requester's payment
          </div>
        </div>

        <UButton
          color="primary"
          block
          class="zc-tap mt-3"
          :loading="busy === p.id"
          :disabled="!claim(p)"
          icon="i-lucide-rocket"
          :label="claim(p) ? 'Verify & launch' : 'Waiting for payment'"
          @click="launch(p)"
        />
      </article>
    </div>
  </div>
</template>
