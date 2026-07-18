<script setup lang="ts">
import { useMe } from '~/features/auth/application/useMe'

const route = useRoute()
const user = useSupabaseUser()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })

const isAdmin = computed(() => me.value?.role === 'admin')

const left = [
  { to: '/', icon: 'i-lucide-home', label: 'Feed' },
  { to: '/projects', icon: 'i-lucide-briefcase', label: 'Projects' },
]
const right = [
  { to: '/messages', icon: 'i-lucide-send', label: 'Chat' },
  { to: '/profile', icon: 'i-lucide-user', label: 'Profile' },
]

const adminItems = [
  { to: '/admin', icon: 'i-lucide-layout-dashboard', label: 'Home' },
  { to: '/admin/kyc', icon: 'i-lucide-shield-check', label: 'KYC' },
  { to: '/admin/funding', icon: 'i-lucide-banknote', label: 'Funding' },
  { to: '/admin/moderation', icon: 'i-lucide-flag', label: 'Reports' },
  { to: '/profile', icon: 'i-lucide-user', label: 'Profile' },
]

function isActive(to: string) {
  if (to === '/' || to === '/admin') return route.path === to
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-20 lg:hidden">
    <!-- Admin: flat management nav (no create button) -->
    <div
      v-if="isAdmin"
      class="mx-auto flex w-full max-w-md items-end justify-around border-t border-stone-200 bg-white/90 px-1 pb-2 pt-2 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/90"
      style="box-shadow: 0 -6px 24px rgba(23, 23, 23, 0.06)"
    >
      <NuxtLink
        v-for="it in adminItems"
        :key="it.to"
        :to="it.to"
        :aria-label="it.label"
        class="zc-tap flex flex-1 flex-col items-center gap-0.5"
      >
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
