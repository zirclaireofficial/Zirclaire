<script setup lang="ts">
import { useAuth } from '~/features/auth/application/useAuth'
import type { Database } from '~/shared/types/database'

const { user, signOut } = useAuth()
const supabase = useSupabaseClient<Database>()

const role = ref<string | null>(null)
const memberId = ref<string | null>(null)
const fullName = ref<string | null>(null)
const kycStatus = ref<string | null>(null)

// Direct client read (RLS-gated). Note: useSupabaseUser() returns JWT claims,
// so the user id is `sub`, not `id`.
async function loadProfile() {
  const uid = (user.value as { sub?: string } | null)?.sub
  if (!uid) return
  const { data } = await supabase
    .from('profiles')
    .select('role, member_id, full_name, kyc_status')
    .eq('id', uid)
    .maybeSingle()
  role.value = data?.role ?? null
  memberId.value = data?.member_id ?? null
  fullName.value = data?.full_name ?? null
  kycStatus.value = data?.kyc_status ?? null
}
watch(user, loadProfile, { immediate: true })
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6 py-4">
    <div v-if="user" class="space-y-5">
      <div class="flex items-center gap-3">
        <div class="flex size-12 items-center justify-center rounded-full bg-stone-900 font-medium text-white dark:bg-stone-100 dark:text-stone-900">
          <UIcon name="i-lucide-user" class="size-6" />
        </div>
        <div class="min-w-0">
          <h1 class="truncate font-serif text-xl leading-tight">{{ fullName || user.email }}</h1>
          <p class="font-mono text-sm text-stone-500 dark:text-stone-400">{{ memberId || 'Pending approval' }}</p>
        </div>
      </div>

      <div v-if="kycStatus === 'pending'" class="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-800/40 dark:text-stone-300">
        Your account is pending review. You'll be able to post and apply once an admin approves it.
      </div>

      <div v-if="role === 'admin'" class="space-y-2">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Admin</p>
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
      </div>

      <UButton color="error" variant="soft" icon="i-lucide-log-out" label="Sign out" @click="signOut" />
    </div>

    <div v-else class="space-y-3 py-16 text-center">
      <p class="text-sm text-stone-500 dark:text-stone-400">You're not signed in.</p>
      <UButton to="/login" color="primary" label="Sign in" />
    </div>
  </div>
</template>
