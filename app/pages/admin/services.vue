<script setup lang="ts">
import ServiceApprovalQueue from '~/features/services/ui/ServiceApprovalQueue.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-briefcase" class="size-6 text-primary" />
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Service approvals</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Review service listings before they reach the store.</p>
      </div>
    </div>

    <ServiceApprovalQueue />
  </div>
</template>
