<script setup lang="ts">
// Password reset by email code (no link):
//  Step 1 — enter email, we email a one-time code.
//  Step 2 — enter the code + a new password; we verify the code and set it.
// Reuses the same OTP email as signup, so no separate template is needed.
import { useAuth } from '~/features/auth/application/useAuth'
definePageMeta({ layout: 'auth' })

const { sendResetOtp, verifyEmailOtp, setPassword } = useAuth()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const password = ref('')
const confirm = ref('')
const done = ref(false)
const loading = ref(false)
const error = ref('')

// Step 1 — email the code.
async function sendCode() {
  error.value = ''
  if (!email.value.trim()) { error.value = 'Enter your email.'; return }
  loading.value = true
  try {
    await sendResetOtp(email.value.trim())
    step.value = 'code'
  } catch (e) {
    error.value = (e as { message?: string })?.message ?? 'Could not send the code.'
  } finally {
    loading.value = false
  }
}

// Step 2 — verify the code, then set the new password.
async function resetPassword() {
  error.value = ''
  if (!code.value.trim()) { error.value = 'Enter the code from your email.'; return }
  if (password.value.length < 8) { error.value = 'Use at least 8 characters.'; return }
  if (password.value !== confirm.value) { error.value = 'Passwords do not match.'; return }
  loading.value = true
  try {
    await verifyEmailOtp(email.value.trim(), code.value.trim())
    await setPassword(password.value)
    done.value = true
  } catch (e) {
    error.value = (e as { message?: string })?.message ?? 'Invalid or expired code.'
  } finally {
    loading.value = false
  }
}

async function resend() {
  loading.value = true
  try { await sendResetOtp(email.value.trim()) } catch { /* ignore */ } finally { loading.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="font-serif text-xl">Reset your password</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {{ step === 'email' ? "We'll email you a code to confirm it's you." : 'Enter the code and choose a new password.' }}
      </p>
    </div>

    <!-- Success -->
    <div v-if="done" class="space-y-3 text-center">
      <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-check" class="size-6 text-success" />
      </div>
      <p class="text-sm text-stone-600 dark:text-stone-300">Your password has been updated.</p>
      <UButton to="/login" color="primary" block label="Sign in" />
    </div>

    <!-- Step 1 — email -->
    <form v-else-if="step === 'email'" class="space-y-4" @submit.prevent="sendCode">
      <UAlert v-if="error" color="error" variant="soft" :title="error" />
      <UFormField label="Email">
        <UInput v-model="email" type="email" placeholder="name@company.com" autocomplete="email" required class="w-full" />
      </UFormField>
      <UButton type="submit" color="primary" block :loading="loading" label="Send code" />
      <p class="text-center text-sm text-stone-500 dark:text-stone-400">
        <NuxtLink to="/login" class="font-medium text-primary">Back to sign in</NuxtLink>
      </p>
    </form>

    <!-- Step 2 — code + new password -->
    <form v-else class="space-y-4" @submit.prevent="resetPassword">
      <UAlert v-if="error" color="error" variant="soft" :title="error" />
      <p class="text-sm text-stone-500 dark:text-stone-400">
        We sent a code to <span class="font-medium">{{ email }}</span>.
      </p>
      <UFormField label="Verification code">
        <UInput v-model="code" inputmode="numeric" placeholder="6-digit code" required class="w-full" />
      </UFormField>
      <UFormField label="New password" hint="At least 8 characters">
        <UInput v-model="password" type="password" autocomplete="new-password" required class="w-full" />
      </UFormField>
      <UFormField label="Confirm password">
        <UInput v-model="confirm" type="password" autocomplete="new-password" required class="w-full" />
      </UFormField>
      <UButton type="submit" color="primary" block :loading="loading" label="Reset password" />
      <div class="flex items-center justify-between text-sm">
        <button type="button" class="text-stone-500 dark:text-stone-400" @click="step = 'email'; error = ''">
          Use a different email
        </button>
        <button type="button" class="font-medium text-primary" :disabled="loading" @click="resend">
          Resend code
        </button>
      </div>
    </form>
  </div>
</template>
