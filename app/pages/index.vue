<script setup lang="ts">
import { useMe } from '~/features/auth/application/useMe'
import PostList from '~/features/social/ui/PostList.vue'

// Admins get the console, not the social feed.
const user = useSupabaseUser()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })
watch(me, (v) => { if (v?.role === 'admin') navigateTo('/admin') }, { immediate: true })

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
