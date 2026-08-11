<script setup lang="ts">
// Password reset is now code-based on /forgot (no email link). This page only
// exists to redirect any old reset links or bookmarks to the new flow.
definePageMeta({ layout: 'auth' })
onMounted(() => navigateTo('/forgot', { replace: true }))
</script>

<template>
  <div class="text-center text-sm text-stone-500 dark:text-stone-400">
    Redirecting to password reset…
  </div>
</template>
