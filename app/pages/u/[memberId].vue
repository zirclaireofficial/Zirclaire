<script setup lang="ts">
// Public profile — /u/MYRSP00007. Readable by anyone, signed out included,
// which is what "share profile" points at.

import { useProfiles } from '~/features/profiles/application/useProfiles'
import { roleLabel } from '~/features/profiles/domain'
import type { PublicProfile } from '~/features/profiles/domain'
import ProfileView from '~/features/profiles/ui/ProfileView.vue'

const route = useRoute()
const user = useSupabaseUser()
const { viewByHandle } = useProfiles()

const memberId = computed(() => String(route.params.memberId ?? ''))
const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? null)

const profile = ref<PublicProfile | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    profile.value = await viewByHandle(memberId.value)
  } finally {
    loading.value = false
  }
}
watch(memberId, load, { immediate: true })

// If you open your own handle, you get the owner controls.
const isOwner = computed(() => !!profile.value && profile.value.id === currentUserId.value)

watchEffect(() => {
  if (profile.value) {
    useSeoMeta({
      title: `${profile.value.full_name} (${profile.value.member_id}) — Zirclaire`,
      description: `${profile.value.full_name} is a verified ${roleLabel(profile.value.role).toLowerCase()} on Zirclaire.`,
    })
  }
})
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div v-if="loading" class="space-y-4">
      <div class="h-20 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-800" />
      <div class="zc-card h-32 animate-pulse" />
    </div>

    <div v-else-if="!profile" class="flex flex-col items-center gap-2 py-24 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
        <UIcon name="i-lucide-user-x" class="size-6 text-stone-400" />
      </div>
      <p class="font-medium">Member not found</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">
        No approved member with the ID <span class="font-mono">{{ memberId }}</span>.
      </p>
      <UButton to="/" color="neutral" variant="soft" size="sm" label="Back to the feed" class="mt-1" />
    </div>

    <ProfileView v-else :profile="profile" :owner="isOwner" :current-user-id="currentUserId" />
  </div>
</template>
