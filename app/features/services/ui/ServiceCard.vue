<script setup lang="ts">
import { usePublicMedia } from '~/shared/lib/media'
import { lowestPrice } from '~/features/services/domain'
import type { StoreService } from '~/features/services/domain'

const props = defineProps<{ service: StoreService }>()
const emit = defineEmits<{ open: [service: StoreService] }>()

const { thumbUrl } = usePublicMedia()
const from = computed(() => lowestPrice(props.service.tiers))
const multiTier = computed(() => props.service.tiers.length > 1)
</script>

<template>
  <button class="zc-card zc-card-hover zc-tap flex w-full flex-col overflow-hidden text-left" @click="emit('open', service)">
    <div class="aspect-[3/2] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
      <img
        v-if="service.cover_image"
        :src="thumbUrl(service.cover_image, 500)"
        :alt="service.title"
        class="h-full w-full object-cover"
        loading="lazy"
      >
      <div v-else class="flex h-full w-full items-center justify-center">
        <UIcon name="i-lucide-briefcase" class="size-10 text-stone-300 dark:text-stone-600" />
      </div>
    </div>

    <div class="flex flex-1 flex-col p-3">
      <div class="mb-1 flex items-center gap-2">
        <img
          v-if="service.provider?.profile_picture"
          :src="thumbUrl(service.provider.profile_picture, 60)"
          :alt="service.provider.full_name ?? ''"
          class="size-5 rounded-full object-cover"
        >
        <span class="truncate text-xs text-stone-500 dark:text-stone-400">
          {{ service.provider?.full_name ?? 'Member' }}
        </span>
      </div>
      <h3 class="line-clamp-2 text-sm font-medium leading-snug">{{ service.title }}</h3>
      <div class="mt-2 flex items-center justify-between">
        <span class="text-xs text-stone-400">{{ multiTier ? 'From' : '' }}</span>
        <span class="text-base font-semibold tabular-nums">${{ from }}</span>
      </div>
    </div>
  </button>
</template>
