<script setup lang="ts">
import { useAuth } from '~/features/auth/application/useAuth'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import { authedFetch } from '~/shared/lib/authedFetch'
import type { Database } from '~/shared/types/database'

const { signUp } = useAuth()
const { upload } = useMediaUpload()
const supabase = useSupabaseClient<Database>()

const role = ref<'service_requester' | 'service_provider' | null>(null)
const done = ref(false)
const error = ref('')
const loading = ref(false)

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

async function submit() {
  error.value = ''
  if (!idFile.value || !picFile.value) {
    error.value = 'Please upload your ID document and a profile picture.'
    return
  }
  loading.value = true
  try {
    await signUp(form.email, form.password)
    const [idUp, picUp] = await Promise.all([
      upload(idFile.value, 'kyc'),
      upload(picFile.value, 'profile'),
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
    done.value = true
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    error.value = err?.data?.statusMessage ?? err?.message ?? 'Signup failed'
  } finally {
    loading.value = false
  }
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
    <UFormField label="Email">
      <UInput v-model="form.email" type="email" placeholder="name@company.com" autocomplete="email" required class="w-full" />
    </UFormField>
    <UFormField label="Password">
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

    <UButton type="submit" color="primary" block :loading="loading" label="Submit application" />
  </form>
</template>
