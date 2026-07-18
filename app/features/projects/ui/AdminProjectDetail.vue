<script setup lang="ts">
// The whole picture of one project, for the broker. Read-only by design:
// every action (fund, award, clear, cancel) has its own deliberate route, and
// none of them belong one click away from a browsing screen.

import { useProjects } from '~/features/projects/application/useProjects'
import { heldBalance, ledgerLabel, formatRemaining } from '~/features/projects/domain'
import type { AdminProjectDetail } from '~/features/projects/domain'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ close: [] }>()

const { projectDetail } = useProjects()
const toast = useToast()

const detail = ref<AdminProjectDetail | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    detail.value = await projectDetail(props.projectId)
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load the project', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
watch(() => props.projectId, load, { immediate: true })

const balance = computed(() => (detail.value ? heldBalance(detail.value.ledger) : 0))

const timeline = computed(() => {
  const d = detail.value
  if (!d) return []
  return [
    { label: 'Created', at: d.created_at },
    { label: 'Went live', at: d.went_live_at },
    { label: 'Work started', at: d.started_at },
    { label: 'Finished', at: d.finished_at },
    { label: 'Closed', at: d.closed_at },
    { label: 'Cancelled', at: d.cancelled_at },
  ].filter((s) => !!s.at) as { label: string; at: string }[]
})

const fmt = (iso: string) => new Date(iso).toLocaleString()
const money = (n: number | string | null) => (n === null ? '—' : `$${Number(n).toFixed(2)}`)
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end bg-black/60" @click.self="emit('close')">
      <div class="flex h-full w-full max-w-2xl flex-col bg-white dark:bg-stone-900">
        <div class="flex items-center justify-between border-b border-stone-200 px-5 py-3 dark:border-stone-800">
          <h2 class="font-medium">Project detail</h2>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Close" @click="emit('close')" />
        </div>

        <div v-if="loading" class="space-y-4 p-5">
          <div v-for="i in 4" :key="i" class="h-20 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
        </div>

        <div v-else-if="!detail" class="p-8 text-center text-sm text-stone-500">Project not found.</div>

        <div v-else class="flex-1 space-y-6 overflow-y-auto p-5">
          <!-- Brief -->
          <section>
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-serif text-xl leading-tight">{{ detail.title }}</h3>
              <UBadge color="neutral" variant="soft" size="sm" class="shrink-0 capitalize">
                {{ detail.status.replace(/_/g, ' ') }}
              </UBadge>
            </div>
            <p v-if="detail.description" class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              {{ detail.description }}
            </p>

            <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt class="text-[11px] uppercase tracking-wide text-stone-400">Budget</dt>
                <dd class="tabular-nums">{{ money(detail.budget_usd) }}</dd>
              </div>
              <div>
                <dt class="text-[11px] uppercase tracking-wide text-stone-400">Funded</dt>
                <dd class="tabular-nums">{{ money(detail.funded_amount_usd) }}</dd>
              </div>
              <div v-if="formatRemaining(detail)">
                <dt class="text-[11px] uppercase tracking-wide text-stone-400">Applications close</dt>
                <dd>{{ formatRemaining(detail) }}</dd>
              </div>
              <div v-if="detail.timeline_minutes">
                <dt class="text-[11px] uppercase tracking-wide text-stone-400">Timeline</dt>
                <dd>{{ Math.floor(detail.timeline_minutes / 60) }}h {{ detail.timeline_minutes % 60 }}m</dd>
              </div>
            </dl>

            <div v-if="detail.requirements?.length" class="mt-4">
              <p class="text-[11px] uppercase tracking-wide text-stone-400">Requirements</p>
              <ul class="mt-1 space-y-1 text-sm">
                <li v-for="(r, i) in detail.requirements" :key="i" class="flex gap-2">
                  <span class="text-stone-400">{{ i + 1 }}.</span><span>{{ r }}</span>
                </li>
              </ul>
            </div>

            <div v-if="detail.attachments.length" class="mt-4">
              <p class="text-[11px] uppercase tracking-wide text-stone-400">Attachments</p>
              <p class="mt-1 text-sm text-stone-500">
                {{ detail.attachments.length }} file(s) — private, viewable from the KYC-style signed link only.
              </p>
            </div>
          </section>

          <!-- Parties -->
          <section class="border-t border-stone-100 pt-5 dark:border-stone-800">
            <p class="zc-eyebrow mb-2">Parties</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                <p class="text-[11px] uppercase tracking-wide text-stone-400">Requester</p>
                <NuxtLink
                  v-if="detail.requester?.member_id"
                  :to="`/u/${detail.requester.member_id}`"
                  class="zc-tap mt-0.5 block font-mono text-sm font-medium hover:text-primary"
                >
                  {{ detail.requester.member_id }}
                </NuxtLink>
                <p class="text-sm text-stone-500 dark:text-stone-400">{{ detail.requester?.full_name ?? '—' }}</p>
              </div>

              <div class="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                <p class="text-[11px] uppercase tracking-wide text-stone-400">Awarded provider</p>
                <template v-if="detail.provider">
                  <NuxtLink
                    v-if="detail.provider.member_id"
                    :to="`/u/${detail.provider.member_id}`"
                    class="zc-tap mt-0.5 block font-mono text-sm font-medium hover:text-primary"
                  >
                    {{ detail.provider.member_id }}
                  </NuxtLink>
                  <p class="text-sm text-stone-500 dark:text-stone-400">{{ detail.provider.full_name }}</p>
                </template>
                <p v-else class="mt-0.5 text-sm text-stone-400">Not awarded yet</p>
              </div>
            </div>
          </section>

          <!-- Applicants -->
          <section class="border-t border-stone-100 pt-5 dark:border-stone-800">
            <p class="zc-eyebrow mb-2">Applicants ({{ detail.applicants.length }})</p>
            <p v-if="!detail.applicants.length" class="text-sm text-stone-500 dark:text-stone-400">No applications.</p>
            <div v-else class="space-y-1.5">
              <div
                v-for="a in detail.applicants"
                :key="a.application_id"
                class="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-2.5 dark:border-stone-800"
              >
                <div class="min-w-0">
                  <NuxtLink
                    :to="a.member_id ? `/u/${a.member_id}` : ''"
                    class="block truncate font-mono text-sm hover:text-primary"
                  >
                    {{ a.member_id ?? '—' }}
                  </NuxtLink>
                  <p v-if="a.cover_note" class="truncate text-xs text-stone-400">{{ a.cover_note }}</p>
                </div>
                <UBadge
                  :color="a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'neutral' : 'primary'"
                  variant="soft"
                  size="sm"
                  class="shrink-0 capitalize"
                >
                  {{ a.status }}
                </UBadge>
              </div>
            </div>
          </section>

          <!-- Money -->
          <section class="border-t border-stone-100 pt-5 dark:border-stone-800">
            <p class="zc-eyebrow mb-2">Escrow</p>

            <div class="mb-3 flex items-center justify-between rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
              <span class="text-sm text-stone-500 dark:text-stone-400">Currently held</span>
              <span class="text-lg font-semibold tabular-nums">{{ money(balance) }}</span>
            </div>

            <p v-if="!detail.ledger.length" class="text-sm text-stone-500 dark:text-stone-400">
              Nothing recorded — the project hasn't been funded.
            </p>
            <div v-else class="space-y-1.5">
              <div
                v-for="e in detail.ledger"
                :key="e.id"
                class="flex items-center justify-between gap-2 text-sm"
              >
                <span class="text-stone-600 dark:text-stone-300">{{ ledgerLabel(e.entry_type) }}</span>
                <span class="tabular-nums" :class="Number(e.amount_usd) > 0 ? 'text-success' : 'text-stone-500'">
                  {{ money(e.amount_usd) }}
                </span>
              </div>
            </div>

            <div v-if="detail.payments.length" class="mt-4">
              <p class="text-[11px] uppercase tracking-wide text-stone-400">Payment claims</p>
              <div v-for="(p, i) in detail.payments" :key="i" class="mt-1 flex items-center justify-between text-sm">
                <span class="font-mono text-xs">{{ p.reference }}</span>
                <span class="flex items-center gap-2">
                  <span class="tabular-nums">{{ money(p.amount_usd) }}</span>
                  <UBadge :color="p.status === 'verified' ? 'success' : 'neutral'" variant="soft" size="sm">
                    {{ p.status }}
                  </UBadge>
                </span>
              </div>
            </div>
          </section>

          <!-- Work -->
          <section v-if="detail.deliverables.length || detail.reviews.length" class="border-t border-stone-100 pt-5 dark:border-stone-800">
            <p class="zc-eyebrow mb-2">Work</p>
            <div v-for="d in detail.deliverables" :key="d.id" class="mb-2 rounded-lg border border-stone-200 p-2.5 text-sm dark:border-stone-800">
              <div class="flex items-center justify-between">
                <span class="font-medium">Version {{ d.version }}</span>
                <span class="text-xs text-stone-400">{{ fmt(d.submitted_at) }}</span>
              </div>
              <p v-if="d.note" class="mt-0.5 text-stone-500 dark:text-stone-400">{{ d.note }}</p>
            </div>
            <div v-for="r in detail.reviews" :key="r.id" class="mb-2 flex items-center justify-between text-sm">
              <span class="capitalize text-stone-600 dark:text-stone-300">{{ r.decision.replace(/_/g, ' ') }}</span>
              <span class="text-xs text-stone-400">{{ fmt(r.created_at) }}</span>
            </div>
          </section>

          <!-- Timeline -->
          <section class="border-t border-stone-100 pb-4 pt-5 dark:border-stone-800">
            <p class="zc-eyebrow mb-2">Timeline</p>
            <div v-for="s in timeline" :key="s.label" class="flex items-center justify-between py-1 text-sm">
              <span class="text-stone-600 dark:text-stone-300">{{ s.label }}</span>
              <span class="text-xs text-stone-400">{{ fmt(s.at) }}</span>
            </div>
            <p v-if="detail.cancel_reason" class="mt-2 text-sm text-stone-500">
              Reason: {{ detail.cancel_reason }}
            </p>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
