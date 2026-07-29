<script setup lang="ts">
import { useMe } from '~/features/auth/application/useMe'

const route = useRoute()
const user = useSupabaseUser()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })

const isAdmin = computed(() => me.value?.role === 'admin')

// Mobile bottom bar is tight (5 slots incl. the Z). Feed, Projects, Services
// and Profile live here; Royalties is one tap away via the Services store
// header and the desktop sidebar.
const left = [
  { to: '/', icon: 'i-lucide-home', label: 'Feed' },
  { to: '/projects', icon: 'i-lucide-folder-kanban', label: 'Projects' },
]
const right = [
  { to: '/services', icon: 'i-lucide-briefcase', label: 'Services' },
  { to: '/profile', icon: 'i-lucide-user', label: 'Profile' },
]

// KYC, funding and reports live on the dashboard as queues — the nav is for
// browsing. The admin's Z opens the member directory, since the broker has
// nothing to create.
const adminLeft = [
  { to: '/admin', icon: 'i-lucide-layout-dashboard', label: 'Home' },
  { to: '/', icon: 'i-lucide-home', label: 'Feed' },
]
const adminRight = [
  { to: '/admin/projects', icon: 'i-lucide-folder-kanban', label: 'Projects' },
  { to: '/profile', icon: 'i-lucide-user', label: 'Profile' },
]

function isActive(to: string) {
  if (to === '/' || to === '/admin') return route.path === to
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-20 lg:hidden">
    <!-- Admin: same shape as members, but the Z opens triage, not a form -->
    <div
      v-if="isAdmin"
      class="mx-auto flex w-full max-w-md items-end justify-around border-t border-stone-200 bg-white/90 px-2 pb-2 pt-2 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/90"
      style="box-shadow: 0 -6px 24px rgba(23, 23, 23, 0.06)"
    >
      <NuxtLink v-for="it in adminLeft" :key="it.to" :to="it.to" :aria-label="it.label" class="zc-tap flex w-14 flex-col items-center gap-0.5">
        <span class="flex h-8 w-11 items-center justify-center rounded-full transition" :class="isActive(it.to) ? 'bg-primary/10' : ''">
          <UIcon :name="it.icon" class="size-5" :class="isActive(it.to) ? 'text-primary' : 'text-stone-400 dark:text-stone-500'" />
        </span>
        <span class="text-[10px] leading-none" :class="isActive(it.to) ? 'font-medium text-primary' : 'text-stone-400 dark:text-stone-500'">{{ it.label }}</span>
      </NuxtLink>

      <NuxtLink to="/admin/members" aria-label="Members" class="zc-tap -mt-6">
        <span class="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white ring-2 ring-primary shadow-lg shadow-brand-500/40">
          <img src="/logo.jpeg" alt="Members" class="size-11 object-contain" >
        </span>
      </NuxtLink>

      <NuxtLink v-for="it in adminRight" :key="it.to" :to="it.to" :aria-label="it.label" class="zc-tap flex w-14 flex-col items-center gap-0.5">
        <span class="flex h-8 w-11 items-center justify-center rounded-full transition" :class="isActive(it.to) ? 'bg-primary/10' : ''">
          <UIcon :name="it.icon" class="size-5" :class="isActive(it.to) ? 'text-primary' : 'text-stone-400 dark:text-stone-500'" />
        </span>
        <span class="text-[10px] leading-none" :class="isActive(it.to) ? 'font-medium text-primary' : 'text-stone-400 dark:text-stone-500'">{{ it.label }}</span>
      </NuxtLink>
    </div>

    <!-- SR / SP: marketplace + social nav with the create button -->
    <div
      v-else
      class="mx-auto flex w-full max-w-md items-end justify-around border-t border-stone-200 bg-white/90 px-2 pb-2 pt-2 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/90"
      style="box-shadow: 0 -6px 24px rgba(23, 23, 23, 0.06)"
    >
      <NuxtLink v-for="it in left" :key="it.to" :to="it.to" :aria-label="it.label" class="zc-tap flex w-14 flex-col items-center gap-0.5">
        <span class="flex h-8 w-11 items-center justify-center rounded-full transition" :class="isActive(it.to) ? 'bg-primary/10' : ''">
          <UIcon :name="it.icon" class="size-5" :class="isActive(it.to) ? 'text-primary' : 'text-stone-400 dark:text-stone-500'" />
        </span>
        <span class="text-[10px] leading-none" :class="isActive(it.to) ? 'font-medium text-primary' : 'text-stone-400 dark:text-stone-500'">{{ it.label }}</span>
      </NuxtLink>

      <NuxtLink to="/create" aria-label="Create" class="zc-tap -mt-6">
        <span class="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white ring-2 ring-primary shadow-lg shadow-brand-500/40">
          <img src="/logo.jpeg" alt="Create" class="size-11 object-contain" >
        </span>
      </NuxtLink>

      <NuxtLink v-for="it in right" :key="it.to" :to="it.to" :aria-label="it.label" class="zc-tap flex w-14 flex-col items-center gap-0.5">
        <span class="flex h-8 w-11 items-center justify-center rounded-full transition" :class="isActive(it.to) ? 'bg-primary/10' : ''">
          <UIcon :name="it.icon" class="size-5" :class="isActive(it.to) ? 'text-primary' : 'text-stone-400 dark:text-stone-500'" />
        </span>
        <span class="text-[10px] leading-none" :class="isActive(it.to) ? 'font-medium text-primary' : 'text-stone-400 dark:text-stone-500'">{{ it.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
