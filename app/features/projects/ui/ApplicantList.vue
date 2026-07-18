<script setup lang="ts">
// The requester's view of who applied to one of their projects, laid out as in
// the wireframe: each applicant as a member ID with Approve / Reject beside it.
//
// "Reject" here is per the sketch, but the underlying transition is a single
// atomic award: choosing one applicant approves them and rejects everyone else
// in the same transaction. So rejecting an individual applicant is a local
// dismissal (hide them from the shortlist) — it never half-changes the project.

import { useProjects } from '~/features/projects/application/useProjects'
import { useProjectActions } from '~/features/projects/application/useProjectActions'
import { usePublicMedia } from '~/shared/lib/media'
import { canAward } from '~/features/projects/domain'
import type { Applicant, Project } from '~/features/projects/domain'

const props = defineProps<{ project: Project }>()
const emit = defineEmits<{ awarded: [] }>()

const { applicantsFor } = useProjects()
const { awardApplicant } = useProjectActions()
const { publicMediaUrl } = usePublicMedia()
const toast = useToast()

const applicants = ref<Applicant[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)
const dismissed = ref<Set<string>>(new Set())
const confirming = ref<Applicant | null>(null)

const open = computed(() => canAward(props.project))
const visible = computed(() => applicants.value.filter((a) => !dismissed.value.has(a.application_id)))

async function load() {
  loading.value = true
  try {
    applicants.value = await applicantsFor(props.project.id)
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load applicants', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function confirmAward(a: Applicant) {
  busy.value = a.application_id
  try {
    await awardApplicant(props.project.id, a.application_id)
    toast.add({
      title: 'Project awarded',
      description: `${a.member_id ?? 'The provider'} can now start work.`,
      color: 'success',
    })
    confirming.value = null
    emit('awarded')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not award', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}

function dismiss(a: Applicant) {
  dismissed.value = new Set([...dismissed.value, a.application_id])
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 2" :key="i" class="h-12 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
    </div>

    <p v-else-if="!applicants.length" class="py-4 text-center text-sm text-stone-500 dark:text-stone-400">
      No applicants yet.
    </p>

    <div v-else class="space-y-2">
      <div
        v-for="a in visible"
        :key="a.application_id"
        class="flex items-center gap-2.5 rounded-lg border border-stone-200 p-2.5 dark:border-stone-800"
        :class="a.status === 'approved' ? 'border-success/50 bg-success/5' : ''"
      >
        <!-- Applicant identity links to their public profile, so the requester
             can look at the provider's work before committing to them. -->
        <NuxtLink
          :to="a.member_id ? `/u/${a.member_id}` : ''"
          :class="a.member_id ? 'zc-tap' : 'pointer-events-none'"
          class="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <img
            v-if="a.profile_picture"
            :src="publicMediaUrl(a.profile_picture)"
            :alt="a.full_name ?? ''"
            class="size-9 shrink-0 rounded-full object-cover"
          >
          <div
            v-else
            class="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium dark:bg-stone-800"
          >
            {{ initials(a.full_name) }}
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-sm font-medium hover:text-primary">
              {{ a.member_id ?? 'Pending ID' }}
            </p>
            <p v-if="a.full_name" class="truncate text-xs text-stone-500 dark:text-stone-400">{{ a.full_name }}</p>
            <p v-if="a.cover_note" class="truncate text-xs text-stone-400">{{ a.cover_note }}</p>
          </div>
        </NuxtLink>

        <UBadge v-if="a.status === 'approved'" color="success" variant="soft" size="sm" class="shrink-0">
          Awarded
        </UBadge>
        <UBadge v-else-if="a.status === 'rejected'" color="neutral" variant="soft" size="sm" class="shrink-0">
          Not chosen
        </UBadge>

        <div v-else-if="open" class="flex shrink-0 gap-1.5">
          <UButton
            color="primary"
            size="xs"
            label="Approve"
            class="zc-tap"
            :loading="busy === a.application_id"
            @click="confirming = a"
          />
          <UButton
            color="neutral"
            variant="soft"
            size="xs"
            label="Reject"
            class="zc-tap"
            @click="dismiss(a)"
          />
        </div>
      </div>

      <p v-if="!visible.length" class="py-3 text-center text-xs text-stone-400">
        You've rejected everyone. They're still applied — reload to see them again.
      </p>
    </div>

    <!-- Awarding is irreversible and rejects everyone else, so confirm it. -->
    <Teleport to="body">
      <div
        v-if="confirming"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        @click.self="confirming = null"
      >
        <div class="w-full max-w-sm rounded-t-2xl bg-white p-5 dark:bg-stone-900 sm:rounded-2xl">
          <h2 class="font-medium">Award this project?</h2>
          <p class="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
            <span class="font-mono">{{ confirming.member_id }}</span> will be assigned to
            <span class="font-medium text-stone-700 dark:text-stone-200">{{ project.title }}</span>.
            Every other applicant is rejected at the same time, and this can't be undone.
          </p>
          <div class="mt-4 flex gap-2">
            <UButton
              color="primary"
              class="zc-tap flex-1"
              :loading="busy === confirming.application_id"
              label="Award project"
              @click="confirmAward(confirming)"
            />
            <UButton color="neutral" variant="ghost" label="Cancel" @click="confirming = null" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
