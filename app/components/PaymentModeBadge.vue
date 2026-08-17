<script setup lang="ts">
// Shows a clear banner whenever payments are NOT real money, so testers/users
// never mistake a sandbox or simulated flow for a real transaction. Renders
// nothing in live mode. Drop it near any funding / payout UI.
const mode = useRuntimeConfig().public.paymentsMode as 'simulator' | 'sandbox' | 'live'
</script>

<template>
  <div
    v-if="mode !== 'live'"
    class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
    :class="mode === 'sandbox'
      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
      : 'border-stone-300 bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-800/40 dark:text-stone-300'"
  >
    <UIcon name="i-lucide-flask-conical" class="size-4 shrink-0" />
    <span v-if="mode === 'sandbox'">Sandbox mode — this is a test payment. No real money moves.</span>
    <span v-else>Simulated — no payment is actually processed.</span>
  </div>
</template>
