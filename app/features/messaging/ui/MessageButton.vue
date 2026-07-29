<script setup lang="ts">
// Opens (or reuses) the buyer↔provider thread for a project/order, then jumps
// to the inbox with it open. Shown to either party once a provider is awarded.

import { useMessaging } from '~/features/messaging/application/useMessaging'

const props = defineProps<{
  projectId: string
  label?: string
  block?: boolean
  size?: string
}>()

const { openProjectThread } = useMessaging()
const toast = useToast()
const busy = ref(false)

async function open() {
  busy.value = true
  try {
    const res = await openProjectThread(props.projectId)
    navigateTo(`/messages?c=${res.conversation.id}`)
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Could not open chat', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UButton
    color="neutral"
    variant="soft"
    :size="(size as any) ?? 'sm'"
    :block="block"
    icon="i-lucide-message-square"
    class="zc-tap"
    :loading="busy"
    :label="label ?? 'Message'"
    @click="open"
  />
</template>
