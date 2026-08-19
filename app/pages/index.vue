<script setup lang="ts">
import PostList from '~/features/social/ui/PostList.vue'

// Admins can read the feed too (they moderate it), so there's no redirect
// here — their nav points at the dashboard explicitly instead.

// The feed is public, so it's worth being findable.
useSeoMeta({
  title: 'Zirclaire — a community of verified professionals',
  description:
    'Browse work from verified service providers on Zirclaire. Every project is escrow-backed and every member is identity-verified.',
})
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PostList />
    <p class="mt-8 flex items-center justify-center gap-1.5 border-t border-stone-200 pt-4 text-xs text-stone-400 dark:border-stone-800">
      <UIcon name="i-lucide-clock" class="size-3.5" />
      Office hours: 9:00 AM – 5:00 PM (Kuala Lumpur)
    </p>
  </div>
</template>
