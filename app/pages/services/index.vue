<script setup lang="ts">
import ServiceStore from '~/features/services/ui/ServiceStore.vue'

useSeoMeta({
  title: 'Services — Zirclaire',
  description: 'Order fixed-price services from verified providers on Zirclaire.',
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <ServiceStore />
  </div>
</template>
