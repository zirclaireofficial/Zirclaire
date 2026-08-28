<script setup lang="ts">
import PayoutQueue from '~/features/payouts/ui/PayoutQueue.vue'
definePageMeta({ middleware: 'master' })
</script>

<template>
  <PayoutQueue />
</template>
