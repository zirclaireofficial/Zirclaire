<script setup lang="ts">
import KycQueue from '~/features/kyc/ui/KycQueue.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-shield-check" class="size-6 text-primary" />
      <div>
        <h1 class="font-serif text-2xl leading-tight">KYC review</h1>
        <p class="text-sm text-stone-500 dark:text-stone-400">Approve or reject pending accounts.</p>
      </div>
    </div>
    <KycQueue />
  </div>
</template>
