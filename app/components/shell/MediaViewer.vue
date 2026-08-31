<script setup lang="ts">
// App-wide image lightbox. Shows an image in place; if the source turns out not
// to be an image, it downloads it instead. Driven by useMediaViewer state.
import { useMediaViewer } from '~/shared/lib/useMediaViewer'

const { state, close, download } = useMediaViewer()

function onError() {
  const { url, title } = state.value
  close()
  download(url, title || 'download')
}

// Close on Escape while open.
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="state.open" class="fixed inset-0 z-[60] flex flex-col bg-black/90" @click.self="close">
      <div class="flex items-center justify-between gap-2 p-3">
        <span class="min-w-0 truncate text-sm text-white/80">{{ state.title || 'Image' }}</span>
        <div class="flex shrink-0 gap-1">
          <button class="zc-tap rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Download" @click="download(state.url, state.title || 'image')">
            <UIcon name="i-lucide-download" class="size-5" />
          </button>
          <button class="zc-tap rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Close" @click="close">
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
        </div>
      </div>
      <div class="flex flex-1 items-center justify-center overflow-auto p-4" @click.self="close">
        <img :src="state.url" :alt="state.title" class="max-h-full max-w-full rounded-lg object-contain" @error="onError" >
      </div>
    </div>
  </Teleport>
</template>
