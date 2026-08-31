<script setup lang="ts">
import RefundQueue from '~/features/payouts/ui/RefundQueue.vue'
definePageMeta({ middleware: 'master' })
</script>

<template>
  <RefundQueue />
</template>
