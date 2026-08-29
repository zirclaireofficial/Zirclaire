<script setup lang="ts">
// List a COMPLETED project's deliverable for resale (Terms §16A). Requesters
// only — the seller is the owner of the finished work. The downloadable file
// is the project's deliverable (pulled server-side); the seller only sets a
// price, a category, and an optional cover. Created 'pending' for admin review.

import { useRoyalties } from '~/features/royalties/application/useRoyalties'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import { WORK_TYPES, royaltyCommission, creatorPayout, isPublishable } from '~/features/royalties/domain'
import type { WorkType, EligibleProject } from '~/features/royalties/domain'

const { publish, eligibleProjects } = useRoyalties()
const { upload } = useMediaUpload()
const toast = useToast()

const projects = ref<EligibleProject[]>([])
const loadingProjects = ref(true)

const form = reactive({
  project_id: '' as string,
  work_type: 'research' as WorkType,
  title: '',
  description: '',
  price: null as number | null,
})
const cover = ref<File | null>(null)
const coverPreview = ref<string | null>(null)
const consent = ref(false)
const submitting = ref(false)

const projectItems = computed(() =>
  projects.value.map((p) => ({ label: p.title, value: p.id })),
)

const canSubmit = computed(() =>
  consent.value && isPublishable({ title: form.title, price: form.price, hasProject: !!form.project_id }),
)
const payoutPreview = computed(() => (form.price ? creatorPayout(form.price) : 0))
const commissionPreview = computed(() => (form.price ? royaltyCommission(form.price) : 0))

// Prefill the title from the chosen project (editable).
watch(() => form.project_id, (id) => {
  const p = projects.value.find((x) => x.id === id)
  if (p && !form.title.trim()) form.title = p.title
})

onMounted(async () => {
  try {
    projects.value = await eligibleProjects()
  } catch (e) {
    toast.add({ title: 'Could not load your projects', description: (e as { message?: string })?.message, color: 'error' })
  } finally {
    loadingProjects.value = false
  }
})

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
    if (cover.value) {
      const c = await upload(cover.value, 'royalty-cover')
      coverId = c.publicId
    }
    await publish({
      project_id: form.project_id,
      work_type: form.work_type,
      title: form.title,
      description: form.description || null,
      price_myr: form.price!,
      cover_image: coverId,
      consent: consent.value,
    })
    toast.add({
      title: 'Submitted for review',
      description: 'Your work goes live once an admin approves it.',
      color: 'success',
    })
    navigateTo('/royalties')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not list it', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">Sell a completed work</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        List the deliverable from one of your completed projects. Buyers pay once and download it.
      </p>
    </div>

    <div v-if="loadingProjects" class="zc-card h-16 animate-pulse" />

    <div
      v-else-if="!projects.length"
      class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-14 text-center dark:border-stone-800"
    >
      <UIcon name="i-lucide-folder-check" class="size-8 text-stone-300 dark:text-stone-600" />
      <p class="font-medium">No completed projects yet</p>
      <p class="max-w-xs text-sm text-stone-500 dark:text-stone-400">
        Once a project is finished and closed, you can list its deliverable for resale here.
      </p>
      <UButton to="/royalties" color="neutral" variant="soft" size="sm" label="Back to the store" class="mt-1" />
    </div>

    <template v-else>
      <UFormField label="Which completed project?">
        <USelect v-model="form.project_id" :items="projectItems" placeholder="Choose a project" class="w-full" />
      </UFormField>

      <UFormField label="Category">
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

      <UFormField label="Price (MYR)">
        <UInput v-model.number="form.price" type="number" min="1" step="0.01" placeholder="20" class="w-full" />
      </UFormField>

      <div v-if="form.price" class="rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800/40">
        <div class="flex items-center justify-between text-stone-500 dark:text-stone-400">
          <span>Platform fee (85%)</span><span class="tabular-nums">−RM {{ commissionPreview }}</span>
        </div>
        <div class="mt-1 flex items-center justify-between font-medium">
          <span>You receive per sale</span><span class="tabular-nums text-success">RM {{ payoutPreview }}</span>
        </div>
      </div>

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

      <label class="flex items-start gap-3 rounded-xl border border-stone-200 p-3 text-sm dark:border-stone-800">
        <UCheckbox v-model="consent" class="mt-0.5" />
        <span class="text-stone-600 dark:text-stone-300">
          I confirm I own this completed work and have the right to resell it. I consent to Zirclaire
          listing it for resale, and I understand the platform retains 85% of each sale as commission
          (Terms §16A).
        </span>
      </label>

      <UButton
        color="primary"
        block
        size="lg"
        class="zc-tap"
        :loading="submitting"
        :disabled="!canSubmit"
        :label="submitting ? 'Listing…' : 'List for review'"
        @click="submit"
      />
      <p class="text-center text-xs text-stone-400">An admin reviews it before it appears in the store.</p>
    </template>
  </div>
</template>
