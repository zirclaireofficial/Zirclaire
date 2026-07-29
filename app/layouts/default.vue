<script setup lang="ts">
import { useAuth } from '~/features/auth/application/useAuth'
import { useMe } from '~/features/auth/application/useMe'
const { user } = useAuth()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })
const isAdmin = computed(() => me.value?.role === 'admin')
</script>

<template>
  <div class="zc-canvas min-h-screen bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
    <div class="flex w-full">
      <!-- Desktop: sidebar nav -->
      <ShellSidebar />

      <!-- Content column: phone column on mobile, wide panel on desktop -->
      <div
        class="zc-lift mx-auto flex min-h-screen w-full max-w-md flex-col bg-white dark:bg-stone-900 lg:mx-0 lg:max-w-none lg:flex-1 lg:border-x lg:border-stone-200 lg:shadow-none lg:dark:border-stone-800"
      >
        <!-- red accent line (mobile) -->
        <div class="h-0.5 w-full bg-primary lg:hidden" />

        <!-- Mobile header (desktop uses the sidebar instead) -->
        <header
          class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-stone-200 bg-white/85 px-4 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/85 lg:hidden"
        >
          <NuxtLink :to="isAdmin ? '/admin' : '/'" class="zc-tap flex items-center gap-2.5">
            <ShellLogo :size="42" />
            <span class="font-serif text-2xl tracking-tight">Zirclaire<span class="text-primary">.</span></span>
            <UBadge v-if="isAdmin" color="primary" variant="soft" size="sm" class="ml-0.5">Admin</UBadge>
          </NuxtLink>
          <div class="flex items-center gap-1">
            <ShellThemeToggle />
            <!-- Inbox lives here now; sign out moved to the profile page. -->
            <UButton
              v-if="user"
              to="/messages"
              icon="i-lucide-message-square"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Inbox"
            />
            <!-- Signed out: the feed is public, so give visitors a way in. -->
            <UButton v-else to="/login" color="primary" size="sm" label="Log in" class="zc-tap" />
          </div>
        </header>

        <main class="flex-1 px-4 py-5 pb-28 lg:px-12 lg:py-10 lg:pb-12">
          <slot />
        </main>
      </div>
    </div>

    <!-- Mobile bottom nav -->
    <ShellBottomNav />
  </div>
</template>
