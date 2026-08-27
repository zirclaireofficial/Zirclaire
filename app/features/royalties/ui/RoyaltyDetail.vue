<script setup lang="ts">
// One item, opened from the store. Handles the three states a viewer can be
// in: already owns it (download), can buy it, or needs to sign in / get
// approved first. Buying reuses the simulated Touch 'n Go / Binance choice.

import { useRoyalties } from '~/features/royalties/application/useRoyalties'
import { useMe } from '~/features/auth/application/useMe'
import { usePublicMedia } from '~/shared/lib/media'
import { workTypeLabel, royaltyCommission, creatorPayout } from '~/features/royalties/domain'
import type { StoreItem } from '~/features/royalties/domain'

const props = defineProps<{ item: StoreItem }>()
const emit = defineEmits<{ close: []; purchased: [] }>()

const { purchase, downloadUrl } = useRoyalties()
const { me } = useMe()
const { thumbUrl } = usePublicMedia()
const user = useSupabaseUser()
const toast = useToast()

const owned = ref(props.item.owned)
const method = ref<'touch_n_go' | 'binance'>('touch_n_go')
const buying = ref(false)
const downloading = ref(false)

const signedIn = computed(() => !!(user.value as { sub?: string } | null)?.sub)
const canBuy = computed(() => signedIn.value && me.value?.kyc_status === 'approved')
const isOwnWork = computed(() => me.value && props.item.creator_id === (user.value as { sub?: string }).sub)

async function buy() {
  buying.value = true
  try {
    const res = await purchase(props.item.id, method.value)
    toast.add({ title: 'Purchased', description: `Reference ${res.purchase.reference}. It's yours to download.`, color: 'success' })
    owned.value = true
    emit('purchased')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Purchase failed', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    buying.value = false
  }
}

async function download() {
  downloading.value = true
  try {
    const url = await downloadUrl(props.item.id)
    window.open(url, '_blank')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not get the file', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" @click.self="emit('close')">
      <div class="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white dark:bg-stone-900 sm:rounded-2xl">
        <div class="relative aspect-[3/2] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
          <img v-if="item.cover_image" :src="thumbUrl(item.cover_image, 800)" :alt="item.title" class="h-full w-full object-cover" >
          <div v-else class="flex h-full w-full items-center justify-center">
            <UIcon name="i-lucide-book-open-text" class="size-12 text-stone-300 dark:text-stone-600" />
          </div>
          <button class="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/50 text-white" aria-label="Close" @click="emit('close')">
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
        </div>

        <div class="space-y-4 p-5">
          <div>
            <UBadge color="neutral" variant="soft" size="sm" class="mb-1.5 capitalize">{{ workTypeLabel(item.work_type) }}</UBadge>
            <h2 class="font-serif text-2xl leading-tight">{{ item.title }}</h2>
            <NuxtLink
              v-if="item.creator?.member_id"
              :to="`/u/${item.creator.member_id}`"
              class="zc-tap mt-1 inline-block text-sm text-stone-500 hover:text-primary dark:text-stone-400"
            >
              {{ item.creator.full_name }} <span class="font-mono">{{ item.creator.member_id }}</span>
            </NuxtLink>
          </div>

          <p v-if="item.description" class="whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">
            {{ item.description }}
          </p>

          <div class="flex items-baseline justify-between border-t border-stone-100 pt-4 dark:border-stone-800">
            <span class="text-2xl font-semibold tabular-nums">RM {{ item.price_myr }}</span>
            <span class="text-xs text-stone-400">{{ item.purchase_count }} sold</span>
          </div>

          <!-- Already owned -->
          <template v-if="owned">
            <UButton color="primary" block size="lg" icon="i-lucide-download" class="zc-tap" :loading="downloading" label="Download" @click="download" />
            <p class="text-center text-xs text-stone-400">Yours to re-download any time.</p>
          </template>

          <!-- Own work -->
          <p v-else-if="isOwnWork" class="rounded-lg bg-stone-50 p-3 text-center text-sm text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">
            This is your work. You can download it from your library.
          </p>

          <!-- Can buy -->
          <template v-else-if="canBuy">
            <div>
              <p class="mb-2 text-sm font-medium">Pay with</p>
              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  class="zc-tap rounded-xl border p-3 text-left transition"
                  :class="method === 'touch_n_go' ? 'border-primary ring-1 ring-primary' : 'border-stone-200 dark:border-stone-800'"
                  @click="method = 'touch_n_go'"
                >
                  <UIcon name="i-lucide-wallet" class="size-5 text-primary" />
                  <div class="mt-1 text-sm font-medium">Touch 'n Go</div>
                </button>
                <button
                  type="button"
                  class="zc-tap rounded-xl border p-3 text-left transition"
                  :class="method === 'binance' ? 'border-primary ring-1 ring-primary' : 'border-stone-200 dark:border-stone-800'"
                  @click="method = 'binance'"
                >
                  <UIcon name="i-lucide-coins" class="size-5 text-primary" />
                  <div class="mt-1 text-sm font-medium">Binance</div>
                </button>
              </div>
            </div>
            <UButton color="primary" block size="lg" class="zc-tap" :loading="buying" :label="`Buy for RM ${item.price_myr}`" @click="buy" />
            <p class="flex items-center justify-center gap-1.5 text-center text-xs text-stone-400">
              <UIcon name="i-lucide-lock" class="size-3" /> Simulated payment — no real charge.
            </p>
          </template>

          <!-- Signed out / not approved -->
          <template v-else>
            <UButton v-if="!signedIn" to="/login" color="primary" block size="lg" label="Sign in to buy" class="zc-tap" />
            <p v-else class="rounded-lg bg-stone-50 p-3 text-center text-sm text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">
              You can buy once your account is approved.
            </p>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
