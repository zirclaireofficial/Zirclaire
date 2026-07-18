<script setup lang="ts">
// Auth callback landing (magic link / email confirmation). Once the session
// resolves, send the user to the feed.
definePageMeta({ layout: 'auth' })
const user = useSupabaseUser()
watchEffect(() => {
  if (user.value) navigateTo('/')
})
</script>

<template>
  <p class="text-center text-sm text-stone-500 dark:text-stone-400">Signing you in…</p>
</template>
