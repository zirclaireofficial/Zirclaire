<script setup lang="ts">
import { useAuth } from '~/features/auth/application/useAuth'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import { authedFetch } from '~/shared/lib/authedFetch'
import type { Database } from '~/shared/types/database'

const { sendEmailOtp, verifyEmailOtp, setPassword } = useAuth()
const { upload } = useMediaUpload()
const supabase = useSupabaseClient<Database>()

// Email verification happens as part of submitting: fill the form, hit Submit,
// then confirm the emailed code. `awaitingCode` shows the code step.
const awaitingCode = ref(false)
const otpCode = ref('')
const otpBusy = ref(false)

const role = ref<'service_requester' | 'service_provider' | null>(null)
const done = ref(false)
const error = ref('')
const loading = ref(false)

// Rules & Regulations — loaded from the static file and shown in a scroll box.
// The user must accept before signing up.
const rulesText = ref('')
const accepted = ref(false)

const form = reactive({
  full_name: '',
  email: '',
  password: '',
  phone: '',
  home_address: '',
  id_document_number: '',
  country_id: null as number | null,
  payout_provider: 'touch_n_go' as 'touch_n_go' | 'binance',
  payout_account: '',
})
const idFile = ref<File | null>(null)
const picFile = ref<File | null>(null)

const countries = ref<{ label: string; value: number }[]>([])
onMounted(async () => {
  const { data } = await supabase.from('countries').select('id, name').eq('is_active', true)
  countries.value = (data ?? []).map((c) => ({ label: c.name, value: c.id }))
  if (countries.value.length) form.country_id = countries.value[0]!.value
  try {
    rulesText.value = await $fetch<string>('/rules.txt', { responseType: 'text' })
  } catch {
    rulesText.value = 'Rules and Regulations could not be loaded. Please try again.'
  }
})

const providerItems = [
  { label: "Touch 'n Go", value: 'touch_n_go' },
  { label: 'Binance', value: 'binance' },
]

function onId(e: Event) {
  idFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}
function onPic(e: Event) {
  picFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

// Step 1 — pressing "Submit application": validate everything, make sure the
// email isn't already registered, then email a verification code.
async function submit() {
  error.value = ''
  if (!form.full_name.trim()) { error.value = 'Enter your full name.'; return }
  if (!form.email.trim()) { error.value = 'Enter your email.'; return }
  if (!form.password || form.password.length < 8) {
    error.value = 'Choose a password of at least 8 characters.'
    return
  }
  if (!idFile.value || !picFile.value) {
    error.value = 'Please upload your ID document and a profile picture.'
    return
  }
  if (!accepted.value) {
    error.value = 'Please read and accept the Rules and Regulations to continue.'
    return
  }
  loading.value = true
  try {
    // Block a second account on the same email.
    const { exists } = await $fetch<{ exists: boolean }>('/api/kyc/check-email', {
      method: 'POST',
      body: { email: form.email.trim() },
    })
    if (exists) {
      error.value = 'An account with this email already exists. Please sign in or reset your password.'
      return
    }
    await sendEmailOtp(form.email.trim())
    awaitingCode.value = true
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    error.value = err?.data?.statusMessage ?? err?.message ?? 'Could not start verification.'
  } finally {
    loading.value = false
  }
}

// Step 2 — confirm the emailed code, then actually create the account.
async function finalize() {
  error.value = ''
  if (!otpCode.value.trim()) { error.value = 'Enter the code from your email.'; return }
  otpBusy.value = true
  try {
    await verifyEmailOtp(form.email.trim(), otpCode.value.trim())
    await setPassword(form.password)
    const [idUp, picUp] = await Promise.all([
      upload(idFile.value!, 'kyc'),
      upload(picFile.value!, 'profile'),
    ])
    await authedFetch('/api/kyc/signup', {
      method: 'POST',
      body: {
        role: role.value,
        full_name: form.full_name,
        phone: form.phone,
        home_address: form.home_address,
        id_document_number: form.id_document_number,
        country_id: form.country_id,
        payout_provider: form.payout_provider,
        payout_account: form.payout_account,
        id_document_image: idUp.publicId,
        profile_picture: picUp.publicId,
      },
    })
    awaitingCode.value = false
    done.value = true
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    error.value = err?.data?.statusMessage ?? err?.message ?? 'Invalid or expired code.'
  } finally {
    otpBusy.value = false
  }
}

async function resendCode() {
  otpBusy.value = true
  try { await sendEmailOtp(form.email.trim()) } catch { /* ignore */ } finally { otpBusy.value = false }
}
</script>

<template>
  <div v-if="done" class="space-y-3 text-center">
    <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
      <UIcon name="i-lucide-clock" class="size-6 text-success" />
    </div>
    <h2 class="font-serif text-lg">Application submitted</h2>
    <p class="text-sm text-stone-500 dark:text-stone-400">
      Your account is pending review. You'll get an email once an admin approves it, along with your Zirclaire ID.
    </p>
    <UButton to="/" color="neutral" variant="soft" label="Back to feed" block />
  </div>

  <div v-else-if="!role" class="space-y-4">
    <div>
      <h2 class="font-serif text-lg">Join as</h2>
      <p class="text-sm text-stone-500 dark:text-stone-400">Choose the account that fits you.</p>
    </div>
    <button
      class="flex w-full items-start gap-3 rounded-xl border border-stone-200 p-4 text-left transition hover:border-primary dark:border-stone-800"
      @click="role = 'service_requester'"
    >
      <UIcon name="i-lucide-clipboard-list" class="mt-0.5 size-5 text-primary" />
      <span>
        <span class="block font-medium">Service Requester</span>
        <span class="block text-sm text-stone-500 dark:text-stone-400">Post projects and hire providers.</span>
      </span>
    </button>
    <button
      class="flex w-full items-start gap-3 rounded-xl border border-stone-200 p-4 text-left transition hover:border-primary dark:border-stone-800"
      @click="role = 'service_provider'"
    >
      <UIcon name="i-lucide-briefcase" class="mt-0.5 size-5 text-primary" />
      <span>
        <span class="block font-medium">Service Provider</span>
        <span class="block text-sm text-stone-500 dark:text-stone-400">Find work and build your reputation.</span>
      </span>
    </button>
  </div>

  <form v-else class="space-y-4" @submit.prevent="submit">
    <button type="button" class="flex items-center gap-1 text-sm text-stone-500" @click="role = null">
      <UIcon name="i-lucide-arrow-left" class="size-4" /> Change account type
    </button>

    <UAlert v-if="error" color="error" variant="soft" :title="error" />

    <UFormField label="Full name (as per national ID)">
      <UInput v-model="form.full_name" required class="w-full" />
    </UFormField>
    <UFormField label="Email" hint="We'll email a code to verify it when you submit">
      <UInput v-model="form.email" type="email" placeholder="name@company.com" autocomplete="email" required class="w-full" />
    </UFormField>

    <UFormField label="Password" hint="At least 8 characters">
      <UInput v-model="form.password" type="password" autocomplete="new-password" required class="w-full" />
    </UFormField>
    <UFormField label="Phone (with country code)">
      <UInput v-model="form.phone" placeholder="+60…" class="w-full" />
    </UFormField>
    <UFormField label="Home address">
      <UInput v-model="form.home_address" class="w-full" />
    </UFormField>
    <UFormField label="ID / passport number">
      <UInput v-model="form.id_document_number" class="w-full" />
    </UFormField>
    <UFormField label="Country">
      <USelect v-model="form.country_id" :items="countries" class="w-full" />
    </UFormField>
    <UFormField label="Payout method">
      <USelect v-model="form.payout_provider" :items="providerItems" class="w-full" />
    </UFormField>
    <UFormField label="Payout account number">
      <UInput v-model="form.payout_account" class="w-full" />
    </UFormField>

    <UFormField label="ID / passport image">
      <input type="file" accept="image/*" required class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800" @change="onId" >
    </UFormField>
    <UFormField label="Profile picture">
      <input type="file" accept="image/*" required class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800" @change="onPic" >
    </UFormField>

    <!-- Rules & Regulations — scrollable, must be accepted before signup -->
    <div>
      <p class="mb-1.5 text-sm font-medium">Rules and Regulations</p>
      <div
        class="h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-600 dark:border-stone-800 dark:bg-stone-800/40 dark:text-stone-300"
      >{{ rulesText || 'Loading…' }}</div>
      <label class="zc-tap mt-2 flex cursor-pointer items-start gap-2 text-sm">
        <input v-model="accepted" type="checkbox" class="mt-0.5 size-4 accent-primary" >
        <span>I have read and accept the Rules and Regulations.</span>
      </label>
    </div>

    <UButton type="submit" color="primary" block :loading="loading" :disabled="!accepted" label="Submit application" />
  </form>

  <!-- Verify email code — appears after pressing Submit -->
  <Teleport to="body">
    <div
      v-if="awaitingCode"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      @click.self="awaitingCode = false"
    >
      <div class="w-full max-w-sm rounded-t-2xl bg-white p-5 dark:bg-stone-900 sm:rounded-2xl">
        <div class="mb-3 flex items-start gap-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UIcon name="i-lucide-mail" class="size-4 text-primary" />
          </div>
          <div>
            <h2 class="font-medium leading-tight">Verify your email</h2>
            <p class="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Enter the code we sent to <span class="font-medium">{{ form.email }}</span> to finish.
            </p>
          </div>
        </div>

        <UAlert v-if="error" color="error" variant="soft" :title="error" class="mb-3" />

        <UInput v-model="otpCode" inputmode="numeric" placeholder="6-digit code" class="w-full" @keydown.enter.prevent="finalize" />

        <div class="mt-3 flex gap-2">
          <UButton color="primary" class="zc-tap flex-1" :loading="otpBusy" label="Verify & submit" @click="finalize" />
          <UButton color="neutral" variant="ghost" label="Cancel" @click="awaitingCode = false" />
        </div>
        <button type="button" class="zc-tap mt-2 text-xs text-primary" :disabled="otpBusy" @click="resendCode">
          Resend code
        </button>
      </div>
    </div>
  </Teleport>
</template>
