<script setup lang="ts">
withDefaults(defineProps<{ size?: number; rounded?: string }>(), {
  size: 28,
  rounded: 'rounded-lg',
})
</script>

<template>
  <span
    class="inline-flex items-center justify-center overflow-hidden bg-white ring-1 ring-stone-200 dark:ring-stone-700"
    :class="rounded"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <img src="/logo.jpeg" alt="Zirclaire" class="h-full w-full object-contain" >
  </span>
</template>
