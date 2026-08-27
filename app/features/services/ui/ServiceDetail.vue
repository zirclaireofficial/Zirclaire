<script setup lang="ts">
// One service, opened from the store. The buyer picks a tier and orders it;
// ordering creates a funded project and lands them in "My projects" to track
// delivery. Reuses the simulated payment choice.

import { useServices } from '~/features/services/application/useServices'
import { useMe } from '~/features/auth/application/useMe'
import { usePublicMedia } from '~/shared/lib/media'
import type { StoreService, ServiceTier } from '~/features/services/domain'

const props = defineProps<{ service: StoreService }>()
const emit = defineEmits<{ close: []; ordered: [] }>()

const { orderTier } = useServices()
const { me } = useMe()
const { thumbUrl } = usePublicMedia()
const user = useSupabaseUser()
const toast = useToast()

const selectedTier = ref<ServiceTier | null>(props.service.tiers[0] ?? null)
const method = ref<'touch_n_go' | 'binance'>('touch_n_go')
const ordering = ref(false)
const done = ref(false)

const signedIn = computed(() => !!(user.value as { sub?: string } | null)?.sub)
const canOrder = computed(() => signedIn.value && me.value?.kyc_status === 'approved')
const isOwnService = computed(() => me.value && props.service.provider_id === (user.value as { sub?: string }).sub)

function deliveryLabel(mins: number | null) {
  if (!mins) return null
  const days = Math.round(mins / 1440)
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''}`
  const hrs = Math.round(mins / 60)
  return `${hrs}h`
}

async function order() {
  if (!selectedTier.value) return
  ordering.value = true
  try {
    await orderTier(selectedTier.value.id)
    toast.add({ title: 'Order placed', description: 'Funds are held in escrow. Track it in My projects.', color: 'success' })
    done.value = true
    emit('ordered')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not order', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    ordering.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" @click.self="emit('close')">
      <div class="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white dark:bg-stone-900 sm:rounded-2xl">
        <div class="relative aspect-[3/2] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
          <img v-if="service.cover_image" :src="thumbUrl(service.cover_image, 800)" :alt="service.title" class="h-full w-full object-cover" >
          <div v-else class="flex h-full w-full items-center justify-center">
            <UIcon name="i-lucide-briefcase" class="size-12 text-stone-300 dark:text-stone-600" />
          </div>
          <button class="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/50 text-white" aria-label="Close" @click="emit('close')">
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
        </div>

        <!-- Ordered -->
        <div v-if="done" class="space-y-3 p-6 text-center">
          <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
            <UIcon name="i-lucide-check" class="size-6 text-success" />
          </div>
          <h2 class="font-serif text-lg">Order placed</h2>
          <p class="text-sm text-stone-500 dark:text-stone-400">
            The provider will start work. Track delivery and release payment from My projects.
          </p>
          <UButton to="/projects" color="primary" label="Go to My projects" class="mt-1" @click="emit('close')" />
        </div>

        <div v-else class="space-y-4 p-5">
          <div>
            <h2 class="font-serif text-2xl leading-tight">{{ service.title }}</h2>
            <NuxtLink
              v-if="service.provider?.member_id"
              :to="`/u/${service.provider.member_id}`"
              class="zc-tap mt-1 inline-block text-sm text-stone-500 hover:text-primary dark:text-stone-400"
            >
              {{ service.provider.full_name }} <span class="font-mono">{{ service.provider.member_id }}</span>
            </NuxtLink>
          </div>

          <p v-if="service.description" class="whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">
            {{ service.description }}
          </p>

          <!-- Tier picker -->
          <div>
            <p class="mb-2 text-sm font-medium">Choose a level</p>
            <div class="space-y-2">
              <button
                v-for="t in service.tiers"
                :key="t.id"
                type="button"
                class="zc-tap w-full rounded-xl border p-3 text-left transition"
                :class="selectedTier?.id === t.id ? 'border-primary ring-1 ring-primary' : 'border-stone-200 dark:border-stone-800'"
                @click="selectedTier = t"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium">{{ t.name }}</span>
                  <span class="font-semibold tabular-nums">RM {{ t.price_myr }}</span>
                </div>
                <p v-if="t.description" class="mt-1 text-sm text-stone-500 dark:text-stone-400">{{ t.description }}</p>
                <p v-if="deliveryLabel(t.delivery_minutes)" class="mt-1 flex items-center gap-1 text-xs text-stone-400">
                  <UIcon name="i-lucide-clock" class="size-3" /> {{ deliveryLabel(t.delivery_minutes) }} delivery
                </p>
              </button>
            </div>
          </div>

          <!-- Own service -->
          <p v-if="isOwnService" class="rounded-lg bg-stone-50 p-3 text-center text-sm text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">
            This is your service.
          </p>

          <!-- Order -->
          <template v-else-if="canOrder">
            <div>
              <p class="mb-2 text-sm font-medium">Pay with</p>
              <div class="grid grid-cols-2 gap-3">
                <button type="button" class="zc-tap rounded-xl border p-3 text-left transition" :class="method === 'touch_n_go' ? 'border-primary ring-1 ring-primary' : 'border-stone-200 dark:border-stone-800'" @click="method = 'touch_n_go'">
                  <UIcon name="i-lucide-wallet" class="size-5 text-primary" />
                  <div class="mt-1 text-sm font-medium">Touch 'n Go</div>
                </button>
                <button type="button" class="zc-tap rounded-xl border p-3 text-left transition" :class="method === 'binance' ? 'border-primary ring-1 ring-primary' : 'border-stone-200 dark:border-stone-800'" @click="method = 'binance'">
                  <UIcon name="i-lucide-coins" class="size-5 text-primary" />
                  <div class="mt-1 text-sm font-medium">Binance</div>
                </button>
              </div>
            </div>
            <UButton color="primary" block size="lg" class="zc-tap" :loading="ordering" :disabled="!selectedTier" :label="selectedTier ? `Order · RM ${selectedTier.price_myr}` : 'Select a level'" @click="order" />
            <p class="flex items-center justify-center gap-1.5 text-center text-xs text-stone-400">
              <UIcon name="i-lucide-lock" class="size-3" /> Funds held in escrow until you accept the work. Simulated — no real charge.
            </p>
          </template>

          <template v-else>
            <UButton v-if="!signedIn" to="/login" color="primary" block size="lg" label="Sign in to order" class="zc-tap" />
            <p v-else class="rounded-lg bg-stone-50 p-3 text-center text-sm text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">
              You can order once your account is approved.
            </p>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
