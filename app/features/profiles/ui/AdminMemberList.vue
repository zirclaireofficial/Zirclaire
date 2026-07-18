<script setup lang="ts">
// Everyone on the platform and what they are. Read-only — approving and
// rejecting still happens in the KYC console, which is the deliberate route
// for it.

import { useProfiles } from '~/features/profiles/application/useProfiles'
import { usePublicMedia } from '~/shared/lib/media'
import { roleLabel, kycLabel, initialsOf, countByRole } from '~/features/profiles/domain'
import type { MemberRow } from '~/features/profiles/domain'

const { allMembers } = useProfiles()
const { publicMediaUrl } = usePublicMedia()
const toast = useToast()

const members = ref<MemberRow[]>([])
const loading = ref(true)
const search = ref('')
const role = ref<string | null>(null)

const ROLES = [
  { value: null, label: 'Everyone' },
  { value: 'service_provider', label: 'Providers' },
  { value: 'service_requester', label: 'Requesters' },
  { value: 'admin', label: 'Admins' },
] as const

async function load() {
  loading.value = true
  try {
    members.value = await allMembers()
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not load members', description: err?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const counts = computed(() => countByRole(members.value))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return members.value.filter((m) => {
    if (role.value && m.role !== role.value) return false
    if (!q) return true
    return (
      m.full_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.member_id ?? '').toLowerCase().includes(q)
    )
  })
})

const kycColor = (s: string) =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'error' : 'warning'

const joined = (iso: string) => new Date(iso).toLocaleDateString()
</script>

<template>
  <div class="space-y-4">
    <!-- Headline counts -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Providers</p>
        <p class="mt-0.5 text-2xl font-medium">{{ loading ? '—' : (counts.service_provider ?? 0) }}</p>
      </div>
      <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Requesters</p>
        <p class="mt-0.5 text-2xl font-medium">{{ loading ? '—' : (counts.service_requester ?? 0) }}</p>
      </div>
      <div class="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
        <p class="text-[11px] uppercase tracking-wide text-stone-400">Admins</p>
        <p class="mt-0.5 text-2xl font-medium">{{ loading ? '—' : (counts.admin ?? 0) }}</p>
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="r in ROLES"
        :key="r.label"
        class="zc-tap rounded-full border px-3 py-1 text-xs transition"
        :class="role === r.value
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'border-stone-200 text-stone-500 hover:border-stone-300 dark:border-stone-800 dark:text-stone-400'"
        @click="role = r.value"
      >
        {{ r.label }}
      </button>
    </div>

    <UInput v-model="search" icon="i-lucide-search" placeholder="Search name, email or member ID" class="w-full" />

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="zc-card h-16 animate-pulse" />
    </div>

    <p v-else-if="!filtered.length" class="py-14 text-center text-sm text-stone-500 dark:text-stone-400">
      No members match that.
    </p>

    <div v-else class="grid gap-2 lg:grid-cols-2">
      <div
        v-for="m in filtered"
        :key="m.id"
        class="zc-card flex items-center gap-3 p-3"
      >
        <img
          v-if="m.profile_picture"
          :src="publicMediaUrl(m.profile_picture)"
          :alt="m.full_name"
          class="size-10 shrink-0 rounded-full object-cover"
        >
        <div
          v-else
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium dark:bg-stone-800"
        >
          {{ initialsOf(m.full_name) }}
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <NuxtLink
              v-if="m.member_id"
              :to="`/u/${m.member_id}`"
              class="zc-tap truncate font-mono text-sm font-medium hover:text-primary"
            >
              {{ m.member_id }}
            </NuxtLink>
            <span v-else class="truncate font-mono text-sm text-stone-400">No ID yet</span>
            <UBadge color="neutral" variant="soft" size="sm" class="shrink-0">{{ roleLabel(m.role) }}</UBadge>
          </div>
          <p class="truncate text-sm">{{ m.full_name }}</p>
          <p class="truncate text-xs text-stone-500 dark:text-stone-400">{{ m.email }}</p>
        </div>

        <div class="shrink-0 text-right">
          <UBadge :color="(kycColor(m.kyc_status) as any)" variant="soft" size="sm">
            {{ kycLabel(m.kyc_status) }}
          </UBadge>
          <p class="mt-1 text-[11px] text-stone-400">{{ joined(m.created_at) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
