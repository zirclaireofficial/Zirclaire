<script setup lang="ts">
import PaymentAudit from '~/features/payments-audit/ui/PaymentAudit.vue'
definePageMeta({ middleware: 'master' })
</script>

<template>
  <PaymentAudit />
</template>
