<script setup lang="ts">
// Manual payout queue (admin). Lists provider payouts owed (80% of a cleared
// project). The admin transfers the money by hand (Touch 'n Go / bank), then
// marks it paid with a reference. "Ready" = past the fraud-hold window.
import { authedFetch } from '~/shared/lib/authedFetch'

interface PayoutRow {
  id: string
  amount_myr: number
  payout_method: string | null
  account_number: string | null
  account_holder: string | null
  status: string
  release_at: string
  created_at: string
  projects: { title: string } | null
}

const supabase = useSupabaseClient()
const toast = useToast()

const rows = ref<PayoutRow[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval>

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('payouts')
    .select('id, amount_myr, payout_method, account_number, account_holder, status, release_at, created_at, projects(title)')
    .eq('status', 'pending')
    .order('release_at', { ascending: true })
  rows.value = (data as PayoutRow[]) ?? []
  loading.value = false
}
onMounted(() => { load(); timer = setInterval(() => (now.value = Date.now()), 30_000) })
onBeforeUnmount(() => clearInterval(timer))

const methodLabel = (m: string | null) =>
  m === 'touch_n_go' ? "Touch 'n Go" : m === 'binance' ? 'Binance' : (m ?? '—')

const isReady = (r: PayoutRow) => new Date(r.release_at).getTime() <= now.value
function holdLeft(r: PayoutRow) {
  const ms = new Date(r.release_at).getTime() - now.value
  if (ms <= 0) return null
  const h = Math.ceil(ms / 3_600_000)
  return `on hold ~${h}h`
}

async function markPaid(r: PayoutRow) {
  const reference = window.prompt(`Reference for the ${methodLabel(r.payout_method)} transfer of RM ${r.amount_myr} to ${r.account_holder ?? 'provider'}? (optional)`)
  if (reference === null) return // cancelled
  busyId.value = r.id
  try {
    await authedFetch('/api/payouts/mark-paid', { method: 'POST', body: { payoutId: r.id, reference } })
    toast.add({ title: 'Marked as paid', color: 'success' })
    await load()
  } catch (e) {
    toast.add({ title: 'Could not update', description: (e as { message?: string })?.message, color: 'error' })
  } finally { busyId.value = null }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">Payouts</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Provider payments to send manually (80% of each cleared project). Transfer the money, then mark it paid.
      </p>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="zc-card h-24 animate-pulse" />
    </div>

    <div
      v-else-if="!rows.length"
      class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-16 text-center dark:border-stone-800"
    >
      <UIcon name="i-lucide-check-circle" class="size-8 text-stone-300 dark:text-stone-600" />
      <p class="text-sm text-stone-500 dark:text-stone-400">No payouts pending.</p>
    </div>

    <div v-else class="space-y-3">
      <article v-for="r in rows" :key="r.id" class="zc-card p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="truncate font-serif text-lg leading-tight">{{ r.projects?.title ?? 'Project' }}</h2>
          <span class="shrink-0 text-lg font-semibold tabular-nums text-primary">RM {{ r.amount_myr }}</span>
        </div>

        <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><dt class="text-xs text-stone-400">Pay to</dt><dd class="font-medium">{{ r.account_holder ?? '—' }}</dd></div>
          <div><dt class="text-xs text-stone-400">Method</dt><dd>{{ methodLabel(r.payout_method) }}</dd></div>
          <div class="col-span-2"><dt class="text-xs text-stone-400">Account</dt><dd class="font-mono">{{ r.account_number ?? '—' }}</dd></div>
        </dl>

        <div class="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
          <span v-if="!isReady(r)" class="flex items-center gap-1 text-xs text-stone-400">
            <UIcon name="i-lucide-clock" class="size-3.5" /> {{ holdLeft(r) }}
          </span>
          <span v-else class="flex items-center gap-1 text-xs text-success">
            <UIcon name="i-lucide-circle-check" class="size-3.5" /> ready to pay
          </span>
          <UButton
            color="primary"
            size="sm"
            :loading="busyId === r.id"
            label="Mark as paid"
            @click="markPaid(r)"
          />
        </div>
      </article>
    </div>
  </div>
</template>
