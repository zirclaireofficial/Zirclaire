<script setup lang="ts">
// The feed. Public to read; interaction requires an approved, signed-in
// account. This component owns the "may I?" decisions and the optimistic
// updates; PostCard just renders and emits.

import { useSocial } from '~/features/social/application/useSocial'
import { useMe } from '~/features/auth/application/useMe'
import { canInteract, canCreatePost } from '~/features/social/domain'
import type { FeedPost } from '~/features/social/domain'
import PostCard from './PostCard.vue'
import CommentSheet from './CommentSheet.vue'
import ReportDialog from './ReportDialog.vue'

const { browseFeed, toggleFavorite, sharePost, removeOwnPost } = useSocial()
const user = useSupabaseUser()
const { me, load: loadMe } = useMe()
const toast = useToast()

watch(user, () => loadMe(), { immediate: true })

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? null)
const mayInteract = computed(() => canInteract(me.value?.role ?? null, me.value?.kyc_status ?? null))
const mayPost = computed(() => canCreatePost(me.value?.role ?? null, me.value?.kyc_status ?? null))

const posts = ref<FeedPost[]>([])
const cursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const exhausted = ref(false)

const commenting = ref<FeedPost | null>(null)
const reporting = ref<FeedPost | null>(null)

async function load() {
  loading.value = true
  try {
    const page = await browseFeed(null)
    posts.value = page.posts
    cursor.value = page.nextCursor
    exhausted.value = !page.nextCursor
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load the feed', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Reload once auth resolves, so favorite state reflects the signed-in user.
watch(currentUserId, (id, prev) => {
  if (id !== prev && !loading.value) load()
})

async function loadMore() {
  if (loadingMore.value || exhausted.value || !cursor.value) return
  loadingMore.value = true
  try {
    const page = await browseFeed(cursor.value)
    posts.value.push(...page.posts)
    cursor.value = page.nextCursor
    exhausted.value = !page.nextCursor
  } finally {
    loadingMore.value = false
  }
}

/** Anything gated behind sign-in funnels through here. */
function requireAccount(): boolean {
  if (!currentUserId.value) {
    toast.add({
      title: 'Sign in to do that',
      description: 'Create an account to favorite, comment and share.',
      color: 'neutral',
      actions: [{ label: 'Sign in', onClick: () => navigateTo('/login') }],
    })
    return false
  }
  if (!mayInteract.value) {
    toast.add({ title: 'Pending approval', description: 'You can interact once an admin approves your account.', color: 'warning' })
    return false
  }
  return true
}

async function onFavorite(post: FeedPost) {
  if (!requireAccount()) return
  const was = post.favorited
  // Optimistic — the counter is a trigger-maintained column, so we mirror it.
  post.favorited = !was
  post.favorite_count += was ? -1 : 1
  try {
    await toggleFavorite(post.id, was)
  } catch {
    post.favorited = was
    post.favorite_count += was ? 1 : -1
    toast.add({ title: 'Could not update', color: 'error' })
  }
}

function onComment(post: FeedPost) {
  // Reading comments is public; the sheet itself gates writing.
  commenting.value = post
}

async function onShare(post: FeedPost) {
  const url = `${window.location.origin}/?post=${post.id}`
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: 'Link copied', color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy the link', color: 'error' })
    return
  }
  if (currentUserId.value && mayInteract.value) {
    try {
      await sharePost(post.id)
      post.share_count += 1
    } catch { /* the copy is what matters; the log is best-effort */ }
  }
}

function onReport(post: FeedPost) {
  if (!requireAccount()) return
  reporting.value = post
}

async function onRemove(post: FeedPost) {
  try {
    await removeOwnPost(post.id)
    posts.value = posts.value.filter((p) => p.id !== post.id)
    toast.add({ title: 'Post deleted', color: 'neutral' })
  } catch {
    toast.add({ title: 'Could not delete the post', color: 'error' })
  }
}

function onCommentCounted(delta: number) {
  if (commenting.value) commenting.value.comment_count += delta
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between">
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Feed</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">What the community is working on.</p>
      </div>
      <UButton
        v-if="mayPost"
        to="/create"
        size="xs"
        color="primary"
        icon="i-lucide-pencil"
        label="Post"
        class="zc-tap"
      />
      <UButton
        v-else-if="!currentUserId"
        to="/signup"
        size="xs"
        color="primary"
        label="Join"
        class="zc-tap"
      />
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="zc-card h-48 animate-pulse" />
    </div>

    <div
      v-else-if="!posts.length"
      class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-16 text-center dark:border-stone-800"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
        <UIcon name="i-lucide-message-square-dashed" class="size-6 text-primary" />
      </div>
      <p class="font-medium">Nothing here yet</p>
      <p class="max-w-xs text-sm text-stone-500 dark:text-stone-400">
        {{ mayPost ? 'Be the first to share something with the community.' : 'Posts from providers will show up here.' }}
      </p>
      <UButton v-if="mayPost" to="/create" color="primary" size="sm" label="Write a post" class="zc-tap mt-1" />
    </div>

    <template v-else>
      <PostCard
        v-for="p in posts"
        :key="p.id"
        :post="p"
        :current-user-id="currentUserId"
        @favorite="onFavorite"
        @comment="onComment"
        @share="onShare"
        @report="onReport"
        @remove="onRemove"
      />

      <div class="pt-1 text-center">
        <UButton
          v-if="!exhausted"
          color="neutral"
          variant="soft"
          size="sm"
          :loading="loadingMore"
          label="Load more"
          class="zc-tap"
          @click="loadMore"
        />
        <p v-else class="text-xs text-stone-400">You're all caught up.</p>
      </div>
    </template>

    <CommentSheet
      v-if="commenting"
      :post="commenting"
      :current-user-id="currentUserId"
      :role="me?.role ?? null"
      :kyc-status="me?.kyc_status ?? null"
      @close="commenting = null"
      @counted="onCommentCounted"
    />

    <ReportDialog
      v-if="reporting"
      target="post"
      :target-id="reporting.id"
      @close="reporting = null"
    />
  </div>
</template>
