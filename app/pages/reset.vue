<script setup lang="ts">
// Set a new password. Reached from the reset link in the email — Supabase
// establishes a recovery session on arrival, which lets updateUser set the
// new password.
import { useAuth } from '~/features/auth/application/useAuth'
definePageMeta({ layout: 'auth' })

const { user, setPassword, signOut } = useAuth()
const password = ref('')
const confirm = ref('')
const done = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (password.value.length < 8) { error.value = 'Use at least 8 characters.'; return }
  if (password.value !== confirm.value) { error.value = 'Passwords do not match.'; return }
  loading.value = true
  try {
    await setPassword(password.value)
    done.value = true
  } catch (e) {
    error.value = (e as { message?: string })?.message ?? 'Could not update the password. The link may have expired.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="font-serif text-xl">Set a new password</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Choose a new password for your account.</p>
    </div>

    <div v-if="done" class="space-y-3 text-center">
      <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-check" class="size-6 text-success" />
      </div>
      <p class="text-sm text-stone-600 dark:text-stone-300">Your password has been updated.</p>
      <UButton to="/" color="primary" block label="Continue" />
    </div>

    <!-- No recovery session means the link is missing/expired. -->
    <div v-else-if="!user" class="space-y-3 text-center">
      <p class="text-sm text-stone-500 dark:text-stone-400">
        This reset link is invalid or has expired. Request a new one.
      </p>
      <UButton to="/forgot" color="primary" block label="Request a new link" />
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <UAlert v-if="error" color="error" variant="soft" :title="error" />
      <UFormField label="New password" hint="At least 8 characters">
        <UInput v-model="password" type="password" autocomplete="new-password" required class="w-full" />
      </UFormField>
      <UFormField label="Confirm password">
        <UInput v-model="confirm" type="password" autocomplete="new-password" required class="w-full" />
      </UFormField>
      <UButton type="submit" color="primary" block :loading="loading" label="Update password" />
    </form>
  </div>
</template>
