<script setup lang="ts">
// Flat comments for one post. Threading exists in the schema
// (comments.parent_comment_id) but is deliberately unused in v1 — replies can
// be added later with no migration.

import { useSocial } from '~/features/social/application/useSocial'
import { usePublicMedia } from '~/shared/lib/media'
import { canInteract, canDeleteComment } from '~/features/social/domain'
import type { FeedComment, FeedPost } from '~/features/social/domain'
import ReportDialog from './ReportDialog.vue'

const props = defineProps<{
  post: FeedPost
  currentUserId: string | null
  role: string | null
  kycStatus: string | null
}>()

const emit = defineEmits<{ close: []; counted: [delta: number] }>()

const { comments: loadComments, postComment, removeOwnComment } = useSocial()
const { publicMediaUrl } = usePublicMedia()
const toast = useToast()

const items = ref<FeedComment[]>([])
const loading = ref(true)
const body = ref('')
const sending = ref(false)
const reporting = ref<string | null>(null)

const mayComment = computed(() => canInteract(props.role, props.kycStatus))

async function load() {
  loading.value = true
  try {
    items.value = await loadComments(props.post.id)
  } catch {
    toast.add({ title: 'Could not load comments', color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function send() {
  if (!body.value.trim() || sending.value) return
  sending.value = true
  try {
    await postComment(props.post.id, body.value)
    body.value = ''
    await load()
    emit('counted', 1)
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not comment', description: err?.message, color: 'error' })
  } finally {
    sending.value = false
  }
}

async function remove(c: FeedComment) {
  try {
    await removeOwnComment(c.id)
    items.value = items.value.filter((x) => x.id !== c.id)
    emit('counted', -1)
  } catch {
    toast.add({ title: 'Could not delete comment', color: 'error' })
  }
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      @click.self="emit('close')"
    >
      <div class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white dark:bg-stone-900 sm:rounded-2xl">
        <div class="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
          <h2 class="font-medium">Comments</h2>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Close" @click="emit('close')" />
        </div>

        <div class="flex-1 overflow-y-auto px-4 py-3">
          <div v-if="loading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
          </div>

          <p v-else-if="!items.length" class="py-10 text-center text-sm text-stone-500 dark:text-stone-400">
            No comments yet. Be the first.
          </p>

          <div v-else class="space-y-4">
            <div v-for="c in items" :key="c.id" class="flex gap-2.5">
              <img
                v-if="c.author?.profile_picture"
                :src="publicMediaUrl(c.author.profile_picture)"
                :alt="c.author.full_name ?? ''"
                class="size-8 shrink-0 rounded-full object-cover"
              >
              <div
                v-else
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium dark:bg-stone-800"
              >
                {{ initials(c.author?.full_name ?? null) }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-800/60">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-sm font-medium">{{ c.author?.full_name ?? 'Member' }}</span>
                    <span class="shrink-0 font-mono text-[11px] text-stone-400">{{ c.author?.member_id }}</span>
                  </div>
                  <p class="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{{ c.body }}</p>
                </div>
                <div class="mt-1 flex items-center gap-3 pl-1 text-[11px] text-stone-400">
                  <span>{{ ago(c.created_at) }}</span>
                  <button
                    v-if="canDeleteComment(c, currentUserId)"
                    class="hover:text-primary"
                    @click="remove(c)"
                  >
                    Delete
                  </button>
                  <button
                    v-else-if="mayComment"
                    class="hover:text-primary"
                    @click="reporting = c.id"
                  >
                    Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t border-stone-200 p-3 dark:border-stone-800">
          <div v-if="mayComment" class="flex items-end gap-2">
            <UTextarea
              v-model="body"
              :rows="1"
              autoresize
              placeholder="Write a comment…"
              class="w-full"
              @keydown.enter.exact.prevent="send"
            />
            <UButton
              icon="i-lucide-send-horizontal"
              color="primary"
              class="zc-tap shrink-0"
              :loading="sending"
              :disabled="!body.trim()"
              aria-label="Send"
              @click="send"
            />
          </div>
          <div v-else-if="!currentUserId" class="flex items-center justify-between gap-3">
            <p class="text-sm text-stone-500 dark:text-stone-400">Sign in to join the conversation.</p>
            <UButton to="/login" color="primary" size="sm" label="Sign in" />
          </div>
          <p v-else class="text-center text-sm text-stone-500 dark:text-stone-400">
            You can comment once your account is approved.
          </p>
        </div>
      </div>
    </div>

    <ReportDialog
      v-if="reporting"
      target="comment"
      :target-id="reporting"
      @close="reporting = null"
    />
  </Teleport>
</template>
