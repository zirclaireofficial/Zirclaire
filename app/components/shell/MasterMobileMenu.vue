<script setup lang="ts">
// The master has more destinations than a bottom bar can hold, so on mobile
// they get a hamburger dropdown with the full set instead.
const items = [[
  { label: 'Master console', icon: 'i-lucide-shield', to: '/master' },
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/admin' },
  { label: 'Feed', icon: 'i-lucide-home', to: '/' },
  { label: 'Members', icon: 'i-lucide-users', to: '/admin/members' },
  { label: 'All projects', icon: 'i-lucide-folder-kanban', to: '/admin/projects' },
  { label: 'Service approvals', icon: 'i-lucide-briefcase', to: '/admin/services' },
  { label: 'Royalty approvals', icon: 'i-lucide-book-open-text', to: '/admin/royalties' },
  { label: 'Messages', icon: 'i-lucide-message-square', to: '/messages' },
  { label: 'Guide', icon: 'i-lucide-book-marked', to: '/guide' },
  { label: 'Profile', icon: 'i-lucide-user', to: '/profile' },
]]
</script>

<template>
  <UDropdownMenu :items="items" :ui="{ content: 'w-56' }">
    <UButton icon="i-lucide-menu" color="neutral" variant="ghost" size="sm" aria-label="Menu" />
  </UDropdownMenu>
</template>
