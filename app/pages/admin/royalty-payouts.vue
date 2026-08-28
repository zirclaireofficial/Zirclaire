<script setup lang="ts">
import RoyaltyPayoutQueue from '~/features/payouts/ui/RoyaltyPayoutQueue.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <RoyaltyPayoutQueue />
</template>
