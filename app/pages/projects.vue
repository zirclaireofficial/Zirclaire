<script setup lang="ts">
import { useMe } from '~/features/auth/application/useMe'
import ProjectFeed from '~/features/projects/ui/ProjectFeed.vue'
import MyProjects from '~/features/projects/ui/MyProjects.vue'
import MyCancellations from '~/features/cancellations/ui/MyCancellations.vue'

const user = useSupabaseUser()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })

const isParty = computed(() => me.value?.role === 'service_provider' || me.value?.role === 'service_requester')
</script>

<template>
  <div>
    <!-- Any cancellation the current user is involved in (both roles) -->
    <MyCancellations v-if="isParty" />

    <ProjectFeed v-if="me?.role === 'service_provider'" />
    <MyProjects v-else-if="me?.role === 'service_requester'" />

    <div v-else-if="me?.role === 'admin'" class="flex flex-col items-center gap-3 py-24 text-center">
      <UIcon name="i-lucide-shield-check" class="size-8 text-stone-300 dark:text-stone-600" />
      <p class="text-sm text-stone-500 dark:text-stone-400">Admins manage projects in the console.</p>
      <UButton to="/admin/kyc" color="neutral" variant="soft" size="sm" label="Open admin" />
    </div>

    <div v-else class="py-24 text-center text-sm text-stone-500 dark:text-stone-400">
      <UIcon name="i-lucide-loader" class="mx-auto mb-2 size-5 animate-spin" />
      Loading…
    </div>
  </div>
</template>
