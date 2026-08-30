<script setup lang="ts">
// A slide-over that opens a project's buyer↔provider thread in place — the same
// updates/chat feed the provider sees, so the requester doesn't have to leave
// the projects page. Reuses MessageThread (text + any-file attachments).
import { useMessaging } from '~/features/messaging/application/useMessaging'
import MessageThread from './MessageThread.vue'

const props = defineProps<{ projectId: string; title?: string }>()
const emit = defineEmits<{ close: [] }>()

const { openProjectThread } = useMessaging()
const user = useSupabaseUser()
const toast = useToast()

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? '')
const conversationId = ref<string | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await openProjectThread(props.projectId)
    conversationId.value = res.conversation?.id ?? null
  } catch (e) {
    toast.add({ title: 'Could not open chat', description: (e as { data?: { statusMessage?: string } })?.data?.statusMessage, color: 'error' })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end bg-black/60" @click.self="emit('close')">
      <div class="flex h-full w-full max-w-xl flex-col bg-white dark:bg-stone-900">
        <div v-if="loading" class="flex flex-1 items-center justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-stone-400" />
        </div>
        <MessageThread
          v-else-if="conversationId"
          class="min-h-0 flex-1"
          :conversation-id="conversationId"
          :current-user-id="currentUserId"
          :title="title ?? 'Project chat'"
          subtitle="Updates & messages with the provider"
        >
          <template #actions>
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Close" @click="emit('close')" />
          </template>
        </MessageThread>
        <div v-else class="flex flex-1 items-center justify-center p-6 text-center text-sm text-stone-400">
          Couldn't open the conversation.
        </div>
      </div>
    </div>
  </Teleport>
</template>
