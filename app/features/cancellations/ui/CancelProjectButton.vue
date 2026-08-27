<script setup lang="ts">
// SR-facing "Cancel project" trigger + modal. Enforces the 48h rule in the UI
// (server enforces it too) and explains what happens, in plain language — no
// mention of admins/master or the internal process.
import { useCancellations } from '../application/useCancellations'

const props = defineProps<{
  projectId: string
  title: string
  budget: number
  deadlineAt?: string | null
  hasProvider: boolean
}>()
const emit = defineEmits<{ (e: 'done'): void }>()

const { request } = useCancellations()
const toast = useToast()

const open = ref(false)
const reason = ref('')
const busy = ref(false)

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval>
onMounted(() => { timer = setInterval(() => (now.value = Date.now()), 30_000) })
onBeforeUnmount(() => clearInterval(timer))

// Within 48h of the deadline → not allowed.
const within48h = computed(() => {
  if (!props.deadlineAt) return false
  return new Date(props.deadlineAt).getTime() - now.value < 48 * 3_600_000
})
const timeLeft = computed(() => {
  if (!props.deadlineAt) return null
  const ms = new Date(props.deadlineAt).getTime() - now.value
  if (ms <= 0) return 'deadline passed'
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  return d > 0 ? `${d}d ${h % 24}h left` : `${h}h left`
})

async function submit() {
  if (!reason.value.trim()) { toast.add({ title: 'Please give a reason', color: 'warning' }); return }
  busy.value = true
  try {
    await request(props.projectId, reason.value.trim())
    toast.add({
      title: 'Cancellation requested',
      description: props.hasProvider
        ? 'The provider will be asked to agree. We\'ll keep you posted.'
        : 'Your refund is being processed.',
      color: 'success',
    })
    open.value = false
    reason.value = ''
    emit('done')
  } catch (e) {
    toast.add({ title: 'Could not request cancellation', description: (e as { message?: string })?.message, color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <UButton
      color="error"
      variant="soft"
      size="sm"
      block
      icon="i-lucide-x-circle"
      label="Cancel project"
      @click="open = true"
    />

    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
        @click.self="open = false"
      >
        <div class="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-stone-900 sm:rounded-2xl">
          <h2 class="font-serif text-xl leading-tight">Cancel this project?</h2>
          <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">{{ title }}</p>

          <dl class="mt-4 space-y-2 rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800/40">
            <div class="flex justify-between">
              <dt class="text-stone-500 dark:text-stone-400">Held in escrow</dt>
              <dd class="font-medium tabular-nums">RM {{ budget }}</dd>
            </div>
            <div v-if="timeLeft" class="flex justify-between">
              <dt class="text-stone-500 dark:text-stone-400">Deadline</dt>
              <dd class="font-medium">{{ timeLeft }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-stone-500 dark:text-stone-400">Refund if approved</dt>
              <dd class="font-medium tabular-nums">RM {{ (budget * 0.95).toFixed(2) }} <span class="text-xs text-stone-400">(5% fee)</span></dd>
            </div>
          </dl>

          <UAlert
            v-if="within48h"
            color="error"
            variant="soft"
            class="mt-3"
            icon="i-lucide-clock"
            title="Too close to the deadline"
            description="Projects can't be cancelled within 48 hours of the deadline."
          />

          <template v-else>
            <p class="mt-3 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
              <template v-if="hasProvider">
                The provider will be asked to agree. If they don't, Zirclaire will review and decide.
                If approved, 95% is refunded.
              </template>
              <template v-else>
                No provider has started this project, so you'll be refunded 95% (a 5% processing fee applies).
              </template>
            </p>

            <UFormField label="Reason for cancelling" class="mt-3">
              <UTextarea v-model="reason" :rows="3" placeholder="Tell us why you're cancelling…" class="w-full" />
            </UFormField>
          </template>

          <div class="mt-4 flex gap-2">
            <UButton color="neutral" variant="soft" class="flex-1" label="Keep project" @click="open = false" />
            <UButton
              color="error"
              class="flex-1"
              label="Request cancellation"
              :loading="busy"
              :disabled="within48h"
              @click="submit"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
