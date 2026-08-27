<script setup lang="ts">
import PayoutQueue from '~/features/payouts/ui/PayoutQueue.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <PayoutQueue />
</template>
