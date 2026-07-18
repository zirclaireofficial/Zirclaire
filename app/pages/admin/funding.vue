<script setup lang="ts">
import FundingQueue from '~/features/projects/ui/FundingQueue.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-banknote" class="size-6 text-primary" />
      <div>
        <h1 class="text-2xl font-semibold leading-tight tracking-tight">Project funding</h1>
        <p class="text-sm text-stone-500 dark:text-stone-400">Verify payments and launch projects to the feed.</p>
      </div>
    </div>
    <FundingQueue />
  </div>
</template>
