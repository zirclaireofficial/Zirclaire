<script setup lang="ts">
import { useAuth } from '~/features/auth/application/useAuth'

const { signIn } = useAuth()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    await navigateTo('/')
  } catch (e: unknown) {
    error.value = (e as { message?: string })?.message ?? 'Could not sign in'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <UAlert v-if="error" color="error" variant="soft" :title="error" />
    <UFormField label="Email">
      <UInput v-model="email" type="email" placeholder="name@company.com" autocomplete="email" required class="w-full" />
    </UFormField>
    <UFormField label="Password">
      <UInput v-model="password" type="password" autocomplete="current-password" required class="w-full" />
    </UFormField>
    <UButton type="submit" color="primary" block :loading="loading" label="Sign in" />
  </form>
</template>
