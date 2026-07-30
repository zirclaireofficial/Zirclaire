<script setup lang="ts">
// The Master console. Deliberately its own, denser layout — this is the
// oversight cockpit, not a member screen. Every figure carries an (i) so
// nothing is ambiguous. All data comes from master-only server endpoints.

import { useMaster } from '~/features/master/application/useMaster'
import type { MasterStats, AuditEntry } from '~/features/master/application/useMaster'

const { stats, audit, createAdmin } = useMaster()
const toast = useToast()

const data = ref<MasterStats | null>(null)
const entries = ref<AuditEntry[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const [s, a] = await Promise.all([stats(), audit(120)])
    data.value = s
    entries.value = a.entries
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not load the console', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const money = (n: number | undefined) => (n === undefined ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const num = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString())

// Create-admin form
const showCreate = ref(false)
const form = reactive({ fullName: '', email: '', password: '' })
const creating = ref(false)

async function submitAdmin() {
  if (!form.fullName || !form.email || form.password.length < 8) {
    toast.add({ title: 'Fill in all fields (password 8+ chars)', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const res = await createAdmin(form.email, form.password, form.fullName)
    toast.add({ title: 'Admin created', description: `${res.profile.full_name} · ${res.profile.member_id}`, color: 'success' })
    form.fullName = ''; form.email = ''; form.password = ''
    showCreate.value = false
    load()
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not create admin', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    creating.value = false
  }
}

function actionColor(action: string) {
  if (action.includes('reject') || action.includes('remove') || action.includes('suspend') || action.includes('unpublish')) return 'error'
  if (action.includes('restore') || action.includes('unsuspend') || action.includes('reopen')) return 'warning'
  if (action.includes('approve') || action.includes('create') || action.includes('fund')) return 'success'
  return 'neutral'
}
function fullTime(iso: string) { return new Date(iso).toLocaleString() }

const projectStatuses = computed(() => Object.entries(data.value?.projects.byStatus ?? {}).sort((a, b) => b[1] - a[1]))
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-2.5">
      <div class="flex size-10 items-center justify-center rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
        <UIcon name="i-lucide-shield" class="size-5" />
      </div>
      <div>
        <p class="zc-eyebrow">Master</p>
        <h1 class="font-serif text-2xl leading-tight">Oversight console</h1>
      </div>
    </div>

    <!-- FINANCES -->
    <section>
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Finances</h2>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-stone-500 dark:text-stone-400">Platform earnings</span>
            <UTooltip text="Total commission the platform has kept: 20% of every cleared project + 15% of every royalty sale.">
              <UIcon name="i-lucide-info" class="size-3.5 text-stone-400" />
            </UTooltip>
          </div>
          <div class="mt-1 text-2xl font-semibold tabular-nums text-primary">{{ money(data?.platformearnings) }}</div>
        </div>
        <div class="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-stone-500 dark:text-stone-400">Held in escrow</span>
            <UTooltip text="Money currently locked in escrow across all live/in-progress projects — funded but not yet released to anyone.">
              <UIcon name="i-lucide-info" class="size-3.5 text-stone-400" />
            </UTooltip>
          </div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ money(data?.money.held) }}</div>
        </div>
        <div class="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-stone-500 dark:text-stone-400">Paid to providers</span>
            <UTooltip text="Total ever released to providers: the 80% project payouts plus the 85% royalty payouts.">
              <UIcon name="i-lucide-info" class="size-3.5 text-stone-400" />
            </UTooltip>
          </div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ money((data?.money.payout ?? 0) + (data?.royalty.payout ?? 0)) }}</div>
        </div>
        <div class="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-stone-500 dark:text-stone-400">Total funded</span>
            <UTooltip text="Gross value requesters have put into escrow over all time (before any splits or refunds).">
              <UIcon name="i-lucide-info" class="size-3.5 text-stone-400" />
            </UTooltip>
          </div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ money(data?.money.funded) }}</div>
        </div>
      </div>
      <p class="mt-2 text-xs text-stone-400">
        Royalty store: {{ money(data?.royalty.sales) }} in sales · {{ money(data?.royalty.commission) }} commission.
      </p>
    </section>

    <!-- MEMBERS -->
    <section>
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Members</h2>
      <div class="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
          <span class="text-[11px] text-stone-400">Total</span>
          <div class="text-xl font-medium">{{ num(data?.members.total) }}</div>
        </div>
        <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
          <span class="text-[11px] text-stone-400">Providers</span>
          <div class="text-xl font-medium">{{ num(data?.members.providers) }}</div>
        </div>
        <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
          <span class="text-[11px] text-stone-400">Requesters</span>
          <div class="text-xl font-medium">{{ num(data?.members.requesters) }}</div>
        </div>
        <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
          <span class="text-[11px] text-stone-400">Admins</span>
          <div class="text-xl font-medium">{{ num(data?.members.admins) }}</div>
        </div>
        <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
          <span class="flex items-center gap-1 text-[11px] text-stone-400">
            Pending
            <UTooltip text="Accounts awaiting KYC review — they can't post or transact until an admin approves them.">
              <UIcon name="i-lucide-info" class="size-3" />
            </UTooltip>
          </span>
          <div class="text-xl font-medium" :class="(data?.members.pendingKyc ?? 0) > 0 ? 'text-primary' : ''">{{ num(data?.members.pendingKyc) }}</div>
        </div>
        <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
          <span class="flex items-center gap-1 text-[11px] text-stone-400">
            Suspended
            <UTooltip text="Accounts currently blocked from posting/transacting, hidden from others. Reversible.">
              <UIcon name="i-lucide-info" class="size-3" />
            </UTooltip>
          </span>
          <div class="text-xl font-medium" :class="(data?.members.suspended ?? 0) > 0 ? 'text-error' : ''">{{ num(data?.members.suspended) }}</div>
        </div>
      </div>
      <div class="mt-3 flex gap-2">
        <UButton to="/admin/members" color="neutral" variant="soft" size="sm" icon="i-lucide-users" label="Manage members" class="zc-tap" />
        <UButton color="primary" size="sm" icon="i-lucide-user-plus" label="Create admin" class="zc-tap" @click="showCreate = !showCreate" />
      </div>

      <!-- Create admin -->
      <div v-if="showCreate" class="mt-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
        <div class="mb-2 flex items-center gap-1.5">
          <p class="text-sm font-medium">New admin account</p>
          <UTooltip text="Creates a confirmed, approved admin. They can review KYC, fund projects, moderate and handle the service desk — but not suspend other admins or see this console.">
            <UIcon name="i-lucide-info" class="size-3.5 text-stone-400" />
          </UTooltip>
        </div>
        <div class="grid gap-2 sm:grid-cols-3">
          <UInput v-model="form.fullName" placeholder="Full name" class="w-full" />
          <UInput v-model="form.email" type="email" placeholder="Email" class="w-full" />
          <UInput v-model="form.password" type="password" placeholder="Temp password (8+)" class="w-full" />
        </div>
        <div class="mt-2 flex gap-2">
          <UButton color="primary" size="sm" label="Create admin" :loading="creating" @click="submitAdmin" />
          <UButton color="neutral" variant="ghost" size="sm" label="Cancel" @click="showCreate = false" />
        </div>
      </div>
    </section>

    <!-- PROJECTS -->
    <section>
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Projects · {{ num(data?.projects.total) }} total</h2>
      <div v-if="!projectStatuses.length" class="text-sm text-stone-500 dark:text-stone-400">No projects yet.</div>
      <div v-else class="flex flex-wrap gap-2">
        <div v-for="[status, count] in projectStatuses" :key="status" class="rounded-lg border border-stone-200 px-3 py-1.5 text-sm dark:border-stone-800">
          <span class="capitalize text-stone-600 dark:text-stone-300">{{ status.replace(/_/g, ' ') }}</span>
          <span class="ml-2 font-semibold tabular-nums">{{ count }}</span>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton to="/admin/projects" color="neutral" variant="soft" size="sm" icon="i-lucide-folder-kanban" label="All projects" class="zc-tap" />
        <UButton to="/admin/tickets" color="neutral" variant="soft" size="sm" icon="i-lucide-ticket" label="Support tickets" class="zc-tap" />
      </div>
    </section>

    <!-- AUDIT LOG -->
    <section>
      <div class="mb-3 flex items-center gap-1.5">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-stone-400">Audit log</h2>
        <UTooltip text="Every privileged action any admin (or you) takes, newest first. Append-only — entries can't be edited or deleted.">
          <UIcon name="i-lucide-info" class="size-3.5 text-stone-400" />
        </UTooltip>
      </div>

      <div v-if="loading" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
      </div>
      <p v-else-if="!entries.length" class="text-sm text-stone-500 dark:text-stone-400">No actions recorded yet.</p>
      <div v-else class="divide-y divide-stone-100 rounded-xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        <div v-for="e in entries" :key="e.id" class="flex items-start gap-3 p-3">
          <UBadge :color="(actionColor(e.action) as any)" variant="soft" size="sm" class="mt-0.5 shrink-0 font-mono text-[11px]">
            {{ e.action }}
          </UBadge>
          <div class="min-w-0 flex-1">
            <p class="text-sm">{{ e.summary || e.action }}</p>
            <p class="text-xs text-stone-500 dark:text-stone-400">
              {{ e.actor?.full_name ?? 'System' }}
              <span v-if="e.actor?.member_id" class="font-mono">{{ e.actor.member_id }}</span>
              <span class="text-stone-300 dark:text-stone-600"> · </span>
              {{ fullTime(e.created_at) }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
