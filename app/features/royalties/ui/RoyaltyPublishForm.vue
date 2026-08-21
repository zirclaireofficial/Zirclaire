<script setup lang="ts">
// Publish a finished work to the store. Providers only. The file is uploaded
// private (signed 'royalty-file'), the cover public. On submit the item is
// created as 'pending' and waits for admin approval before it's public.

import { useRoyalties } from '~/features/royalties/application/useRoyalties'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import { WORK_TYPES, royaltyCommission, creatorPayout, isPublishable } from '~/features/royalties/domain'
import type { WorkType } from '~/features/royalties/domain'

const { publish } = useRoyalties()
const { upload } = useMediaUpload()
const toast = useToast()

const form = reactive({
  work_type: 'novel' as WorkType,
  title: '',
  description: '',
  price: null as number | null,
})
const file = ref<File | null>(null)
const cover = ref<File | null>(null)
const coverPreview = ref<string | null>(null)
const submitting = ref(false)

const canSubmit = computed(() =>
  isPublishable({ title: form.title, price: form.price, hasFile: !!file.value }),
)

const payoutPreview = computed(() => (form.price ? creatorPayout(form.price) : 0))
const commissionPreview = computed(() => (form.price ? royaltyCommission(form.price) : 0))

function onFile(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
}
function onCover(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  cover.value = f
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverPreview.value = f ? URL.createObjectURL(f) : null
}
onBeforeUnmount(() => { if (coverPreview.value) URL.revokeObjectURL(coverPreview.value) })

const fileExt = computed(() => {
  const name = file.value?.name ?? ''
  const m = name.match(/\.(\w+)$/)
  return m ? m[1]!.toLowerCase() : null
})

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const up = await upload(file.value!, 'royalty-file')
    let coverId: string | null = null
    if (cover.value) {
      const c = await upload(cover.value, 'royalty-cover')
      coverId = c.publicId
    }
    await publish({
      work_type: form.work_type,
      title: form.title,
      description: form.description || null,
      price_usd: form.price!,
      file_url: up.publicId,
      file_type: fileExt.value,
      cover_image: coverId,
    })
    toast.add({
      title: 'Submitted for review',
      description: 'Your work goes live once an admin approves it.',
      color: 'success',
    })
    navigateTo('/royalties')
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
      <h1 class="zc-title font-serif text-2xl leading-tight">Publish a work</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        A novel, research or journal. Buyers pay once and download it.
      </p>
    </div>

    <UFormField label="Type">
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="t in WORK_TYPES"
          :key="t.value"
          type="button"
          class="zc-tap rounded-xl border p-3 text-sm font-medium transition"
          :class="form.work_type === t.value ? 'border-primary ring-1 ring-primary text-primary' : 'border-stone-200 dark:border-stone-800'"
          @click="form.work_type = t.value"
        >
          {{ t.label }}
        </button>
      </div>
    </UFormField>

    <UFormField label="Title">
      <UInput v-model="form.title" placeholder="Title of the work" class="w-full" />
    </UFormField>

    <UFormField label="Description">
      <UTextarea v-model="form.description" :rows="4" placeholder="What is it about? What will the buyer get?" class="w-full" />
    </UFormField>

    <UFormField label="Price (USD)">
      <UInput v-model.number="form.price" type="number" min="1" step="0.01" placeholder="20" class="w-full" />
    </UFormField>

    <div v-if="form.price" class="rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800/40">
      <div class="flex items-center justify-between text-stone-500 dark:text-stone-400">
        <span>Platform fee (85%)</span><span class="tabular-nums">−${{ commissionPreview }}</span>
      </div>
      <div class="mt-1 flex items-center justify-between font-medium">
        <span>You receive per sale</span><span class="tabular-nums text-success">${{ payoutPreview }}</span>
      </div>
    </div>

    <UFormField label="File" hint="PDF or EPUB — this is what buyers download">
      <input
        type="file"
        accept="application/pdf,.epub,.doc,.docx"
        class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800"
        @change="onFile"
      >
    </UFormField>

    <UFormField label="Cover image (optional)">
      <div class="flex items-center gap-3">
        <img v-if="coverPreview" :src="coverPreview" alt="" class="size-16 rounded-lg object-cover" >
        <input
          type="file"
          accept="image/*"
          class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800"
          @change="onCover"
        >
      </div>
    </UFormField>

    <UButton
      color="primary"
      block
      size="lg"
      class="zc-tap"
      :loading="submitting"
      :disabled="!canSubmit"
      :label="submitting ? 'Publishing…' : 'Submit for review'"
      @click="submit"
    />
    <p class="text-center text-xs text-stone-400">An admin reviews it before it appears in the store.</p>
  </div>
</template>
