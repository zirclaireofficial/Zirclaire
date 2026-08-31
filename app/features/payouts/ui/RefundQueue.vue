<script setup lang="ts">
// Master manual REFUND queue. A cancelled/auto-expired project owes the
// requester 95% back. Master refunds by hand, uploads proof, marks paid.
import { authedFetch } from '~/shared/lib/authedFetch'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import { useMediaViewer } from '~/shared/lib/useMediaViewer'

interface RefundRow {
  id: string
  amount_myr: number
  reason: string | null
  status: string
  manual_reference: string | null
  proof_url: string | null
  paid_at: string | null
  created_at: string
  projects: { title: string } | null
  profiles: { full_name: string | null; email: string | null; phone: string | null } | null
}

const supabase = useSupabaseClient()
const { upload } = useMediaUpload()
const { showImage } = useMediaViewer()
const toast = useToast()

const tab = ref<'pending' | 'paid'>('pending')
const rows = ref<RefundRow[]>([])
const loading = ref(true)
const openId = ref<string | null>(null)
const busyId = ref<string | null>(null)
const proofBusy = ref<string | null>(null)
const reference = ref('')
const proofFile = ref<File | null>(null)

async function load() {
  loading.value = true
  let qy = supabase
    .from('refunds')
    .select('id, amount_myr, reason, status, manual_reference, proof_url, paid_at, created_at, projects(title), profiles(full_name, email, phone)')
    .eq('status', tab.value)
  qy = tab.value === 'paid' ? qy.order('paid_at', { ascending: false }) : qy.order('created_at', { ascending: true })
  const { data } = await qy
  rows.value = (data as RefundRow[]) ?? []
  loading.value = false
}
watch(tab, load)
onMounted(load)

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')

function openPay(r: RefundRow) {
  openId.value = openId.value === r.id ? null : r.id
  reference.value = ''
  proofFile.value = null
}
function onProof(e: Event) { proofFile.value = (e.target as HTMLInputElement).files?.[0] ?? null }

async function markPaid(r: RefundRow) {
  if (!proofFile.value) { toast.add({ title: 'Upload proof of refund first', color: 'warning' }); return }
  busyId.value = r.id
  try {
    const up = await upload(proofFile.value, 'payout-proof')
    await authedFetch('/api/refunds/mark-paid', { method: 'POST', body: { refundId: r.id, reference: reference.value.trim(), proofUrl: up.publicId } })
    toast.add({ title: 'Refund recorded as paid', color: 'success' })
    openId.value = null
    await load()
  } catch (e) {
    toast.add({ title: 'Could not save', description: (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? (e as { message?: string })?.message, color: 'error' })
  } finally { busyId.value = null }
}

async function viewProof(r: RefundRow) {
  proofBusy.value = r.id
  try {
    const { url } = await authedFetch<{ url: string }>('/api/refunds/proof-url', { method: 'POST', body: { refundId: r.id } })
    showImage(url, `Refund proof — ${r.projects?.title ?? 'project'}`)
  } catch (e) {
    toast.add({ title: 'Could not open proof', description: (e as { data?: { statusMessage?: string } })?.data?.statusMessage, color: 'error' })
  } finally { proofBusy.value = null }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">Refunds</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Cancelled or expired projects owed back to the requester (95%). Refund by bank, upload proof, then mark paid.
      </p>
    </div>

    <div class="flex gap-1.5">
      <button
        v-for="t in (['pending', 'paid'] as const)"
        :key="t"
        class="zc-tap rounded-full border px-3.5 py-1 text-sm transition"
        :class="tab === t ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-stone-200 text-stone-500 hover:border-stone-300 dark:border-stone-800 dark:text-stone-400'"
        @click="tab = t"
      >
        {{ t === 'pending' ? 'To refund' : 'Refunded' }}
      </button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="zc-card h-24 animate-pulse" />
    </div>

    <div v-else-if="!rows.length" class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-16 text-center dark:border-stone-800">
      <UIcon name="i-lucide-check-circle" class="size-8 text-stone-300 dark:text-stone-600" />
      <p class="text-sm text-stone-500 dark:text-stone-400">{{ tab === 'pending' ? 'No refunds pending.' : 'No refunds recorded yet.' }}</p>
    </div>

    <div v-else class="space-y-3">
      <article v-for="r in rows" :key="r.id" class="zc-card p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="truncate font-serif text-lg leading-tight">{{ r.projects?.title ?? 'Project' }}</h2>
          <span class="shrink-0 text-lg font-semibold tabular-nums text-primary">RM {{ r.amount_myr }}</span>
        </div>

        <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><dt class="text-xs text-stone-400">Refund to</dt><dd class="font-medium">{{ r.profiles?.full_name ?? '—' }}</dd></div>
          <div><dt class="text-xs text-stone-400">Contact</dt><dd class="truncate">{{ r.profiles?.email ?? r.profiles?.phone ?? '—' }}</dd></div>
          <div v-if="r.reason" class="col-span-2"><dt class="text-xs text-stone-400">Reason</dt><dd class="text-stone-600 dark:text-stone-300">{{ r.reason }}</dd></div>
        </dl>

        <!-- Pending: record the refund -->
        <div v-if="tab === 'pending'" class="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <UButton v-if="openId !== r.id" color="primary" size="sm" label="Record refund" @click="openPay(r)" />
          <div v-else class="space-y-3">
            <UFormField label="Proof of refund (required)" hint="Screenshot or PDF of the transfer">
              <input type="file" accept="image/*,application/pdf" class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800" @change="onProof" >
            </UFormField>
            <UFormField label="Reference (optional)">
              <UInput v-model="reference" placeholder="Bank/TNG transaction reference" class="w-full" />
            </UFormField>
            <div class="flex gap-2">
              <UButton color="primary" :loading="busyId === r.id" :disabled="!proofFile" label="Mark as refunded" @click="markPaid(r)" />
              <UButton color="neutral" variant="ghost" label="Cancel" @click="openId = null" />
            </div>
          </div>
        </div>

        <!-- Paid: the record -->
        <div v-else class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-sm dark:border-stone-800">
          <div class="space-y-0.5">
            <div class="flex items-center gap-1.5 text-success"><UIcon name="i-lucide-check-circle" class="size-4" /> Refunded {{ fmtDate(r.paid_at) }}</div>
            <div v-if="r.manual_reference" class="text-xs text-stone-500">Ref: <span class="font-mono">{{ r.manual_reference }}</span></div>
          </div>
          <UButton v-if="r.proof_url" size="sm" color="neutral" variant="soft" icon="i-lucide-receipt" :loading="proofBusy === r.id" label="View proof" @click="viewProof(r)" />
        </div>
      </article>
    </div>
  </div>
</template>
