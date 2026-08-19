<script setup lang="ts">
// Staff arbitration console. Admin rules on contested cancellations; master
// rules on appeals. Each case exposes both private party channels so the
// reviewer can request info, plus the approve/deny controls for their stage.
import { useCancellations, userStatusLabel } from '../application/useCancellations'
import type { CancellationRequest } from '../application/useCancellations'
import { useMe } from '~/features/auth/application/useMe'
import DisputeChat from './DisputeChat.vue'

const { queue, adminDecide, masterDecide } = useCancellations()
const { me, load: loadMe } = useMe()
const toast = useToast()

const cases = ref<CancellationRequest[]>([])
const loading = ref(true)
const selected = ref<CancellationRequest | null>(null)
const decisionReason = ref('')
const busy = ref(false)

async function load() {
  loading.value = true
  try { cases.value = await queue() } finally { loading.value = false }
}
onMounted(async () => { await loadMe(); await load() })

const isMaster = computed(() => me.value?.role === 'master')

// Which controls this reviewer sees for the selected case.
const canArbitrate = (r: CancellationRequest) => r.status === 'in_arbitration'
const canRuleAppeal = (r: CancellationRequest) => r.status === 'appealed' && isMaster.value

function pick(r: CancellationRequest) {
  selected.value = r
  decisionReason.value = ''
}

async function decide(r: CancellationRequest, decision: 'approved' | 'denied') {
  if (!decisionReason.value.trim()) { toast.add({ title: 'Add a short reason for the record', color: 'warning' }); return }
  busy.value = true
  try {
    if (canRuleAppeal(r)) await masterDecide(r.id, decision, decisionReason.value.trim())
    else await adminDecide(r.id, decision, decisionReason.value.trim())
    toast.add({ title: `Marked ${decision}`, color: 'success' })
    selected.value = null
    await load()
  } catch (e) {
    toast.add({ title: 'Could not save decision', description: (e as { message?: string })?.message, color: 'error' })
  } finally { busy.value = false }
}

const stageHint = (r: CancellationRequest) => {
  if (r.status === 'in_arbitration') return 'Provider declined — decide whether >50% of the work is done (deny) or not (approve).'
  if (r.status === 'awaiting_appeal') return `Decided "${r.admin_decision}". Finalizes automatically after the 48h appeal window unless a party appeals.`
  if (r.status === 'appealed') return isMaster.value ? 'Appealed — your ruling is final.' : 'Appealed — awaiting the final ruling.'
  if (r.status === 'pending_provider') return 'Waiting on the provider to accept or decline.'
  return ''
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">Cancellations</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Contested project cancellations awaiting a decision.
      </p>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="zc-card h-20 animate-pulse" />
    </div>

    <div
      v-else-if="!cases.length"
      class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-16 text-center dark:border-stone-800"
    >
      <UIcon name="i-lucide-check-circle" class="size-8 text-stone-300 dark:text-stone-600" />
      <p class="text-sm text-stone-500 dark:text-stone-400">No cancellations to review.</p>
    </div>

    <div v-else class="space-y-3">
      <article v-for="r in cases" :key="r.id" class="zc-card p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <h2 class="truncate font-serif text-lg leading-tight">{{ r.projects?.title ?? 'Project' }}</h2>
            <p class="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{{ stageHint(r) }}</p>
          </div>
          <UBadge :color="(userStatusLabel(r).color as any)" variant="soft" size="sm" class="shrink-0">
            {{ r.status.replace(/_/g, ' ') }}
          </UBadge>
        </div>

        <p class="mt-2 rounded-lg bg-stone-50 p-2.5 text-sm dark:bg-stone-800/40">
          <span class="font-medium">Requester's reason:</span> {{ r.reason }}
        </p>
        <p v-if="r.appeal_reason" class="mt-2 rounded-lg bg-primary/5 p-2.5 text-sm">
          <span class="font-medium">Appeal:</span> {{ r.appeal_reason }}
        </p>

        <div class="mt-3 flex flex-wrap gap-2">
          <UButton
            v-if="selected?.id !== r.id"
            color="neutral" variant="soft" size="sm" icon="i-lucide-messages-square"
            label="Open case" @click="pick(r)"
          />
          <UButton
            :to="`/admin/projects?focus=${r.project_id}`"
            color="neutral" variant="ghost" size="sm" icon="i-lucide-external-link" label="View project"
          />
        </div>

        <!-- Expanded case: both private channels + decision -->
        <div v-if="selected?.id === r.id" class="mt-4 space-y-4 border-t border-stone-100 pt-4 dark:border-stone-800">
          <div class="grid gap-3 md:grid-cols-2">
            <div>
              <p class="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Channel with Requester</p>
              <DisputeChat :request-id="r.id" mode="staff" party="requester" />
            </div>
            <div>
              <p class="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Channel with Provider</p>
              <DisputeChat :request-id="r.id" mode="staff" party="provider" />
            </div>
          </div>

          <div v-if="canArbitrate(r) || canRuleAppeal(r)" class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
            <UFormField label="Decision reason (kept on record)">
              <UTextarea v-model="decisionReason" :rows="2" placeholder="e.g. Work is ~30% complete; cancellation eligible." class="w-full" />
            </UFormField>
            <div class="mt-3 flex gap-2">
              <UButton color="primary" class="flex-1" label="Approve cancellation" :loading="busy" @click="decide(r, 'approved')" />
              <UButton color="error" variant="soft" class="flex-1" label="Deny (continue project)" :loading="busy" @click="decide(r, 'denied')" />
            </div>
            <p class="mt-2 text-[11px] text-stone-400">
              {{ canRuleAppeal(r) ? 'Your ruling is final and refunds immediately if approved.' : 'Approval opens a 48h appeal window before the refund runs.' }}
            </p>
          </div>
          <p v-else class="text-xs text-stone-500 dark:text-stone-400">{{ stageHint(r) }}</p>

          <UButton color="neutral" variant="ghost" size="sm" label="Close case" @click="selected = null" />
        </div>
      </article>
    </div>
  </div>
</template>
