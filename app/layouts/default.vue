<script setup lang="ts">
import { useAuth } from '~/features/auth/application/useAuth'
import { useMe } from '~/features/auth/application/useMe'
const { user, signOut } = useAuth()
const { me, load } = useMe()
watch(user, () => load(), { immediate: true })
const isAdmin = computed(() => me.value?.role === 'admin' || me.value?.role === 'master')
const isMaster = computed(() => me.value?.role === 'master')
const isSuspended = computed(() => me.value?.is_suspended === true)
// Friendly role label — small, for the person's own reference.
const roleLabel = computed(() => {
  switch (me.value?.role) {
    case 'service_requester': return 'Requester'
    case 'service_provider': return 'Provider'
    case 'admin': return 'Admin'
    case 'master': return 'Master'
    default: return ''
  }
})
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
          <NuxtLink :to="isMaster ? '/master' : isAdmin ? '/admin' : '/'" class="zc-tap flex items-center gap-2.5">
            <ShellLogo :size="42" />
            <span class="flex flex-col leading-none">
              <span class="font-serif text-2xl tracking-tight">Zirclaire<span class="text-primary">.</span></span>
              <span v-if="user && roleLabel" class="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">{{ roleLabel }}</span>
            </span>
          </NuxtLink>
          <div class="flex items-center gap-1">
            <ShellThemeToggle />
            <ShellNotificationBell v-if="user" />
            <UButton
              v-if="user"
              to="/legal"
              icon="i-lucide-info"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="About & legal"
            />
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
            <!-- Master has no bottom bar; the full nav is in this menu. -->
            <ShellMasterMobileMenu v-if="isMaster" />
            <!-- Signed out: the feed is public, so give visitors a way in. -->
            <UButton v-if="!user" to="/login" color="primary" size="sm" label="Log in" class="zc-tap" />
          </div>
        </header>

        <main class="flex-1 px-4 py-5 pb-28 lg:px-12 lg:py-10 lg:pb-12">
          <slot />
        </main>
      </div>
    </div>

    <!-- Mobile bottom nav -->
    <ShellBottomNav />

    <!-- Suspension notice — blocks the app for a suspended account, with the
         reason. Their content is already hidden server-side; this tells them. -->
    <Teleport to="body">
      <div v-if="isSuspended" class="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/80 p-4 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 text-center dark:bg-stone-900">
          <div class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-error/10">
            <UIcon name="i-lucide-shield-alert" class="size-7 text-error" />
          </div>
          <h1 class="font-serif text-xl">Your account is suspended</h1>
          <p class="mt-2 text-sm text-stone-600 dark:text-stone-300">
            While suspended, you can't post, comment, apply or order, and your profile and content are hidden from others.
          </p>
          <div v-if="me?.suspended_reason" class="mt-4 rounded-xl bg-stone-50 p-3 text-left text-sm dark:bg-stone-800/60">
            <span class="font-medium">Reason:</span> {{ me.suspended_reason }}
          </div>
          <p class="mt-4 text-xs text-stone-400">If you think this is a mistake, contact support.</p>
          <UButton color="neutral" variant="soft" class="mt-4" icon="i-lucide-log-out" label="Sign out" @click="signOut" />
        </div>
      </div>
    </Teleport>
  </div>
</template>
