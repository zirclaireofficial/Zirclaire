<script setup lang="ts">
// Project payouts moved to the Master console (admin no longer handles money-out
// for projects). This page just points there.
definePageMeta({ middleware: 'admin' })
onMounted(() => navigateTo('/admin'))
</script>

<template>
  <div class="py-24 text-center text-sm text-stone-500 dark:text-stone-400">
    Project payouts are handled in the Master console.
  </div>
</template>
