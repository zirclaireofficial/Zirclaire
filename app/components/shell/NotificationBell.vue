<script setup lang="ts">
// Header notification bell: unread badge + dropdown list, streamed in real time.
import { useNotifications } from '~/features/notifications/application/useNotifications'

const { items, unread, load, subscribe, markRead, markAllRead } = useNotifications()
const open = ref(false)
let cleanup: (() => void) | null = null

onMounted(() => {
  load()
  cleanup = subscribe()
})
onBeforeUnmount(() => cleanup?.())

async function openItem(n: { id: string; link: string | null }) {
  await markRead(n.id)
  open.value = false
  const link = n.link?.trim()
  if (!link) return
  // Only follow real links: internal paths ('/...') or full URLs. Anything
  // else (e.g. stray text) is ignored so we never 404 on a bad link.
  if (link.startsWith('/')) {
    await navigateTo(link)
  } else if (/^https?:\/\//i.test(link)) {
    window.open(link, '_blank', 'noopener')
  }
}

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <button
      class="zc-tap relative flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
      aria-label="Notifications"
    >
      <UIcon name="i-lucide-bell" class="size-5" />
      <span
        v-if="unread"
        class="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-white"
      >{{ unread > 9 ? '9+' : unread }}</span>
    </button>

    <template #content>
      <div class="w-80 max-w-[90vw]">
        <div class="flex items-center justify-between border-b border-stone-100 px-3 py-2 dark:border-stone-800">
          <span class="text-sm font-medium">Notifications</span>
          <button v-if="unread" type="button" class="text-xs text-primary" @click="markAllRead">Mark all read</button>
        </div>
        <div class="max-h-96 overflow-y-auto">
          <p v-if="!items.length" class="p-4 text-center text-sm text-stone-400">Nothing yet.</p>
          <button
            v-for="n in items"
            :key="n.id"
            type="button"
            class="flex w-full items-start gap-2.5 border-b border-stone-100 px-3 py-2.5 text-left transition last:border-0 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/50"
            :class="!n.read_at ? 'bg-primary/5' : ''"
            @click="openItem(n)"
          >
            <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="!n.read_at ? 'bg-primary' : 'bg-transparent'" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium leading-tight">{{ n.title }}</span>
              <span v-if="n.body" class="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">{{ n.body }}</span>
              <span class="mt-0.5 block text-[11px] text-stone-400">{{ ago(n.created_at) }}</span>
            </span>
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>
