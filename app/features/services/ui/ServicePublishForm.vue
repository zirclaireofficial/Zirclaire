<script setup lang="ts">
// Offer a service. Providers only. Title + description + up to 3 tiers, each
// with a provider-chosen name, price, description and optional delivery time.
// Submits as 'pending'; an admin approves before it's public.

import { useServices } from '~/features/services/application/useServices'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import type { Database } from '~/shared/types/database'
import { isTierComplete, isServicePublishable } from '~/features/services/domain'
import type { TierDraft } from '~/features/services/domain'

const { publish } = useServices()
const { upload } = useMediaUpload()
const supabase = useSupabaseClient<Database>()
const toast = useToast()

const title = ref('')
const description = ref('')
const subcategoryId = ref<number | null>(null)
const cover = ref<File | null>(null)
const coverPreview = ref<string | null>(null)
const submitting = ref(false)

// Exactly three tiers — low, middle, high — always. Provider renames and
// prices each; the labels here are just a starting point.
const tiers = reactive<(TierDraft & { deliveryDays: number | null })[]>([
  { name: 'Standard', price: null, description: '', delivery_minutes: null, deliveryDays: null },
  { name: 'Advanced', price: null, description: '', delivery_minutes: null, deliveryDays: null },
  { name: 'Premium', price: null, description: '', delivery_minutes: null, deliveryDays: null },
])

const categories = ref<{ label: string; value: number }[]>([])
const allSubs = ref<{ id: number; name: string; category_id: number }[]>([])
const categoryId = ref<number | null>(null)
const subOptions = computed(() =>
  allSubs.value.filter((s) => s.category_id === categoryId.value).map((s) => ({ label: s.name, value: s.id })),
)

onMounted(async () => {
  const [{ data: cats }, { data: subs }] = await Promise.all([
    supabase.from('categories').select('id, name').order('position'),
    supabase.from('subcategories').select('id, name, category_id').order('position'),
  ])
  categories.value = (cats ?? []).map((c) => ({ label: c.name, value: c.id }))
  allSubs.value = (subs ?? []) as typeof allSubs.value
})
watch(categoryId, () => { subcategoryId.value = null })

const canSubmit = computed(() => isServicePublishable(title.value, tiers))

function onCover(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  cover.value = f
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverPreview.value = f ? URL.createObjectURL(f) : null
}
onBeforeUnmount(() => { if (coverPreview.value) URL.revokeObjectURL(coverPreview.value) })

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    let coverId: string | null = null
    if (cover.value) coverId = (await upload(cover.value, 'royalty-cover')).publicId

    await publish({
      title: title.value,
      description: description.value || null,
      subcategory_id: subcategoryId.value,
      cover_image: coverId,
      tiers: tiers.filter(isTierComplete).map((t) => ({
        name: t.name,
        price_myr: t.price!,
        description: t.description || null,
        delivery_minutes: t.deliveryDays ? t.deliveryDays * 1440 : null,
      })),
    })
    toast.add({ title: 'Submitted for review', description: 'Your service goes live once an admin approves it.', color: 'success' })
    navigateTo('/services')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not publish', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">New MyService</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Name the service, then set your three pricing levels. You decide what each includes.
      </p>
    </div>

    <UFormField label="Service name">
      <UInput v-model="title" placeholder="e.g. Logo Design" class="w-full" />
    </UFormField>

    <UFormField label="Description">
      <UTextarea v-model="description" :rows="4" placeholder="Describe what this service covers" class="w-full" />
    </UFormField>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Category">
        <USelect v-model="categoryId" :items="categories" placeholder="Select" class="w-full" />
      </UFormField>
      <UFormField label="Subcategory">
        <USelect v-model="subcategoryId" :items="subOptions" :disabled="!categoryId" placeholder="Select" class="w-full" />
      </UFormField>
    </div>

    <!-- Three tiers, always. Provider names, prices and describes each. -->
    <div class="space-y-3">
      <p class="text-sm font-medium">Pricing levels</p>
      <p class="-mt-1 text-xs text-stone-500 dark:text-stone-400">
        All three are required — a lower, middle and higher option.
      </p>

      <div v-for="(t, i) in tiers" :key="i" class="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
        <span class="mb-2 block text-xs font-medium uppercase tracking-wide text-stone-400">Level {{ i + 1 }}</span>
        <div class="grid grid-cols-2 gap-2">
          <UInput v-model="t.name" placeholder="Level name" class="w-full" />
          <UInput v-model.number="t.price" type="number" min="1" step="0.01" placeholder="Price MYR" class="w-full" />
        </div>
        <UTextarea v-model="t.description" :rows="2" placeholder="What this level includes" class="mt-2 w-full" />
        <div class="mt-2 flex items-center gap-2">
          <UInput v-model.number="t.deliveryDays" type="number" min="1" placeholder="Delivery" class="w-32" />
          <span class="text-sm text-stone-500">days (optional)</span>
        </div>
      </div>
    </div>

    <UFormField label="Cover image (optional)">
      <div class="flex items-center gap-3">
        <img v-if="coverPreview" :src="coverPreview" alt="" class="size-16 rounded-lg object-cover" >
        <input type="file" accept="image/*" class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800" @change="onCover" >
      </div>
    </UFormField>

    <UButton color="primary" block size="lg" class="zc-tap" :loading="submitting" :disabled="!canSubmit" :label="submitting ? 'Publishing…' : 'Submit for review'" @click="submit" />
    <p class="text-center text-xs text-stone-400">An admin reviews it before it appears in the store.</p>
  </div>
</template>
