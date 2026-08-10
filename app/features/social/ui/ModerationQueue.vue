<script setup lang="ts">
// Admin moderation queue. Deliberately basic: see what was reported, read the
// content in place, then remove it or dismiss the report.
//
// Removing a post flips its status to 'removed' — the same lever the future
// AI sweeper will pull — so it drops out of the public feed_posts view at once.
// Comments have no removed state, so those are deleted outright.

import { useSocial } from '~/features/social/application/useSocial'
import { useModeration } from '~/features/social/application/useModeration'
import type { PendingReport } from '~/features/social/domain'

const { openReports } = useSocial()
const { removePost, removeComment, resolveReport } = useModeration()
const toast = useToast()

const reports = ref<PendingReport[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)
const filter = ref<'all' | 'system' | 'user'>('all')

const filtered = computed(() =>
  filter.value === 'all' ? reports.value : reports.value.filter((r) => r.source === filter.value),
)
const systemCount = computed(() => reports.value.filter((r) => r.source === 'system').length)
const userCount = computed(() => reports.value.filter((r) => r.source === 'user').length)

async function load() {
  loading.value = true
  try {
    reports.value = await openReports()
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load reports', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

function drop(id: string) {
  reports.value = reports.value.filter((r) => r.id !== id)
}

/** Remove the reported content, then close the report as actioned. */
async function takeDown(r: PendingReport) {
  busy.value = r.id
  try {
    if (r.target_type === 'post' && r.post_id) await removePost(r.post_id)
    else if (r.comment_id) await removeComment(r.comment_id)
    await resolveReport(r.id, 'actioned')
    toast.add({ title: `${r.target_type === 'post' ? 'Post' : 'Comment'} removed`, color: 'success' })
    drop(r.id)
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not remove', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}

/** Leave the content up and close the report. */
async function dismiss(r: PendingReport) {
  busy.value = r.id
  try {
    await resolveReport(r.id, 'dismissed')
    toast.add({ title: 'Report dismissed', color: 'neutral' })
    drop(r.id)
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not dismiss', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(m, 1)}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const alreadyRemoved = (r: PendingReport) => r.target_type === 'post' && r.post?.status === 'removed'
</script>

<template>
  <div>
    <!-- Filter by who flagged it -->
    <div class="mb-4 flex flex-wrap gap-1.5">
      <button
        v-for="f in [{ k: 'all', l: `All (${reports.length})` }, { k: 'system', l: `System (${systemCount})` }, { k: 'user', l: `Member (${userCount})` }]"
        :key="f.k"
        class="zc-tap rounded-full border px-3 py-1 text-xs transition"
        :class="filter === f.k ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400'"
        @click="filter = (f.k as 'all' | 'system' | 'user')"
      >
        {{ f.l }}
      </button>
    </div>

    <div v-if="loading" class="grid gap-4 lg:grid-cols-2">
      <div v-for="i in 2" :key="i" class="zc-card h-48 animate-pulse" />
    </div>

    <div v-else-if="!filtered.length" class="flex flex-col items-center gap-2 py-20 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-shield-check" class="size-6 text-success" />
      </div>
      <p class="font-medium">Nothing reported</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">The queue is clear.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="r in filtered" :key="r.id" class="zc-card p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="primary" variant="soft" size="sm" class="capitalize">{{ r.target_type }}</UBadge>
            <!-- Who flagged it: the AI sweeper or a member -->
            <UBadge :color="r.source === 'system' ? 'info' : 'neutral'" variant="soft" size="sm">
              <UIcon :name="r.source === 'system' ? 'i-lucide-bot' : 'i-lucide-user'" class="mr-1 size-3" />
              {{ r.source === 'system' ? 'AI flagged' : 'Member report' }}
            </UBadge>
            <UBadge v-if="alreadyRemoved(r)" color="neutral" variant="soft" size="sm">Already removed</UBadge>
          </div>
          <span class="shrink-0 text-xs text-stone-400">{{ ago(r.created_at) }}</span>
        </div>

        <!-- Why it was flagged -->
        <div class="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm">
          <UIcon :name="r.source === 'system' ? 'i-lucide-bot' : 'i-lucide-flag'" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <p class="leading-snug">{{ r.reason || 'No reason given' }}</p>
            <p class="mt-1 text-xs text-stone-500 dark:text-stone-400">
              <template v-if="r.source === 'system'">Flagged automatically by AI moderation</template>
              <template v-else>
                Reported by {{ r.reporter?.full_name ?? 'a member' }}
                <span class="font-mono">{{ r.reporter?.member_id }}</span>
              </template>
            </p>
          </div>
        </div>

        <!-- The content itself -->
        <div class="mt-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
          <p class="mb-1.5 text-[11px] uppercase tracking-wide text-stone-400">Reported content</p>

          <template v-if="r.target_type === 'post' && r.post">
            <p class="text-xs text-stone-500 dark:text-stone-400">
              {{ r.post.author?.full_name ?? 'Member' }}
              <span class="font-mono">{{ r.post.author?.member_id }}</span>
            </p>
            <p v-if="r.post.body" class="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{{ r.post.body }}</p>
            <p v-else class="mt-1 text-sm italic text-stone-400">No text</p>
          </template>

          <template v-else-if="r.comment">
            <p class="text-xs text-stone-500 dark:text-stone-400">
              {{ r.comment.author?.full_name ?? 'Member' }}
              <span class="font-mono">{{ r.comment.author?.member_id }}</span>
            </p>
            <p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{{ r.comment.body }}</p>
          </template>

          <p v-else class="text-sm italic text-stone-400">
            The content was already deleted by its author.
          </p>
        </div>

        <div class="mt-4 flex gap-2">
          <UButton
            color="error"
            size="sm"
            icon="i-lucide-trash-2"
            class="zc-tap flex-1"
            :loading="busy === r.id"
            :disabled="alreadyRemoved(r)"
            :label="alreadyRemoved(r) ? 'Removed' : 'Remove content'"
            @click="takeDown(r)"
          />
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-check"
            label="Dismiss"
            class="zc-tap"
            :loading="busy === r.id"
            @click="dismiss(r)"
          />
        </div>
      </article>
    </div>
  </div>
</template>
