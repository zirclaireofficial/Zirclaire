<script setup lang="ts">
import AdminProjectList from '~/features/projects/ui/AdminProjectList.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-folder-kanban" class="size-6 text-primary" />
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Projects</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Every project on the platform, with its parties and money trail.
        </p>
      </div>
    </div>

    <AdminProjectList />
  </div>
</template>
