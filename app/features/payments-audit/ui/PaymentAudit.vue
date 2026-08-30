<script setup lang="ts">
// Master reconciliation: compares each project's budget, its payments, and the
// escrow ledger, and flags anything that doesn't line up (paid-but-not-funded,
// double/overpayment, amount mismatches, etc.). Read-only — no money moves here.
// A per-bill "Re-check with ToyyibPay" button confirms the live gateway status.

import { authedFetch } from '~/shared/lib/authedFetch'

type Gateway = { paid: boolean; label: string } | null
type Payment = { status: string; amount_myr: number; billcode: string | null; reference: string | null; created_at: string; gateway?: Gateway }
type Row = {
  id: string; title: string; status: string; requester_id: string
  budget_myr: number; funded_in_escrow: number; verified_paid: number; confirmed_paid: number
  verified_count: number; confirmed_count: number; surplus: number
  flags: string[]; severity: 'error' | 'warn' | 'ok'; payments: Payment[]
}
type Report = { summary: Record<string, number>; rows: Row[] }

const FLAG_LABEL: Record<string, string> = {
  paid_not_funded: 'Paid but not funded',
  overpaid: 'Over / double payment',
  amount_mismatch: 'Amount mismatch',
  funded_no_payment: 'Funded with no payment',
  unconfirmed_payment: 'Unconfirmed payment',
  stranded_claimed: 'Stranded extra payment',
}

const report = ref<Report | null>(null)
const loading = ref(true)
const deep = ref(false)
const showAll = ref(false)
const expanded = ref<string | null>(null)
const billStatus = ref<Record<string, { label: string; paid: boolean; amountMYR: number | null }>>({})
const checking = ref<string | null>(null)
const toast = useToast()

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (showAll.value) params.set('all', '1')
    if (deep.value) params.set('verify', '1')
    const qs = params.toString()
    report.value = await authedFetch<Report>(`/api/master/payment-audit${qs ? `?${qs}` : ''}`)
  } catch (e) {
    toast.add({ title: 'Could not load the audit', description: (e as { message?: string })?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
async function deepCheck() {
  deep.value = true
  await load()
}
watch(showAll, load)
onMounted(load)

// Gateway status to show on a payment: a manual re-check wins, else the deep-mode result.
function gatewayFor(p: Payment): { label: string; paid: boolean } | null {
  if (p.billcode && billStatus.value[p.billcode]) return billStatus.value[p.billcode]
  return p.gateway ?? null
}

async function recheck(billCode: string) {
  checking.value = billCode
  try {
    const st = await authedFetch<{ label: string; paid: boolean; amountMYR: number | null }>(
      '/api/master/recheck-bill', { method: 'POST', body: { billCode } },
    )
    billStatus.value = { ...billStatus.value, [billCode]: st }
  } catch (e) {
    toast.add({ title: 'Re-check failed', description: (e as { data?: { statusMessage?: string } })?.data?.statusMessage, color: 'error' })
  } finally {
    checking.value = null
  }
}

const money = (n: number) => `RM ${Number(n).toFixed(2)}`
const sevColor = (s: string) => (s === 'error' ? 'error' : s === 'warn' ? 'warning' : 'neutral')
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Payment reconciliation</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Every project's budget vs. its payments vs. escrow. Anything out of line is flagged.
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UButton icon="i-lucide-search-check" color="primary" variant="soft" size="sm" :loading="loading && deep" label="Deep re-check" @click="deepCheck" />
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="soft" size="sm" :loading="loading && !deep" label="Refresh" @click="load" />
      </div>
    </div>

    <!-- Summary -->
    <div v-if="report" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div class="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Projects</p>
        <p class="text-xl font-semibold tabular-nums">{{ report.summary.projects }}</p>
      </div>
      <div class="rounded-xl border p-3" :class="report.summary.issues ? 'border-error/40 bg-error/5' : 'border-stone-200 dark:border-stone-800'">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Flagged</p>
        <p class="text-xl font-semibold tabular-nums" :class="report.summary.issues ? 'text-error' : ''">{{ report.summary.issues }}</p>
      </div>
      <div class="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Paid, not funded</p>
        <p class="text-xl font-semibold tabular-nums">{{ report.summary.paid_not_funded + report.summary.unconfirmed_payment }}</p>
      </div>
      <div class="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Over / double paid</p>
        <p class="text-xl font-semibold tabular-nums">{{ report.summary.overpaid }}</p>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <label class="flex items-center gap-2 text-sm text-stone-500">
        <UCheckbox v-model="showAll" /> Show all projects (not just flagged)
      </label>
      <p v-if="deep" class="text-xs text-stone-400">
        <UIcon name="i-lucide-badge-check" class="mr-1 inline size-3.5 text-primary" />Deep mode: claimed bills verified live with ToyyibPay.
      </p>
      <p v-else class="text-xs text-stone-400">
        Counts use recorded data. Click <span class="font-medium">Deep re-check</span> to confirm "claimed" bills against ToyyibPay and catch hidden double-payments.
      </p>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="zc-card h-20 animate-pulse" />
    </div>

    <div v-else-if="report && !report.rows.length" class="flex flex-col items-center gap-2 py-16 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-check-check" class="size-6 text-success" />
      </div>
      <p class="font-medium">Everything reconciles</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">No mismatches between payments, projects and escrow.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="r in report!.rows"
        :key="r.id"
        class="rounded-xl border p-4"
        :class="r.severity === 'error' ? 'border-error/40' : r.severity === 'warn' ? 'border-warning/40' : 'border-stone-200 dark:border-stone-800'"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <h3 class="truncate font-medium">{{ r.title }}</h3>
              <UBadge color="neutral" variant="soft" size="sm" class="capitalize">{{ r.status.replace(/_/g, ' ') }}</UBadge>
            </div>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <UBadge v-for="f in r.flags" :key="f" :color="sevColor(r.severity) as any" variant="soft" size="sm">
                {{ FLAG_LABEL[f] ?? f }}
              </UBadge>
              <UBadge v-if="!r.flags.length" color="success" variant="soft" size="sm">In line</UBadge>
            </div>
          </div>
          <UButton
            :icon="expanded === r.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            color="neutral" variant="ghost" size="xs" aria-label="Details" @click="expanded = expanded === r.id ? null : r.id"
          />
        </div>

        <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <p class="text-[11px] uppercase tracking-wide text-stone-400">Budget</p>
            <p class="tabular-nums">{{ money(r.budget_myr) }}</p>
          </div>
          <div>
            <p class="text-[11px] uppercase tracking-wide text-stone-400">{{ deep ? 'Confirmed paid' : 'Verified paid' }}</p>
            <p class="tabular-nums" :class="(deep ? r.confirmed_paid : r.verified_paid) > r.budget_myr ? 'text-error font-medium' : ''">
              {{ money(deep ? r.confirmed_paid : r.verified_paid) }}<span v-if="(deep ? r.confirmed_count : r.verified_count) > 1" class="text-stone-400"> ({{ deep ? r.confirmed_count : r.verified_count }}×)</span>
            </p>
          </div>
          <div>
            <p class="text-[11px] uppercase tracking-wide text-stone-400">Held in escrow</p>
            <p class="tabular-nums">{{ money(r.funded_in_escrow) }}</p>
          </div>
        </div>
        <p v-if="r.surplus > 0" class="mt-2 rounded-lg bg-error/5 px-2.5 py-1.5 text-sm text-error">
          Surplus of {{ money(r.surplus) }} — the requester appears to have paid more than the budget. Consider a refund.
        </p>

        <!-- Drill-down: payments + live re-check -->
        <div v-if="expanded === r.id" class="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <p class="mb-2 text-[11px] uppercase tracking-wide text-stone-400">Payments ({{ r.payments.length }})</p>
          <div v-if="!r.payments.length" class="text-sm text-stone-400">No payment records.</div>
          <div v-for="(p, i) in r.payments" :key="i" class="mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-2.5 py-2 text-sm dark:bg-stone-800/40">
            <div class="flex items-center gap-2">
              <UBadge :color="p.status === 'verified' ? 'success' : 'neutral'" variant="soft" size="sm">{{ p.status }}</UBadge>
              <span class="tabular-nums">{{ money(p.amount_myr) }}</span>
              <span v-if="p.billcode" class="font-mono text-xs text-stone-400">{{ p.billcode }}</span>
            </div>
            <div v-if="p.billcode" class="flex items-center gap-2">
              <UBadge v-if="gatewayFor(p)" :color="(gatewayFor(p)!.paid ? 'success' : gatewayFor(p)!.label === 'Failed' ? 'error' : 'warning') as any" variant="soft" size="sm">
                Gateway: {{ gatewayFor(p)!.label }}
              </UBadge>
              <UButton
                size="xs" color="neutral" variant="soft" icon="i-lucide-search-check"
                :loading="checking === p.billcode" label="Re-check" @click="recheck(p.billcode!)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
