<script setup lang="ts">
import { useProjects } from '~/features/projects/application/useProjects'
import {
  fundingStateOf,
  canResumePayment,
  latestClaim,
  formatRemaining,
  canAward,
  hasApplicantList,
  showsCountdown,
  isStalled,
} from '~/features/projects/domain'
import type { ProjectWithPayments } from '~/features/projects/domain'
import ProjectPaymentPanel from './ProjectPaymentPanel.vue'
import ApplicantList from './ApplicantList.vue'

const { myProjectsWithPayments } = useProjects()
const toast = useToast()

const projects = ref<ProjectWithPayments[]>([])
const loading = ref(true)

async function load() {
  try {
    projects.value = await myProjectsWithPayments()
  } catch (e) {
    // Previously this failed silently and left stale data on screen.
    const err = e as { message?: string }
    toast.add({ title: 'Could not load your projects', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Resuming an abandoned payment
const resuming = ref<ProjectWithPayments | null>(null)
const resumeIsRetry = computed(() => !!resuming.value && fundingStateOf(resuming.value) === 'rejected')

function onResumePaid(reference: string) {
  toast.add({
    title: 'Payment submitted',
    description: `Reference ${reference}. The admin will verify it shortly.`,
    color: 'success',
  })
  resuming.value = null
  load()
}

// Which project's applicant shortlist is expanded (wireframe shows them inline).
const expanded = ref<string | null>(null)

function toggleApplicants(id: string) {
  expanded.value = expanded.value === id ? null : id
}

function onAwarded() {
  expanded.value = null
  load()
}

// A live countdown, so "52 hours 32 minutes" actually ticks.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => clearInterval(timer))

const search = ref('')

// Unfinished payments float to the top — that's the thing needing action.
const sorted = computed(() => {
  const q = search.value.trim().toLowerCase()
  return [...projects.value]
    .filter((p) => !q || p.title.toLowerCase().includes(q))
    .sort((a, b) => Number(canResumePayment(b)) - Number(canResumePayment(a)))
})

const statusColor = (s: string) =>
  (({
    live: 'primary',
    awarded: 'primary',
    in_progress: 'primary',
    submitted_work: 'primary',
    in_review: 'primary',
    revision_requested: 'warning',
    finished: 'success',
    closed: 'success',
    cancelled: 'error',
  }) as Record<string, string>)[s] ?? 'neutral'

function statusLabel(p: ProjectWithPayments) {
  const f = fundingStateOf(p)
  if (f === 'awaiting_payment') return 'Payment due'
  if (f === 'awaiting_verification') return 'Verifying payment'
  if (f === 'rejected') return 'Payment rejected'
  return p.status.replace(/_/g, ' ')
}

function labelColor(p: ProjectWithPayments) {
  const f = fundingStateOf(p)
  if (f === 'awaiting_payment') return 'warning'
  if (f === 'rejected') return 'error'
  if (f === 'awaiting_verification') return 'neutral'
  return statusColor(p.status)
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">My projects</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Projects you've posted.</p>
    </div>

    <UInput
      v-if="projects.length"
      v-model="search"
      icon="i-lucide-search"
      placeholder="Search your projects"
      class="w-full"
    />

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="zc-card h-20 animate-pulse" />
    </div>

    <div
      v-else-if="!projects.length"
      class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-16 text-center dark:border-stone-800"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
        <UIcon name="i-lucide-folder-plus" class="size-6 text-primary" />
      </div>
      <p class="font-medium">No projects yet</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">Tap the Z to post your first one.</p>
    </div>

    <!-- Search with no matches — previously this rendered an empty grid -->
    <p v-else-if="!sorted.length" class="py-14 text-center text-sm text-stone-500 dark:text-stone-400">
      No projects match “{{ search }}”.
    </p>

    <div v-else class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="p in sorted"
        :key="p.id"
        class="zc-card p-4"
        :class="canResumePayment(p) ? 'border-primary/40 ring-1 ring-primary/20' : ''"
      >
        <div class="flex items-center justify-between gap-2">
          <h2 class="truncate font-serif text-lg leading-tight">{{ p.title }}</h2>
          <UBadge :color="(labelColor(p) as any)" variant="soft" size="sm" class="shrink-0 capitalize">
            {{ statusLabel(p) }}
          </UBadge>
        </div>

        <div class="mt-2 flex items-center justify-between gap-2">
          <span class="text-sm tabular-nums text-stone-500 dark:text-stone-400">${{ p.budget_usd }}</span>
          <!-- Only while applications are actually open; a closed project
               showing "Ended" forever is just noise. -->
          <span
            v-if="showsCountdown(p)"
            class="shrink-0 text-xs tabular-nums"
            :class="isStalled(p, now) ? 'text-stone-400' : 'text-primary'"
          >
            {{ formatRemaining(p, now) }}
          </span>
        </div>

        <!-- Applications closed with nobody chosen -->
        <div
          v-if="isStalled(p, now)"
          class="mt-3 flex items-start gap-1.5 rounded-lg bg-primary/5 p-2.5 text-xs text-stone-600 dark:text-stone-300"
        >
          <UIcon name="i-lucide-alarm-clock" class="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>Applications have closed and nobody's been awarded yet. Pick an applicant below, or contact the admin.</span>
        </div>

        <!-- Applicants, as in the wireframe: member ID + Approve / Reject.
             Stays visible after awarding so you can see who you picked. -->
        <div v-if="hasApplicantList(p)" class="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <button
            class="zc-tap flex w-full items-center justify-between text-sm font-medium"
            @click="toggleApplicants(p.id)"
          >
            <span class="flex items-center gap-1.5">
              <UIcon name="i-lucide-users" class="size-4 text-primary" />
              {{ canAward(p) ? 'Applicants' : 'Awarded provider' }}
            </span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 text-stone-400 transition"
              :class="expanded === p.id ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="expanded === p.id" class="mt-3">
            <ApplicantList :project="p" @awarded="onAwarded" />
          </div>
        </div>

        <!-- Unfinished payment: the way back in -->
        <div v-if="canResumePayment(p)" class="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <p class="mb-2 text-xs text-stone-500 dark:text-stone-400">
            <template v-if="fundingStateOf(p) === 'rejected'">Your payment wasn't verified. Submit it again to go live.</template>
            <template v-else>This project isn't funded yet, so nobody can see it.</template>
          </p>
          <UButton
            color="primary"
            size="sm"
            block
            icon="i-lucide-credit-card"
            class="zc-tap"
            :label="fundingStateOf(p) === 'rejected' ? 'Retry payment' : 'Complete payment'"
            @click="resuming = p"
          />
        </div>

        <div
          v-else-if="fundingStateOf(p) === 'awaiting_verification'"
          class="mt-3 flex items-center gap-1.5 border-t border-stone-100 pt-3 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400"
        >
          <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" />
          <span>Payment <span class="font-mono">{{ latestClaim(p)?.reference }}</span> is awaiting admin verification.</span>
        </div>
      </article>
    </div>

    <!-- Resume payment -->
    <Teleport to="body">
      <div
        v-if="resuming"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
        @click.self="resuming = null"
      >
        <div class="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-5 dark:bg-stone-900 sm:rounded-2xl">
          <ProjectPaymentPanel
            :project="resuming"
            resumed
            :retry="resumeIsRetry"
            @paid="onResumePaid"
            @cancel="resuming = null"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
