<script setup lang="ts">
import { useMe } from '~/features/auth/application/useMe'
import Inbox from '~/features/messaging/ui/Inbox.vue'
import SupportQueue from '~/features/messaging/ui/SupportQueue.vue'

// Admins get the support queue; everyone else gets their inbox.
const user = useSupabaseUser()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })
</script>

<template>
  <div>
    <div v-if="!user" class="py-24 text-center">
      <p class="text-sm text-stone-500 dark:text-stone-400">Sign in to see your messages.</p>
      <UButton to="/login" color="primary" size="sm" label="Sign in" class="mt-3" />
    </div>
    <SupportQueue v-else-if="me?.role === 'admin'" />
    <Inbox v-else />
  </div>
</template>
