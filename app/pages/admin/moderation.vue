<script setup lang="ts">
import ModerationQueue from '~/features/social/ui/ModerationQueue.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-flag" class="size-6 text-primary" />
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Reports</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Review reported posts and comments.</p>
      </div>
    </div>

    <ModerationQueue />
  </div>
</template>
