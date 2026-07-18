<script setup lang="ts">
// Your own profile. Shows the same public card everyone else sees, plus the
// account section (approval state, admin shortcuts, sign out).

import { useAuth } from '~/features/auth/application/useAuth'
import { useMe } from '~/features/auth/application/useMe'
import { useProfiles } from '~/features/profiles/application/useProfiles'
import type { PublicProfile } from '~/features/profiles/domain'
import ProfileView from '~/features/profiles/ui/ProfileView.vue'

const { user, signOut } = useAuth()
const { me, load: loadMe } = useMe()
const { viewById } = useProfiles()

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? null)

const profile = ref<PublicProfile | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    await loadMe()
    // public_profiles only contains approved members, so this is null while
    // an account is still pending — which is exactly what we want to show.
    profile.value = currentUserId.value ? await viewById(currentUserId.value) : null
  } finally {
    loading.value = false
  }
}
watch(user, load, { immediate: true })
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6 py-2">
    <template v-if="user">
      <div v-if="loading" class="space-y-4">
        <div class="h-20 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-800" />
        <div class="zc-card h-32 animate-pulse" />
      </div>

      <ProfileView
        v-else-if="profile"
        :profile="profile"
        owner
        :current-user-id="currentUserId"
      />

      <!-- Not approved yet: no public profile exists, so show the state. -->
      <div v-else class="space-y-4">
        <div class="flex items-center gap-3">
          <div class="flex size-14 items-center justify-center rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
            <UIcon name="i-lucide-user" class="size-6" />
          </div>
          <div class="min-w-0">
            <h1 class="truncate font-serif text-xl leading-tight">{{ me?.full_name || user.email }}</h1>
            <p class="text-sm text-stone-500 dark:text-stone-400">Pending approval</p>
          </div>
        </div>
        <div class="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-800/40 dark:text-stone-300">
          Your account is under review. Once an admin approves it you'll get your member ID, and your profile becomes visible to the community.
        </div>
      </div>

      <!-- Account -->
      <div class="space-y-2 border-t border-stone-200 pt-5 dark:border-stone-800">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Account</p>

        <template v-if="me?.role === 'admin'">
          <NuxtLink to="/admin/kyc" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
            <span class="flex items-center gap-3">
              <UIcon name="i-lucide-shield-check" class="size-5 text-primary" />
              <span class="font-medium">KYC review</span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
          </NuxtLink>
          <NuxtLink to="/admin/funding" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
            <span class="flex items-center gap-3">
              <UIcon name="i-lucide-banknote" class="size-5 text-primary" />
              <span class="font-medium">Project funding</span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
          </NuxtLink>
        </template>

        <UButton color="error" variant="soft" icon="i-lucide-log-out" label="Sign out" class="zc-tap" @click="signOut" />
      </div>
    </template>

    <div v-else class="space-y-3 py-16 text-center">
      <p class="text-sm text-stone-500 dark:text-stone-400">You're not signed in.</p>
      <UButton to="/login" color="primary" label="Sign in" />
    </div>
  </div>
</template>
