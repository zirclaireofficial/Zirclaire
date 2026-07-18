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
  </div>
</template>
