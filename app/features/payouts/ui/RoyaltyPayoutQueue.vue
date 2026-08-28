<script setup lang="ts">
// Admin manual royalty payout queue. Each row = a royalty sale's 15% owed to
// the owner (requester). Admin pays by hand, uploads proof (mandatory), marks
// paid. The owner is then notified.
import { authedFetch } from '~/shared/lib/authedFetch'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'

interface Row {
  id: string
  amount_myr: number
  owner_id: string
  created_at: string
  title: string
  owner_name: string | null
  payout_method: string | null
  payout_account: string | null
}

const supabase = useSupabaseClient()
const { upload } = useMediaUpload()
const toast = useToast()

const rows = ref<Row[]>([])
const loading = ref(true)
const openId = ref<string | null>(null)
const busyId = ref<string | null>(null)
const reference = ref('')
const proofFile = ref<File | null>(null)

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('royalty_payouts')
    .select('id, amount_myr, owner_id, created_at, royalty_purchases(royalty_items(title))')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  const list = (data as any[]) ?? []
  // owner details (name + payout account) in one lookup
  const ownerIds = [...new Set(list.map((r) => r.owner_id))]
  const owners = new Map<string, any>()
  if (ownerIds.length) {
    const { data: profs } = await supabase
      .from('profiles').select('id, full_name, payout_provider, payout_account').in('id', ownerIds)
    for (const p of (profs as any[]) ?? []) owners.set(p.id, p)
  }
  rows.value = list.map((r) => ({
    id: r.id,
    amount_myr: Number(r.amount_myr),
    owner_id: r.owner_id,
    created_at: r.created_at,
    title: r.royalty_purchases?.royalty_items?.title ?? 'Work',
    owner_name: owners.get(r.owner_id)?.full_name ?? null,
    payout_method: owners.get(r.owner_id)?.payout_provider ?? null,
    payout_account: owners.get(r.owner_id)?.payout_account ?? null,
  }))
  loading.value = false
}
onMounted(load)

const methodLabel = (m: string | null) =>
  m === 'touch_n_go' ? "Touch 'n Go" : m === 'binance' ? 'Binance' : (m ?? '—')

function openPay(r: Row) { openId.value = openId.value === r.id ? null : r.id; reference.value = ''; proofFile.value = null }
function onProof(e: Event) { proofFile.value = (e.target as HTMLInputElement).files?.[0] ?? null }

async function markPaid(r: Row) {
  if (!proofFile.value) { toast.add({ title: 'Upload proof of payment first', color: 'warning' }); return }
  busyId.value = r.id
  try {
    const up = await upload(proofFile.value, 'payout-proof')
    await authedFetch('/api/royalty-payouts/mark-paid', {
      method: 'POST',
      body: { payoutId: r.id, reference: reference.value.trim(), proofUrl: up.publicId },
    })
    toast.add({ title: 'Payout recorded as paid', color: 'success' })
    openId.value = null
    await load()
  } catch (e) {
    toast.add({ title: 'Could not save', description: (e as { message?: string })?.message, color: 'error' })
  } finally { busyId.value = null }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">Royalty payouts</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Owner royalties from sales (15%). Pay by bank, upload proof, then mark paid.
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
      <p class="text-sm text-stone-500 dark:text-stone-400">No royalty payouts pending.</p>
    </div>

    <div v-else class="space-y-3">
      <article v-for="r in rows" :key="r.id" class="zc-card p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="truncate font-serif text-lg leading-tight">{{ r.title }}</h2>
          <span class="shrink-0 text-lg font-semibold tabular-nums text-primary">RM {{ r.amount_myr }}</span>
        </div>

        <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><dt class="text-xs text-stone-400">Pay to (owner)</dt><dd class="font-medium">{{ r.owner_name ?? '—' }}</dd></div>
          <div><dt class="text-xs text-stone-400">Method</dt><dd>{{ methodLabel(r.payout_method) }}</dd></div>
          <div class="col-span-2"><dt class="text-xs text-stone-400">Account</dt><dd class="font-mono">{{ r.payout_account ?? '—' }}</dd></div>
        </dl>

        <div class="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <UButton v-if="openId !== r.id" color="primary" size="sm" label="Record payment" @click="openPay(r)" />
          <div v-else class="space-y-3">
            <UFormField label="Proof of payment (required)" hint="Screenshot or PDF of the transfer">
              <input type="file" accept="image/*,application/pdf" class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800" @change="onProof" >
            </UFormField>
            <UFormField label="Reference (optional)">
              <UInput v-model="reference" placeholder="Transaction reference" class="w-full" />
            </UFormField>
            <div class="flex gap-2">
              <UButton color="primary" :loading="busyId === r.id" :disabled="!proofFile" label="Mark as paid" @click="markPaid(r)" />
              <UButton color="neutral" variant="ghost" label="Cancel" @click="openId = null" />
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
