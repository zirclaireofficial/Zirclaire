<script setup lang="ts">
// Request a password reset — emails a link that returns to /reset.
import { useAuth } from '~/features/auth/application/useAuth'
definePageMeta({ layout: 'auth' })

const { requestPasswordReset } = useAuth()
const email = ref('')
const sent = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (!email.value) { error.value = 'Enter your email.'; return }
  loading.value = true
  try {
    await requestPasswordReset(email.value)
    sent.value = true
  } catch (e) {
    error.value = (e as { message?: string })?.message ?? 'Could not send the reset email.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="font-serif text-xl">Reset your password</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">We'll email you a link to set a new one.</p>
    </div>

    <div v-if="sent" class="space-y-3 text-center">
      <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-mail-check" class="size-6 text-success" />
      </div>
      <p class="text-sm text-stone-600 dark:text-stone-300">
        If an account exists for <span class="font-medium">{{ email }}</span>, a reset link is on its way. Check your inbox.
      </p>
      <UButton to="/login" color="neutral" variant="soft" block label="Back to sign in" />
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <UAlert v-if="error" color="error" variant="soft" :title="error" />
      <UFormField label="Email">
        <UInput v-model="email" type="email" placeholder="name@company.com" autocomplete="email" required class="w-full" />
      </UFormField>
      <UButton type="submit" color="primary" block :loading="loading" label="Send reset link" />
      <p class="text-center text-sm text-stone-500 dark:text-stone-400">
        <NuxtLink to="/login" class="font-medium text-primary">Back to sign in</NuxtLink>
      </p>
    </form>
  </div>
</template>
