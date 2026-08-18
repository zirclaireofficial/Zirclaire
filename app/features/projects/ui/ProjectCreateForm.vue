<script setup lang="ts">
import { useProjectActions } from '~/features/projects/application/useProjectActions'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import type { Database } from '~/shared/types/database'

const { createProject } = useProjectActions()
const { upload } = useMediaUpload()
const supabase = useSupabaseClient<Database>()
const toast = useToast()

const form = reactive({
  title: '',
  description: '',
  budgetUsd: null as number | null,
  hours: null as number | null,
  minutes: null as number | null,
})
const requirements = ref<string[]>([''])
const categoryId = ref<number | null>(null)
const subcategoryId = ref<number | null>(null)
const attachment = ref<File | null>(null)
const loading = ref(false)

// After submission the project awaits admin approval (approve-before-pay).
// The requester pays only once it's approved (they're notified).
const submitted = ref(false)

const categories = ref<{ label: string; value: number }[]>([])
const allSubs = ref<{ id: number; name: string; category_id: number }[]>([])
const subOptions = computed(() =>
  allSubs.value.filter((s) => s.category_id === categoryId.value).map((s) => ({ label: s.name, value: s.id })),
)

onMounted(async () => {
  const [{ data: cats }, { data: subs }] = await Promise.all([
    supabase.from('categories').select('id, name').order('position'),
    supabase.from('subcategories').select('id, name, category_id').order('position'),
  ])
  categories.value = (cats ?? []).map((c) => ({ label: c.name, value: c.id }))
  allSubs.value = subs ?? []
})
watch(categoryId, () => { subcategoryId.value = null })

function addRequirement() { if (requirements.value.length < 6) requirements.value.push('') }
function removeRequirement(i: number) { requirements.value.splice(i, 1) }
function onAttach(e: Event) { attachment.value = (e.target as HTMLInputElement).files?.[0] ?? null }

async function submit() {
  if (!form.title.trim()) return toast.add({ title: 'Add a project title', color: 'error' })
  if (!form.budgetUsd || form.budgetUsd <= 0) return toast.add({ title: 'Add a valid budget', color: 'error' })
  loading.value = true
  try {
    const timelineMinutes = (form.hours ?? 0) * 60 + (form.minutes ?? 0)
    let attachments: { media_url: string; media_type?: string }[] = []
    if (attachment.value) {
      const up = await upload(attachment.value, 'project-attachment')
      attachments = [{ media_url: up.publicId, media_type: 'pdf' }]
    }
    await createProject({
      title: form.title.trim(),
      description: form.description.trim() || null,
      subcategory_id: subcategoryId.value,
      requirements: requirements.value.map((r) => r.trim()).filter(Boolean),
      budget_usd: form.budgetUsd,
      timeline_minutes: timelineMinutes > 0 ? timelineMinutes : null,
      attachments,
    })
    submitted.value = true // → awaits admin approval, then payment
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not create project', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- 2. Submitted — awaiting admin approval -->
  <div v-if="submitted" class="space-y-3 py-14 text-center">
    <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
      <UIcon name="i-lucide-check" class="size-6 text-success" />
    </div>
    <h2 class="text-lg font-semibold tracking-tight">Submitted for approval</h2>
    <p class="text-sm text-stone-500 dark:text-stone-400">
      An admin will review your project. Once it's approved you'll get a notification to pay — then it goes live for providers.
    </p>
    <UButton to="/projects" color="neutral" variant="soft" label="View my projects" class="mt-1" />
  </div>

  <!-- 1. The form -->
  <form v-else class="space-y-5" @submit.prevent="submit">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">New project</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Describe the work you need done.</p>
    </div>

    <UFormField label="Project name">
      <UInput v-model="form.title" placeholder="e.g. Brand logo design" required class="w-full" />
    </UFormField>

    <UFormField label="Description">
      <UTextarea v-model="form.description" :rows="3" placeholder="What needs to be done?" class="w-full" />
    </UFormField>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Category">
        <USelect v-model="categoryId" :items="categories" placeholder="Select" class="w-full" />
      </UFormField>
      <UFormField label="Subcategory">
        <USelect v-model="subcategoryId" :items="subOptions" :disabled="!categoryId" placeholder="Select" class="w-full" />
      </UFormField>
    </div>

    <UFormField label="Budget (USD)">
      <UInput v-model.number="form.budgetUsd" type="number" min="1" placeholder="500" required class="w-full" />
    </UFormField>

    <UFormField label="Timeline" hint="How long providers have once it's live">
      <div class="flex items-center gap-2">
        <UInput v-model.number="form.hours" type="number" min="0" placeholder="0" class="w-full" />
        <span class="text-sm text-stone-500">hrs</span>
        <UInput v-model.number="form.minutes" type="number" min="0" max="59" placeholder="0" class="w-full" />
        <span class="text-sm text-stone-500">min</span>
      </div>
    </UFormField>

    <UFormField label="Requirements">
      <div class="space-y-2">
        <div v-for="(_, i) in requirements" :key="i" class="flex items-center gap-2">
          <UInput v-model="requirements[i]" :placeholder="`Requirement ${i + 1}`" class="w-full" />
          <UButton v-if="requirements.length > 1" icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Remove" @click="removeRequirement(i)" />
        </div>
        <UButton v-if="requirements.length < 6" icon="i-lucide-plus" color="neutral" variant="soft" size="xs" label="Add requirement" @click="addRequirement" />
      </div>
    </UFormField>

    <UFormField label="Example attachment (optional)" hint="PDF">
      <input
        type="file"
        accept="application/pdf,image/*"
        class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800"
        @change="onAttach"
      >
    </UFormField>

    <UButton type="submit" color="primary" block size="lg" :loading="loading" label="Submit for approval" class="zc-tap" />
  </form>
</template>
