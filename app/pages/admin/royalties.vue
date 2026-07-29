<script setup lang="ts">
import RoyaltyApprovalQueue from '~/features/royalties/ui/RoyaltyApprovalQueue.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-book-open-text" class="size-6 text-primary" />
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Royalty approvals</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Review works before they reach the store.</p>
      </div>
    </div>

    <RoyaltyApprovalQueue />
  </div>
</template>
