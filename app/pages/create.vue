<script setup lang="ts">
import { useMe } from '~/features/auth/application/useMe'
import ProjectCreateForm from '~/features/projects/ui/ProjectCreateForm.vue'
import PostComposer from '~/features/social/ui/PostComposer.vue'

const user = useSupabaseUser()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })
</script>

<template>
  <div class="mx-auto max-w-xl">
    <!-- Service Requester: create a project -->
    <template v-if="me?.role === 'service_requester'">
      <ProjectCreateForm v-if="me.kyc_status === 'approved'" />
      <div v-else class="flex flex-col items-center gap-2 py-24 text-center">
        <div class="flex size-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
          <UIcon name="i-lucide-clock" class="size-6 text-stone-400" />
        </div>
        <p class="font-medium">Pending approval</p>
        <p class="text-sm text-stone-500 dark:text-stone-400">You can create projects once an admin approves your account.</p>
      </div>
    </template>

    <!-- Service Provider: create a post -->
    <template v-else-if="me?.role === 'service_provider'">
      <PostComposer v-if="me.kyc_status === 'approved'" />
      <div v-else class="flex flex-col items-center gap-2 py-24 text-center">
        <div class="flex size-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
          <UIcon name="i-lucide-clock" class="size-6 text-stone-400" />
        </div>
        <p class="font-medium">Pending approval</p>
        <p class="text-sm text-stone-500 dark:text-stone-400">You can post once an admin approves your account.</p>
      </div>
    </template>

    <!-- Admins / loading -->
    <div v-else class="py-24 text-center text-sm text-stone-500 dark:text-stone-400">
      <UIcon name="i-lucide-loader" class="mx-auto mb-2 size-5 animate-spin" />
      Loading…
    </div>
  </div>
</template>
