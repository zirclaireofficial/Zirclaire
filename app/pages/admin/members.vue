<script setup lang="ts">
import AdminMemberList from '~/features/profiles/ui/AdminMemberList.vue'
definePageMeta({ middleware: 'admin' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-users" class="size-6 text-primary" />
      <div>
        <h1 class="zc-title font-serif text-2xl leading-tight">Members</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Everyone on the platform and their role.
        </p>
      </div>
    </div>

    <AdminMemberList />
  </div>
</template>
