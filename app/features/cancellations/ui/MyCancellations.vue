<script setup lang="ts">
// Party-facing panel: any cancellation the current user is involved in, with
// the right action for their side. Shown at the top of /projects for both the
// requester and the provider. Invisible when there's nothing in flight.
import { useCancellations, userStatusLabel } from '../application/useCancellations'
import type { CancellationRequest } from '../application/useCancellations'
import DisputeChat from './DisputeChat.vue'

const { mine, respond, appeal } = useCancellations()
const user = useSupabaseUser()
const toast = useToast()

const items = ref<CancellationRequest[]>([])
const busyId = ref<string | null>(null)
const appealFor = ref<string | null>(null)
const appealReason = ref('')

function myId(): string | null {
  const u = user.value as unknown as { id?: string; sub?: string } | null
  return u?.id ?? u?.sub ?? null
}
const OPEN = ['pending_provider', 'in_arbitration', 'awaiting_appeal', 'appealed']

async function load() {
  items.value = (await mine()).filter((r) => OPEN.includes(r.status))
}
onMounted(load)

const iAmProvider = (r: CancellationRequest) => myId() === r.provider_id
const chatVisible = (r: CancellationRequest) =>
  ['in_arbitration', 'awaiting_appeal', 'appealed'].includes(r.status)

async function providerRespond(r: CancellationRequest, accept: boolean) {
  busyId.value = r.id
  try {
    await respond(r.id, accept)
    toast.add({
      title: accept ? 'Cancellation accepted' : 'Cancellation declined',
      description: accept ? 'The project will be cancelled and refunded.' : 'Zirclaire will review it.',
      color: accept ? 'success' : 'neutral',
    })
    await load()
  } catch (e) {
    toast.add({ title: 'Could not respond', description: (e as { message?: string })?.message, color: 'error' })
  } finally { busyId.value = null }
}

async function submitAppeal(r: CancellationRequest) {
  if (!appealReason.value.trim()) { toast.add({ title: 'Add a reason for your appeal', color: 'warning' }); return }
  busyId.value = r.id
  try {
    await appeal(r.id, appealReason.value.trim())
    toast.add({ title: 'Appeal submitted', description: 'Zirclaire will take a final look.', color: 'success' })
    appealFor.value = null; appealReason.value = ''
    await load()
  } catch (e) {
    toast.add({ title: 'Could not appeal', description: (e as { message?: string })?.message, color: 'error' })
  } finally { busyId.value = null }
}
</script>

<template>
  <div v-if="items.length" class="mb-4 space-y-3">
    <article
      v-for="r in items"
      :key="r.id"
      class="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
    >
      <div class="flex items-center justify-between gap-2">
        <h3 class="flex items-center gap-1.5 font-medium">
          <UIcon name="i-lucide-x-circle" class="size-4 text-amber-600" />
          Cancellation — {{ r.projects?.title ?? 'Project' }}
        </h3>
        <UBadge :color="(userStatusLabel(r).color as any)" variant="soft" size="sm">
          {{ userStatusLabel(r).label }}
        </UBadge>
      </div>

      <p class="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
        <span class="font-medium">Reason:</span> {{ r.reason }}
      </p>

      <!-- Provider: accept or reject -->
      <div v-if="iAmProvider(r) && r.status === 'pending_provider'" class="mt-3 flex gap-2">
        <UButton
          color="primary" size="sm" class="flex-1" label="Accept cancellation"
          :loading="busyId === r.id" @click="providerRespond(r, true)"
        />
        <UButton
          color="neutral" variant="soft" size="sm" class="flex-1" label="Decline"
          :loading="busyId === r.id" @click="providerRespond(r, false)"
        />
      </div>
      <p v-else-if="!iAmProvider(r) && r.status === 'pending_provider'" class="mt-2 text-xs text-stone-500">
        Waiting for the provider to respond.
      </p>

      <!-- Either party: appeal the decision within the window -->
      <div v-if="r.status === 'awaiting_appeal'" class="mt-3">
        <div v-if="appealFor !== r.id">
          <p class="mb-2 text-xs text-stone-500 dark:text-stone-400">
            A decision has been made. If you disagree, you can appeal for a final review.
          </p>
          <UButton color="primary" variant="soft" size="sm" label="Appeal decision" @click="appealFor = r.id" />
        </div>
        <div v-else class="space-y-2">
          <UTextarea v-model="appealReason" :rows="2" placeholder="Why are you appealing?" class="w-full" />
          <div class="flex gap-2">
            <UButton color="primary" size="sm" label="Submit appeal" :loading="busyId === r.id" @click="submitAppeal(r)" />
            <UButton color="neutral" variant="ghost" size="sm" label="Cancel" @click="appealFor = null" />
          </div>
        </div>
      </div>

      <!-- Private line to Zirclaire while under review -->
      <div v-if="chatVisible(r)" class="mt-3">
        <p class="mb-1.5 flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-stone-400">
          <UIcon name="i-lucide-shield" class="size-3.5" /> Zirclaire Review Team
        </p>
        <DisputeChat :request-id="r.id" mode="user" />
      </div>
    </article>
  </div>
</template>
