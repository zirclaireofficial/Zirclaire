<script setup lang="ts">
import { useProjects } from '~/features/projects/application/useProjects'
import type { Database, Project } from '~/shared/types/database'

const { browseFeed, apply } = useProjects()
const supabase = useSupabaseClient<Database>()
const toast = useToast()

const projects = ref<Project[]>([])
const loading = ref(true)
const search = ref('')
const categoryFilter = ref<number | null>(null)
const applyingId = ref<string | null>(null)
const appliedIds = ref<Set<string>>(new Set())
const selected = ref<Project | null>(null)

const categories = ref<{ label: string; value: number }[]>([])
const subMap = ref<Record<number, { name: string; category_id: number }>>({})
const catMap = ref<Record<number, string>>({})

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval>

onMounted(async () => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
  const [{ data: cats }, { data: subs }, { data: apps }] = await Promise.all([
    supabase.from('categories').select('id, name').order('position'),
    supabase.from('subcategories').select('id, name, category_id'),
    supabase.from('applications').select('project_id'),
  ])
  categories.value = (cats ?? []).map((c) => ({ label: c.name, value: c.id }))
  for (const c of cats ?? []) catMap.value[c.id] = c.name
  for (const s of subs ?? []) subMap.value[s.id] = { name: s.name, category_id: s.category_id }
  appliedIds.value = new Set((apps ?? []).map((a) => a.project_id))
  await load()
})
onBeforeUnmount(() => clearInterval(timer))

async function load() {
  loading.value = true
  try {
    projects.value = await browseFeed()
  } catch {
    toast.add({ title: 'Could not load projects', color: 'error' })
  } finally {
    loading.value = false
  }
}

function subName(p: Project) {
  return p.subcategory_id ? subMap.value[p.subcategory_id]?.name : null
}

const filtered = computed(() =>
  projects.value.filter((p) => {
    if (search.value && !p.title.toLowerCase().includes(search.value.toLowerCase())) return false
    if (categoryFilter.value) {
      const s = p.subcategory_id ? subMap.value[p.subcategory_id] : null
      if (!s || s.category_id !== categoryFilter.value) return false
    }
    return true
  }),
)

function countdown(p: Project) {
  if (!p.deadline_at) return null
  const ms = new Date(p.deadline_at).getTime() - now.value
  if (ms <= 0) return 'ended'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`
}
function urgent(p: Project) {
  return p.deadline_at ? new Date(p.deadline_at).getTime() - now.value < 3_600_000 : false
}

async function doApply(p: Project) {
  applyingId.value = p.id
  try {
    await apply(p.id)
    appliedIds.value = new Set([...appliedIds.value, p.id])
    toast.add({ title: 'Applied', description: 'The requester will review your application.', color: 'success' })
    selected.value = null
  } catch (e) {
    toast.add({ title: 'Could not apply', description: (e as { message?: string })?.message, color: 'error' })
  } finally {
    applyingId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="zc-title font-serif text-2xl leading-tight">Find work</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Live projects open for applications.</p>
    </div>

    <div class="flex gap-2">
      <UInput v-model="search" icon="i-lucide-search" placeholder="Search projects" class="flex-1" />
      <USelect v-model="categoryFilter" :items="[{ label: 'All', value: null }, ...categories]" class="w-36" />
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="zc-card h-28 animate-pulse" />
    </div>

    <div
      v-else-if="!filtered.length"
      class="zc-textured flex flex-col items-center gap-2 rounded-2xl border border-stone-200 py-16 text-center dark:border-stone-800"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
        <UIcon name="i-lucide-inbox" class="size-6 text-primary" />
      </div>
      <p class="font-medium">No live projects right now</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">New work lands here — check back soon.</p>
    </div>

    <div v-else class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="p in filtered"
        :key="p.id"
        class="zc-card zc-card-hover zc-tap flex cursor-pointer flex-col p-4"
        @click="selected = p"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <UBadge v-if="subName(p)" color="neutral" variant="soft" size="sm" class="mb-1.5">{{ subName(p) }}</UBadge>
            <h2 class="truncate font-serif text-lg leading-tight">{{ p.title }}</h2>
          </div>
          <div v-if="countdown(p)" class="shrink-0 text-right">
            <div class="flex items-center justify-end gap-1 text-[11px] text-stone-400">
              <UIcon name="i-lucide-clock" class="size-3" /> ends in
            </div>
            <div class="text-sm font-medium" :class="urgent(p) ? 'text-primary' : 'text-stone-700 dark:text-stone-200'">
              {{ countdown(p) }}
            </div>
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
          <div>
            <div class="text-[11px] text-stone-400">Budget</div>
            <div class="font-medium">${{ p.budget_usd }}</div>
          </div>
          <UButton
            v-if="appliedIds.has(p.id)"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-check"
            label="Applied"
            disabled
          />
          <UButton
            v-else
            color="primary"
            size="sm"
            label="Apply"
            class="zc-tap"
            :loading="applyingId === p.id"
            @click.stop="doApply(p)"
          />
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="selected"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
        @click.self="selected = null"
      >
        <div class="max-h-[85vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-5 dark:bg-stone-900 sm:rounded-2xl">
          <div class="flex items-start justify-between gap-2">
            <div>
              <UBadge v-if="subName(selected)" color="neutral" variant="soft" size="sm" class="mb-1.5">{{ subName(selected) }}</UBadge>
              <h2 class="font-serif text-xl leading-tight">{{ selected.title }}</h2>
            </div>
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" aria-label="Close" @click="selected = null" />
          </div>

          <p v-if="selected.description" class="mt-3 text-[15px] leading-relaxed text-stone-700 dark:text-stone-200">
            {{ selected.description }}
          </p>

          <div v-if="selected.requirements?.length" class="mt-4">
            <p class="mb-1 text-[11px] uppercase tracking-wide text-stone-400">Requirements</p>
            <ul class="space-y-1">
              <li v-for="(r, i) in selected.requirements" :key="i" class="flex gap-2 text-sm">
                <UIcon name="i-lucide-dot" class="mt-0.5 size-4 shrink-0 text-primary" />{{ r }}
              </li>
            </ul>
          </div>

          <div class="mt-4 flex items-center justify-between border-t border-stone-100 pt-4 dark:border-stone-800">
            <div>
              <div class="text-[11px] text-stone-400">Budget</div>
              <div class="text-lg font-medium">${{ selected.budget_usd }}</div>
            </div>
            <div v-if="countdown(selected)" class="text-right">
              <div class="text-[11px] text-stone-400">Time left</div>
              <div class="font-medium" :class="urgent(selected) ? 'text-primary' : ''">{{ countdown(selected) }}</div>
            </div>
          </div>

          <UButton
            v-if="appliedIds.has(selected.id)"
            color="neutral"
            variant="soft"
            block
            size="lg"
            icon="i-lucide-check"
            label="Applied"
            disabled
            class="mt-4"
          />
          <UButton
            v-else
            color="primary"
            block
            size="lg"
            label="Apply for this project"
            class="zc-tap mt-4"
            :loading="applyingId === selected.id"
            @click="doApply(selected)"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
