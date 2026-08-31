<script setup lang="ts">
import { useProjects } from '~/features/projects/application/useProjects'
import { useProjectActions } from '~/features/projects/application/useProjectActions'
import { useMediaViewer } from '~/shared/lib/useMediaViewer'
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
import ProjectChatSheet from '~/features/messaging/ui/ProjectChatSheet.vue'
import CancelProjectButton from '~/features/cancellations/ui/CancelProjectButton.vue'

// Statuses where an SR may still request cancellation (funded through review).
const CANCELLABLE = ['funded', 'live', 'awarded', 'in_progress', 'submitted_work', 'in_review', 'revision_requested']

const { myProjectsWithPayments } = useProjects()
const { requestChanges, acceptWork, deliverableUrl } = useProjectActions()
const { open: openMedia } = useMediaViewer()
const toast = useToast()

const projects = ref<ProjectWithPayments[]>([])
const loading = ref(true)

// SR review state (per project under review).
const UNDER_REVIEW = ['submitted_work', 'in_review']
const reviewBusy = ref<string | null>(null)
const changesFor = ref<string | null>(null) // project id whose "request changes" box is open
const changeNote = ref('')
const chatFor = ref<{ id: string; title: string } | null>(null) // open project chat sheet

async function viewDeliverable(projectId: string) {
  reviewBusy.value = projectId
  try {
    const { url, mediaType } = await deliverableUrl(projectId)
    openMedia(url, { type: mediaType === 'image' ? 'image' : 'file', name: 'deliverable' })
  } catch (e) {
    toast.add({ title: 'Could not open the deliverable', description: errMsg(e), color: 'error' })
  } finally { reviewBusy.value = null }
}
async function sendChanges(projectId: string) {
  const note = changeNote.value.trim()
  if (!note) return
  reviewBusy.value = projectId
  try {
    await requestChanges(projectId, note)
    toast.add({ title: 'Changes requested', description: 'Sent back to the provider.', color: 'success' })
    changesFor.value = null; changeNote.value = ''
    await load()
  } catch (e) {
    toast.add({ title: 'Could not request changes', description: errMsg(e), color: 'error' })
  } finally { reviewBusy.value = null }
}
async function accept(projectId: string) {
  reviewBusy.value = projectId
  try {
    await acceptWork(projectId)
    toast.add({ title: 'Accepted', description: 'The project is complete and the provider will be paid.', color: 'success' })
    await load()
  } catch (e) {
    toast.add({ title: 'Could not accept', description: errMsg(e), color: 'error' })
  } finally { reviewBusy.value = null }
}
function errMsg(e: unknown) {
  const x = e as { data?: { statusMessage?: string }; message?: string }
  return x?.data?.statusMessage ?? x?.message
}

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

function onResumePaid() {
  toast.add({
    title: 'Payment complete',
    description: 'Your project is being funded and will go live shortly.',
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
  if (f === 'awaiting_approval') return 'Awaiting approval'
  if (f === 'awaiting_payment') return 'Payment due'
  if (f === 'awaiting_verification') return 'Verifying payment'
  if (f === 'rejected') return 'Payment rejected'
  return p.status.replace(/_/g, ' ')
}

function labelColor(p: ProjectWithPayments) {
  const f = fundingStateOf(p)
  if (f === 'awaiting_approval') return 'neutral'
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
          <span class="text-sm tabular-nums text-stone-500 dark:text-stone-400">RM {{ p.budget_myr }}</span>
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

        <!-- Review the provider's submission (accept / request changes) -->
        <div v-if="UNDER_REVIEW.includes(p.status)" class="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div class="flex items-center gap-2 text-sm font-medium">
            <UIcon name="i-lucide-inbox" class="size-4 text-primary" /> The provider submitted work for review
          </div>
          <p class="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Review it, then accept to release payment — or ask for changes. You can keep chatting below.
          </p>

          <UButton
            class="zc-tap mt-2" size="sm" color="neutral" variant="soft" block icon="i-lucide-file-down"
            :loading="reviewBusy === p.id" label="View submitted work" @click="viewDeliverable(p.id)"
          />

          <div v-if="changesFor === p.id" class="mt-2 space-y-2">
            <UTextarea v-model="changeNote" :rows="2" placeholder="What needs to change?" class="w-full" />
            <div class="flex gap-2">
              <UButton size="sm" color="neutral" variant="soft" label="Cancel" class="flex-1" @click="changesFor = null" />
              <UButton size="sm" color="warning" class="flex-1 zc-tap" :loading="reviewBusy === p.id" :disabled="!changeNote.trim()" label="Send changes" @click="sendChanges(p.id)" />
            </div>
          </div>
          <div v-else class="mt-2 grid grid-cols-2 gap-2">
            <UButton size="sm" color="warning" variant="soft" class="zc-tap" icon="i-lucide-rotate-ccw" label="Request changes" @click="changesFor = p.id; changeNote = ''" />
            <UButton size="sm" color="primary" class="zc-tap" icon="i-lucide-check" label="Accept & pay" :loading="reviewBusy === p.id" @click="accept(p.id)" />
          </div>
        </div>

        <!-- Open the project chat/updates feed with the provider -->
        <div v-if="p.awarded_provider_id" class="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <UButton
            color="neutral" variant="soft" block class="zc-tap" icon="i-lucide-messages-square"
            label="Open chat" @click="chatFor = { id: p.id, title: p.title }"
          />
        </div>

        <!-- Request cancellation (SR) — the flow + refund rules live server-side -->
        <div v-if="CANCELLABLE.includes(p.status)" class="mt-2">
          <CancelProjectButton
            :project-id="p.id"
            :title="p.title"
            :budget="Number(p.budget_myr)"
            :deadline-at="p.deadline_at"
            :has-provider="!!p.awarded_provider_id"
            @done="load"
          />
        </div>
      </article>
    </div>

    <!-- Project chat / updates feed -->
    <ProjectChatSheet v-if="chatFor" :project-id="chatFor.id" :title="chatFor.title" @close="chatFor = null" />

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
