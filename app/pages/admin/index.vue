<script setup lang="ts">
import type { Database } from '~/shared/types/database'
definePageMeta({ middleware: 'admin' })

const supabase = useSupabaseClient<Database>()
const loading = ref(true)
const stats = reactive({ pendingKyc: 0, awaitingFunding: 0, openReports: 0, pendingServices: 0, pendingRoyalties: 0, liveProjects: 0, members: 0, closed: 0 })

onMounted(async () => {
  const c = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0)
  const [k, f, r, sv, ro, l, m, cl] = await Promise.all([
    c(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('kyc_status', 'pending')),
    c(supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'submitted')),
    c(supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open')),
    c((supabase as any).from('services').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    c((supabase as any).from('royalty_items').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    c(supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'live')),
    c(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('kyc_status', 'approved')),
    c(supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'closed')),
  ])
  Object.assign(stats, { pendingKyc: k, awaitingFunding: f, openReports: r, pendingServices: sv, pendingRoyalties: ro, liveProjects: l, members: m, closed: cl })
  loading.value = false
})

const metrics = computed(() => [
  { to: '/admin/kyc', label: 'Pending KYC', value: stats.pendingKyc, icon: 'i-lucide-shield-check', action: true },
  { to: '/admin/funding', label: 'Awaiting approval', value: stats.awaitingFunding, icon: 'i-lucide-clipboard-check', action: true },
  { to: '/admin/services', label: 'Service reviews', value: stats.pendingServices, icon: 'i-lucide-briefcase', action: true },
  { to: '/admin/royalties', label: 'Royalty reviews', value: stats.pendingRoyalties, icon: 'i-lucide-book-open-text', action: true },
])
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="zc-eyebrow">Admin console</p>
      <h1 class="zc-title font-serif text-2xl leading-tight">Overview</h1>
    </div>

    <!-- Metrics — 2 across on mobile, 4 across on desktop -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <NuxtLink
        v-for="m in metrics"
        :key="m.label"
        :to="m.to"
        class="zc-tap rounded-xl bg-stone-50 p-4 transition hover:bg-stone-100 dark:bg-stone-800/40 dark:hover:bg-stone-800"
      >
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-stone-500 dark:text-stone-400">{{ m.label }}</span>
          <UIcon :name="m.icon" class="size-4" :class="m.action && m.value > 0 ? 'text-primary' : 'text-stone-400'" />
        </div>
        <div class="mt-1 text-3xl font-medium" :class="m.action && m.value > 0 ? 'text-primary' : ''">
          {{ loading ? '—' : m.value }}
        </div>
      </NuxtLink>
    </div>

    <!-- Body — queues (wide) + summary panel -->
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="space-y-2 lg:col-span-2">
        <p class="zc-eyebrow">Queues</p>

        <NuxtLink to="/admin/kyc" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
          <span class="flex items-center gap-3">
            <UIcon name="i-lucide-shield-check" class="size-5 text-primary" />
            <span>
              <span class="block font-medium">Review KYC</span>
              <span class="block text-xs text-stone-500 dark:text-stone-400">Approve or reject new accounts</span>
            </span>
          </span>
          <span class="flex items-center gap-2">
            <UBadge v-if="stats.pendingKyc" color="primary" variant="soft" size="sm">{{ stats.pendingKyc }}</UBadge>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
          </span>
        </NuxtLink>

        <NuxtLink to="/admin/funding" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
          <span class="flex items-center gap-3">
            <UIcon name="i-lucide-clipboard-check" class="size-5 text-primary" />
            <span>
              <span class="block font-medium">Approve projects</span>
              <span class="block text-xs text-stone-500 dark:text-stone-400">Approve so requesters can pay</span>
            </span>
          </span>
          <span class="flex items-center gap-2">
            <UBadge v-if="stats.awaitingFunding" color="primary" variant="soft" size="sm">{{ stats.awaitingFunding }}</UBadge>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
          </span>
        </NuxtLink>

        <NuxtLink to="/admin/moderation" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
          <span class="flex items-center gap-3">
            <UIcon name="i-lucide-flag" class="size-5 text-primary" />
            <span>
              <span class="block font-medium">Moderation</span>
              <span class="block text-xs text-stone-500 dark:text-stone-400">Review reported content</span>
            </span>
          </span>
          <span class="flex items-center gap-2">
            <UBadge v-if="stats.openReports" color="error" variant="soft" size="sm">{{ stats.openReports }}</UBadge>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
          </span>
        </NuxtLink>

        <NuxtLink to="/admin/services" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
          <span class="flex items-center gap-3">
            <UIcon name="i-lucide-briefcase" class="size-5 text-primary" />
            <span>
              <span class="block font-medium">Service approvals</span>
              <span class="block text-xs text-stone-500 dark:text-stone-400">Review service listings</span>
            </span>
          </span>
          <span class="flex items-center gap-2">
            <UBadge v-if="stats.pendingServices" color="primary" variant="soft" size="sm">{{ stats.pendingServices }}</UBadge>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
          </span>
        </NuxtLink>

        <NuxtLink to="/admin/royalties" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
          <span class="flex items-center gap-3">
            <UIcon name="i-lucide-book-open-text" class="size-5 text-primary" />
            <span>
              <span class="block font-medium">Royalty approvals</span>
              <span class="block text-xs text-stone-500 dark:text-stone-400">Review published works</span>
            </span>
          </span>
          <span class="flex items-center gap-2">
            <UBadge v-if="stats.pendingRoyalties" color="primary" variant="soft" size="sm">{{ stats.pendingRoyalties }}</UBadge>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
          </span>
        </NuxtLink>

        <NuxtLink to="/admin/tickets" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
          <span class="flex items-center gap-3">
            <UIcon name="i-lucide-ticket" class="size-5 text-primary" />
            <span>
              <span class="block font-medium">Support tickets</span>
              <span class="block text-xs text-stone-500 dark:text-stone-400">Your open and closed tickets</span>
            </span>
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
        </NuxtLink>

        <NuxtLink to="/admin/projects" class="zc-card zc-card-hover zc-tap flex items-center justify-between p-4">
          <span class="flex items-center gap-3">
            <UIcon name="i-lucide-folder-kanban" class="size-5 text-primary" />
            <span>
              <span class="block font-medium">All projects</span>
              <span class="block text-xs text-stone-500 dark:text-stone-400">Parties, applicants and the money trail</span>
            </span>
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-5 text-stone-400" />
        </NuxtLink>
      </div>

      <!-- Summary panel -->
      <div class="space-y-2">
        <p class="zc-eyebrow">At a glance</p>
        <div class="zc-card space-y-4 p-4">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <UIcon name="i-lucide-users" class="size-4 text-stone-400" /> Approved members
            </span>
            <span class="text-lg font-medium">{{ loading ? '—' : stats.members }}</span>
          </div>
          <div class="flex items-center justify-between border-t border-stone-100 pt-4 dark:border-stone-800">
            <span class="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <UIcon name="i-lucide-radio" class="size-4 text-stone-400" /> Live projects
            </span>
            <span class="text-lg font-medium">{{ loading ? '—' : stats.liveProjects }}</span>
          </div>
          <div class="flex items-center justify-between border-t border-stone-100 pt-4 dark:border-stone-800">
            <span class="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <UIcon name="i-lucide-circle-check" class="size-4 text-success" /> Completed
            </span>
            <span class="text-lg font-medium">{{ loading ? '—' : stats.closed }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
