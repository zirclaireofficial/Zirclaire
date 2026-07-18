<script setup lang="ts">
// One post in the feed. Presentational: it renders what it's given and emits
// intent upward. It never decides whether an action is allowed — that's the
// list's job (and RLS's, in the end).

import { usePublicMedia } from '~/shared/lib/media'
import type { FeedPost } from '~/features/social/domain'

const props = withDefaults(
  defineProps<{
    post: FeedPost
    /** Current user id, or null when signed out. */
    currentUserId: string | null
    /**
     * When false the engagement row renders as plain counts instead of
     * buttons. Used on profile pages, where nothing is wired to handle the
     * events — a button that does nothing is worse than no button.
     */
    interactive?: boolean
  }>(),
  { interactive: true },
)

const emit = defineEmits<{
  favorite: [post: FeedPost]
  comment: [post: FeedPost]
  share: [post: FeedPost]
  report: [post: FeedPost]
  remove: [post: FeedPost]
}>()

const { thumbUrl, publicMediaUrl } = usePublicMedia()

const isMine = computed(() => !!props.currentUserId && props.post.author_id === props.currentUserId)

const initials = computed(() => {
  const n = props.post.author?.full_name
  if (!n) return '?'
  return n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
})

const timeAgo = computed(() => {
  const diff = Date.now() - new Date(props.post.created_at).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(props.post.created_at).toLocaleDateString()
})

const roleLabel = computed(() =>
  props.post.author?.role === 'service_provider' ? 'Provider' : 'Requester',
)

// 1 image = full width, 2 = halves, 3 = thirds.
const gridCols = computed(() =>
  props.post.media.length === 1 ? 'grid-cols-1' : props.post.media.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
)

const lightbox = ref<string | null>(null)

const menuItems = computed(() => [
  isMine.value
    ? [{ label: 'Delete post', icon: 'i-lucide-trash-2', onSelect: () => emit('remove', props.post) }]
    : [{ label: 'Report post', icon: 'i-lucide-flag', onSelect: () => emit('report', props.post) }],
])
</script>

<template>
  <article class="zc-card zc-card-hover p-4">
    <div class="flex items-center gap-3">
      <img
        v-if="post.author?.profile_picture"
        :src="publicMediaUrl(post.author.profile_picture)"
        :alt="post.author.full_name ?? ''"
        class="size-10 rounded-full object-cover"
      >
      <div
        v-else
        class="flex size-10 items-center justify-center rounded-full bg-stone-900 font-medium text-white dark:bg-stone-100 dark:text-stone-900"
      >
        {{ initials }}
      </div>

      <!-- Member ID leads, as in the wireframe; the name sits underneath.
           The byline links through to the author's public profile. -->
      <NuxtLink
        :to="post.author?.member_id ? `/u/${post.author.member_id}` : ''"
        :class="post.author?.member_id ? 'zc-tap' : 'pointer-events-none'"
        class="min-w-0 flex-1"
      >
        <div class="flex items-center gap-1.5">
          <span class="truncate font-mono text-sm font-medium hover:text-primary">{{ post.author?.member_id ?? '—' }}</span>
          <UIcon name="i-lucide-badge-check" class="size-4 shrink-0 text-success" aria-label="Verified" />
          <UBadge color="primary" variant="soft" size="sm" class="shrink-0">{{ roleLabel }}</UBadge>
        </div>
        <p class="truncate text-xs text-stone-500 dark:text-stone-400">
          {{ post.author?.full_name ?? 'Member' }} · {{ timeAgo }}
        </p>
      </NuxtLink>

      <UDropdownMenu :items="menuItems">
        <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="xs" aria-label="More" />
      </UDropdownMenu>
    </div>

    <p v-if="post.body" class="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{{ post.body }}</p>

    <div v-if="post.media.length" class="mt-3 grid gap-1.5" :class="gridCols">
      <button
        v-for="m in post.media"
        :key="m.id"
        type="button"
        class="zc-tap overflow-hidden rounded-lg"
        :class="post.media.length === 1 ? 'aspect-video' : 'aspect-square'"
        @click="lightbox = publicMediaUrl(m.media_url)"
      >
        <img :src="thumbUrl(m.media_url)" alt="" class="h-full w-full object-cover" loading="lazy" >
      </button>
    </div>

    <div v-if="interactive" class="mt-3 flex items-center gap-6 text-stone-500 dark:text-stone-400">
      <button
        class="zc-tap flex items-center gap-1.5 text-sm transition hover:text-primary"
        :class="post.favorited ? 'text-primary' : ''"
        :aria-pressed="post.favorited"
        @click="emit('favorite', post)"
      >
        <UIcon name="i-lucide-heart" class="size-5" :class="post.favorited ? 'fill-current' : ''" />
        {{ post.favorite_count }}
      </button>
      <button
        class="zc-tap flex items-center gap-1.5 text-sm transition hover:text-stone-900 dark:hover:text-stone-100"
        @click="emit('comment', post)"
      >
        <UIcon name="i-lucide-message-circle" class="size-5" />
        {{ post.comment_count }}
      </button>
      <button
        class="zc-tap flex items-center gap-1.5 text-sm transition hover:text-stone-900 dark:hover:text-stone-100"
        @click="emit('share', post)"
      >
        <UIcon name="i-lucide-share-2" class="size-5" />
        {{ post.share_count }}
      </button>
    </div>

    <!-- Display-only counts (profile pages) -->
    <div v-else class="mt-3 flex items-center gap-6 text-sm text-stone-500 dark:text-stone-400">
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-heart" class="size-5" :class="post.favorited ? 'fill-current text-primary' : ''" />
        {{ post.favorite_count }}
      </span>
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-message-circle" class="size-5" /> {{ post.comment_count }}
      </span>
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-share-2" class="size-5" /> {{ post.share_count }}
      </span>
    </div>

    <Teleport to="body">
      <div
        v-if="lightbox"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        @click.self="lightbox = null"
      >
        <button
          class="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/60 text-white"
          aria-label="Close"
          @click="lightbox = null"
        >
          <UIcon name="i-lucide-x" class="size-5" />
        </button>
        <img :src="lightbox" alt="" class="max-h-[90vh] max-w-full rounded-xl object-contain" >
      </div>
    </Teleport>
  </article>
</template>
