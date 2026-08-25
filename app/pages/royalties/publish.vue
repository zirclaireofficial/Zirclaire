<script setup lang="ts">
import { useMe } from '~/features/auth/application/useMe'
import RoyaltyPublishForm from '~/features/royalties/ui/RoyaltyPublishForm.vue'

const user = useSupabaseUser()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })

const allowed = computed(
  () => me.value?.role === 'service_requester' && me.value?.kyc_status === 'approved',
)
</script>

<template>
  <div class="mx-auto max-w-xl">
    <RoyaltyPublishForm v-if="allowed" />
    <div v-else class="flex flex-col items-center gap-2 py-24 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
        <UIcon name="i-lucide-lock" class="size-6 text-stone-400" />
      </div>
      <p class="font-medium">Requesters only</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">Only requesters can list the deliverable of a completed project.</p>
      <UButton to="/royalties" color="neutral" variant="soft" size="sm" label="Back to the store" class="mt-1" />
    </div>
  </div>
</template>
