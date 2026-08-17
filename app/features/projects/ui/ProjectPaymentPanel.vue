<script setup lang="ts">
// The funding step, on its own so it can be reached from TWO places:
//  - straight after creating a project (ProjectCreateForm)
//  - later, from My projects, if the requester walked away mid-payment
// It owns no project state — it's handed a project and reports back.
//
// Typography here is deliberately sans-serif: this is a money screen, not
// editorial. Amounts use tabular figures so digits line up.

import { useProjectActions } from '~/features/projects/application/useProjectActions'
import type { Project } from '~/shared/types/database'

const props = defineProps<{
  project: Project
  /** Shown when resuming rather than continuing straight from creation. */
  resumed?: boolean
  /** A previous claim was rejected by the admin. */
  retry?: boolean
}>()

const emit = defineEmits<{ paid: [reference: string]; cancel: [] }>()

const { claimPayment, createInvoice } = useProjectActions()
const toast = useToast()

// Payment mode decides the flow: 'sandbox'/'live' -> real Xendit hosted page;
// 'simulator' -> the old instant fake-pay (kept as local/dev fallback).
const mode = useRuntimeConfig().public.paymentsMode as 'simulator' | 'sandbox' | 'live'
const isGateway = computed(() => mode === 'sandbox' || mode === 'live')

const method = ref<'touch_n_go' | 'binance'>('touch_n_go')
const paying = ref(false)

async function pay() {
  paying.value = true
  try {
    if (isGateway.value) {
      // Create a Xendit invoice and send the user to the hosted pay page.
      // Funding is confirmed by the webhook, not here.
      const res = await createInvoice(props.project.id, window.location.href)
      if (res.invoiceUrl) {
        window.location.href = res.invoiceUrl
        return
      }
      emit('paid', 'GATEWAY') // simulator fallback returned funded
    } else {
      await new Promise((r) => setTimeout(r, 1200)) // simulate the gateway
      const prefix = method.value === 'binance' ? 'BNB-' : 'TNG-'
      const reference = prefix + Math.random().toString(36).slice(2, 8).toUpperCase()
      await claimPayment(props.project.id, method.value, reference)
      emit('paid', reference)
    }
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Payment failed', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    paying.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">
        {{ retry ? 'Retry payment' : resumed ? 'Finish funding this project' : 'Fund your project' }}
      </h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
        <template v-if="retry">Your previous payment was not verified. Please submit it again.</template>
        <template v-else-if="resumed">You started this project but didn't complete payment. It stays private until it's funded.</template>
        <template v-else>Secure the budget in escrow so your project can go live.</template>
      </p>
    </div>

    <PaymentModeBadge />

    <div class="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-800/40">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[11px] uppercase tracking-wide text-stone-400">Project</div>
          <div class="truncate font-medium">{{ project.title }}</div>
        </div>
        <div class="text-right">
          <div class="text-[11px] uppercase tracking-wide text-stone-400">Amount due</div>
          <div class="text-2xl font-semibold tabular-nums">RM {{ project.budget_usd }}</div>
        </div>
      </div>
    </div>

    <div v-if="!isGateway">
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

    <UButton color="primary" block size="lg" :loading="paying" class="zc-tap" @click="pay">
      {{ paying ? 'Processing…' : isGateway ? `Pay RM ${project.budget_usd} securely` : `Pay RM ${project.budget_usd}` }}
    </UButton>

    <UButton
      v-if="resumed || retry"
      color="neutral"
      variant="ghost"
      block
      size="sm"
      label="Not now"
      @click="emit('cancel')"
    />

    <p class="flex items-center justify-center gap-1.5 text-center text-xs text-stone-400">
      <UIcon name="i-lucide-lock" class="size-3" />
      <template v-if="isGateway">You'll be taken to a secure payment page.</template>
      <template v-else>Simulated payment — no real charge.</template>
    </p>
  </div>
</template>
