<script setup lang="ts">
import { usePublicMedia } from '~/shared/lib/media'
import { workTypeLabel } from '~/features/royalties/domain'
import type { StoreItem } from '~/features/royalties/domain'

defineProps<{ item: StoreItem }>()
const emit = defineEmits<{ open: [item: StoreItem] }>()

const { thumbUrl } = usePublicMedia()
</script>

<template>
  <button class="zc-card zc-card-hover zc-tap flex w-full flex-col overflow-hidden text-left" @click="emit('open', item)">
    <!-- Cover, or a typed placeholder when there's none -->
    <div class="relative aspect-[3/2] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
      <img
        v-if="item.cover_image"
        :src="thumbUrl(item.cover_image, 500)"
        :alt="item.title"
        class="h-full w-full object-cover"
        loading="lazy"
      >
      <div v-else class="flex h-full w-full items-center justify-center">
        <UIcon name="i-lucide-book-open-text" class="size-10 text-stone-300 dark:text-stone-600" />
      </div>
      <UBadge color="neutral" variant="solid" size="sm" class="absolute left-2 top-2 capitalize">
        {{ workTypeLabel(item.work_type) }}
      </UBadge>
      <span
        v-if="item.owned"
        class="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-success/90 px-2 py-0.5 text-xs font-medium text-white"
      >
        <UIcon name="i-lucide-check" class="size-3" /> Owned
      </span>
    </div>

    <div class="flex flex-1 flex-col p-3">
      <h3 class="line-clamp-2 font-serif text-base leading-tight">{{ item.title }}</h3>
      <p class="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">
        {{ item.creator?.full_name ?? 'Member' }}
        <span class="font-mono">{{ item.creator?.member_id }}</span>
      </p>
      <div class="mt-2 flex items-center justify-between">
        <span class="text-lg font-semibold tabular-nums">RM {{ item.price_myr }}</span>
        <span class="text-[11px] text-stone-400">{{ item.purchase_count }} sold</span>
      </div>
    </div>
  </button>
</template>
