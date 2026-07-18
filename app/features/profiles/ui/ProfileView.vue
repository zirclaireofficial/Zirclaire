<script setup lang="ts">
// A member's profile — the same component whether you're looking at your own
// page or someone else's. `owner` just adds the edit control.
//
// Everything shown here is public by design: name, member ID, role, picture,
// join date, and the member's own posts and replies. No project history, no
// budgets, no KYC. That stays true until we deliberately decide otherwise.

import { useSocial } from '~/features/social/application/useSocial'
import { usePublicMedia } from '~/shared/lib/media'
import { tabsFor, tabLabel, roleLabel, memberSince, initialsOf, profilePath } from '~/features/profiles/domain'
import type { PublicProfile, ProfileTab } from '~/features/profiles/domain'
import type { FeedPost, FeedComment } from '~/features/social/domain'
import PostCard from '~/features/social/ui/PostCard.vue'

const props = defineProps<{
  profile: PublicProfile
  /** True when the signed-in member is looking at their own page. */
  owner?: boolean
  /** Current user id, so PostCard can offer delete on own posts. */
  currentUserId?: string | null
}>()

const { postsBy, repliesBy } = useSocial()
const { publicMediaUrl } = usePublicMedia()
const toast = useToast()

const tabs = computed(() => tabsFor(props.profile.role))
const active = ref<ProfileTab>(tabs.value[0] ?? 'replies')

const posts = ref<FeedPost[]>([])
const replies = ref<FeedComment[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const [p, r] = await Promise.all([
      tabs.value.includes('posts') ? postsBy(props.profile.id) : Promise.resolve([]),
      repliesBy(props.profile.id),
    ])
    posts.value = p
    replies.value = r
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load activity', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
watch(() => props.profile.id, load, { immediate: true })

async function share() {
  const path = profilePath(props.profile.member_id)
  if (!path) return
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`)
    toast.add({ title: 'Profile link copied', color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy the link', color: 'error' })
  }
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(m, 1)}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-start gap-4">
      <img
        v-if="profile.profile_picture"
        :src="publicMediaUrl(profile.profile_picture)"
        :alt="profile.full_name ?? ''"
        class="size-16 shrink-0 rounded-full object-cover"
      >
      <div
        v-else
        class="flex size-16 shrink-0 items-center justify-center rounded-full bg-stone-900 text-lg font-medium text-white dark:bg-stone-100 dark:text-stone-900"
      >
        {{ initialsOf(profile.full_name) }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <h1 class="truncate font-serif text-xl leading-tight">{{ profile.full_name ?? 'Member' }}</h1>
          <UIcon name="i-lucide-badge-check" class="size-4 shrink-0 text-success" aria-label="Verified" />
        </div>
        <p class="font-mono text-sm text-stone-500 dark:text-stone-400">{{ profile.member_id ?? '—' }}</p>
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <UBadge color="primary" variant="soft" size="sm">{{ roleLabel(profile.role) }}</UBadge>
          <span class="text-xs text-stone-400">Member since {{ memberSince(profile.created_at) }}</span>
        </div>
      </div>
    </div>

    <!-- "Edit profile" from the wireframe is deliberately absent for now:
         almost every field here is KYC-verified (name must match the national
         ID), so what's editable needs deciding before there's a button. -->
    <div class="flex gap-2">
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-share-2"
        label="Share profile"
        class="zc-tap"
        @click="share"
      />
    </div>

    <!-- Tabs -->
    <div class="flex gap-6 border-b border-stone-200 dark:border-stone-800">
      <button
        v-for="t in tabs"
        :key="t"
        class="zc-tap -mb-px border-b-2 pb-2.5 text-sm transition"
        :class="active === t
          ? 'border-primary font-medium text-primary'
          : 'border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'"
        @click="active = t"
      >
        {{ tabLabel(t) }}
      </button>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 2" :key="i" class="zc-card h-32 animate-pulse" />
    </div>

    <!-- Posts -->
    <template v-else-if="active === 'posts'">
      <div v-if="!posts.length" class="py-14 text-center">
        <p class="text-sm text-stone-500 dark:text-stone-400">
          {{ owner ? "You haven't posted yet." : 'No posts yet.' }}
        </p>
        <UButton v-if="owner" to="/create" color="primary" size="sm" label="Write a post" class="zc-tap mt-3" />
      </div>
      <div v-else class="space-y-4">
        <PostCard
          v-for="p in posts"
          :key="p.id"
          :post="p"
          :current-user-id="currentUserId ?? null"
          :interactive="false"
        />
      </div>
    </template>

    <!-- Replies -->
    <template v-else>
      <p v-if="!replies.length" class="py-14 text-center text-sm text-stone-500 dark:text-stone-400">
        {{ owner ? "You haven't replied to anything yet." : 'No replies yet.' }}
      </p>
      <div v-else class="space-y-3">
        <div v-for="c in replies" :key="c.id" class="zc-card p-4">
          <p class="whitespace-pre-wrap text-[15px] leading-relaxed">{{ c.body }}</p>
          <p class="mt-2 text-xs text-stone-400">{{ ago(c.created_at) }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
