<script setup lang="ts">
// Where ToyyibPay sends the payer after checkout. We confirm the payment with
// the server (which funds the project on the spot) so the user never has to
// wait for the background callback. Then we send them back where they were.
import { authedFetch } from '~/shared/lib/authedFetch'

const route = useRoute()
const billCode = computed(() => String(route.query.billcode ?? route.query.billCode ?? ''))
const backTo = computed(() => {
  const to = route.query.to
  return typeof to === 'string' && to.startsWith('/') ? to : '/projects'
})

const state = ref<'checking' | 'funded' | 'pending' | 'failed'>('checking')

async function confirm() {
  if (!billCode.value) { state.value = 'failed'; return }
  try {
    const res = await authedFetch<{ funded: boolean; status: string }>('/api/payments/verify-return', {
      method: 'POST', body: { billCode: billCode.value },
    })
    state.value = res.funded ? 'funded' : res.status === '3' ? 'failed' : 'pending'
  } catch {
    state.value = 'pending' // confirmed-but-funding-hiccup; backstop will apply it
  }
  // Head back after a beat so the user sees the result.
  setTimeout(() => navigateTo(backTo.value), state.value === 'funded' ? 1400 : 2600)
}
onMounted(confirm)
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
    <template v-if="state === 'checking'">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
      <p class="font-medium">Confirming your payment…</p>
      <p class="max-w-sm text-sm text-stone-500 dark:text-stone-400">Hold on a moment — this can take a few seconds.</p>
    </template>

    <template v-else-if="state === 'funded'">
      <div class="flex size-14 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-check" class="size-8 text-success" />
      </div>
      <p class="font-medium">Payment received — your project is funded and live.</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">Taking you back…</p>
    </template>

    <template v-else-if="state === 'pending'">
      <div class="flex size-14 items-center justify-center rounded-full bg-warning/10">
        <UIcon name="i-lucide-clock" class="size-8 text-warning" />
      </div>
      <p class="font-medium">We're still confirming your payment.</p>
      <p class="max-w-sm text-sm text-stone-500 dark:text-stone-400">
        If it went through, your project will fund automatically within a few minutes. You can safely leave this page.
      </p>
    </template>

    <template v-else>
      <div class="flex size-14 items-center justify-center rounded-full bg-error/10">
        <UIcon name="i-lucide-x" class="size-8 text-error" />
      </div>
      <p class="font-medium">That payment didn't go through.</p>
      <p class="max-w-sm text-sm text-stone-500 dark:text-stone-400">No money was taken. You can try funding the project again.</p>
    </template>

    <UButton :to="backTo" color="neutral" variant="soft" size="sm" label="Back to my projects" class="mt-2" />
  </div>
</template>
