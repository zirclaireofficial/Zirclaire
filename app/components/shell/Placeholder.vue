<script setup lang="ts">
defineProps<{ title: string; icon: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-24 text-center">
    <div class="flex size-14 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800">
      <UIcon :name="icon" class="size-7 text-stone-400" />
    </div>
    <h1 class="font-serif text-xl">{{ title }}</h1>
    <p class="text-sm text-stone-500 dark:text-stone-400">Coming soon in this phase.</p>
  </div>
</template>
