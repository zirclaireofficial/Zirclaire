<script setup lang="ts">
import StaffGuide from '~/features/guide/ui/StaffGuide.vue'
// Staff middleware already lets admin AND master through.
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <StaffGuide />
</template>
