<script setup lang="ts">
import { useAuth } from '~/features/auth/application/useAuth'
import { useMe } from '~/features/auth/application/useMe'

const route = useRoute()
const user = useSupabaseUser()
const { signOut } = useAuth()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })

const isAdmin = computed(() => me.value?.role === 'admin')

const items = computed(() =>
  isAdmin.value
    ? [
        // KYC, funding and reports are queues reached from the dashboard —
        // the nav keeps only the places you go to browse, not to action.
        { to: '/admin', icon: 'i-lucide-layout-dashboard', label: 'Dashboard' },
        { to: '/', icon: 'i-lucide-home', label: 'Feed' },
        { to: '/admin/projects', icon: 'i-lucide-folder-kanban', label: 'All projects' },
        { to: '/profile', icon: 'i-lucide-user', label: 'Profile' },
      ]
    : [
        { to: '/', icon: 'i-lucide-home', label: 'Feed' },
        { to: '/projects', icon: 'i-lucide-briefcase', label: 'Projects' },
        { to: '/create', icon: 'i-lucide-plus', label: 'Create' },
        { to: '/messages', icon: 'i-lucide-send', label: 'Messages' },
        { to: '/profile', icon: 'i-lucide-user', label: 'Profile' },
      ],
)

function isActive(to: string) {
  if (to === '/' || to === '/admin') return route.path === to
  return route.path.startsWith(to)
}
</script>

<template>
  <aside
    class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-white/70 px-3 py-5 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/70 lg:flex"
  >
    <NuxtLink :to="isAdmin ? '/admin' : '/'" class="zc-tap mb-1 flex items-center gap-2.5 px-2">
      <ShellLogo :size="48" />
      <span class="font-serif text-2xl tracking-tight">Zirclaire<span class="text-primary">.</span></span>
    </NuxtLink>
    <p v-if="isAdmin" class="zc-eyebrow mb-4 px-2">Admin console</p>
    <div v-else class="mb-4" />

    <nav class="flex flex-1 flex-col gap-1">
      <NuxtLink
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition"
        :class="isActive(it.to)
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'"
      >
        <UIcon :name="it.icon" class="size-5" />
        {{ it.label }}
      </NuxtLink>
    </nav>

    <div class="mt-auto flex items-center justify-between border-t border-stone-200 px-1 pt-3 dark:border-stone-800">
      <ShellThemeToggle />
      <UButton
        v-if="user"
        icon="i-lucide-log-out"
        color="neutral"
        variant="ghost"
        size="sm"
        label="Sign out"
        @click="signOut"
      />
    </div>
  </aside>
</template>
