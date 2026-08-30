<script setup lang="ts">
// A provider's awarded project: the brief, an updates/chat thread with the
// requester, and the actions to drive the work forward (start, submit).
import { useProjectActions } from '~/features/projects/application/useProjectActions'
import { useMessaging } from '~/features/messaging/application/useMessaging'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import type { Database } from '~/shared/types/database'
import MessageThread from '~/features/messaging/ui/MessageThread.vue'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const { startWork, submitDeliverable } = useProjectActions()
const { openProjectThread } = useMessaging()
const { upload } = useMediaUpload()
const toast = useToast()

const currentUserId = computed(() => (user.value as { sub?: string } | null)?.sub ?? '')

type Row = Database['public']['Tables']['projects']['Row']
const project = ref<Row | null>(null)
const conversationId = ref<string | null>(null)
const loading = ref(true)
const busy = ref(false)

// Submit form
const showSubmit = ref(false)
const file = ref<File | null>(null)
const note = ref('')

const status = computed(() => project.value?.status ?? '')
const canStart = computed(() => status.value === 'awarded')
const canSubmit = computed(() => ['in_progress', 'revision_requested'].includes(status.value))
const submitted = computed(() => ['submitted_work', 'in_review'].includes(status.value))

async function load() {
  loading.value = true
  try {
    const [{ data: p }, thread] = await Promise.all([
      supabase.from('projects').select('*').eq('id', props.projectId).maybeSingle(),
      openProjectThread(props.projectId).catch(() => null),
    ])
    project.value = (p as Row) ?? null
    conversationId.value = thread?.conversation?.id ?? null
  } catch (e) {
    toast.add({ title: 'Could not load the project', description: (e as { message?: string })?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function begin() {
  busy.value = true
  try {
    await startWork(props.projectId)
    toast.add({ title: 'Work started', description: 'You can now submit your deliverable when ready.', color: 'success' })
    await load(); emit('changed')
  } catch (e) {
    toast.add({ title: 'Could not start', description: err(e), color: 'error' })
  } finally { busy.value = false }
}

function onFile(e: Event) { file.value = (e.target as HTMLInputElement).files?.[0] ?? null }

async function submit() {
  if (!file.value || busy.value) return
  busy.value = true
  try {
    const up = await upload(file.value, 'deliverable')
    const mediaType = file.value.type === 'application/pdf' ? 'pdf' : file.value.type.startsWith('video/') ? 'video' : 'file'
    await submitDeliverable(props.projectId, up.publicId, mediaType, note.value || null)
    toast.add({ title: 'Submitted', description: 'The requester will review it. They may accept or ask for changes.', color: 'success' })
    showSubmit.value = false; file.value = null; note.value = ''
    await load(); emit('changed')
  } catch (e) {
    toast.add({ title: 'Could not submit', description: err(e), color: 'error' })
  } finally { busy.value = false }
}

function err(e: unknown) {
  const x = e as { data?: { statusMessage?: string }; message?: string }
  return x?.data?.statusMessage ?? x?.message
}
const money = (n: number | string | null) => (n === null ? '—' : `RM ${Number(n).toFixed(2)}`)
const deadline = computed(() => project.value?.deadline_at ? new Date(project.value.deadline_at).toLocaleString() : null)
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end bg-black/60" @click.self="emit('close')">
      <div class="flex h-full w-full max-w-2xl flex-col bg-white dark:bg-stone-900">
        <div class="flex items-center justify-between border-b border-stone-200 px-5 py-3 dark:border-stone-800">
          <h2 class="font-medium">Your awarded project</h2>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Close" @click="emit('close')" />
        </div>

        <div v-if="loading" class="space-y-4 p-5">
          <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
        </div>

        <template v-else-if="project">
          <!-- Brief -->
          <div class="border-b border-stone-100 p-5 dark:border-stone-800">
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-serif text-xl leading-tight">{{ project.title }}</h3>
              <UBadge color="primary" variant="soft" size="sm" class="shrink-0 capitalize">{{ status.replace(/_/g, ' ') }}</UBadge>
            </div>
            <p v-if="project.description" class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              {{ project.description }}
            </p>
            <div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span class="text-stone-400">Budget:</span> <span class="tabular-nums font-medium">{{ money(project.budget_myr) }}</span></span>
              <span v-if="deadline"><span class="text-stone-400">Deadline:</span> {{ deadline }}</span>
            </div>
            <div v-if="project.requirements?.length" class="mt-2 text-sm">
              <span class="text-stone-400">Requirements:</span>
              <ul class="mt-1 list-inside list-decimal space-y-0.5">
                <li v-for="(r, i) in project.requirements" :key="i">{{ r }}</li>
              </ul>
            </div>
          </div>

          <!-- Updates + chat with the requester -->
          <div class="min-h-0 flex-1">
            <MessageThread
              v-if="conversationId"
              :conversation-id="conversationId"
              :current-user-id="currentUserId"
              title="Updates & messages"
              subtitle="Post progress or ask the requester a question"
            />
            <div v-else class="flex h-full items-center justify-center p-6 text-center text-sm text-stone-400">
              Couldn't open the conversation. Try reopening this project.
            </div>
          </div>

          <!-- Action bar -->
          <div class="border-t border-stone-200 p-4 dark:border-stone-800">
            <UButton v-if="canStart" color="primary" block size="lg" class="zc-tap" :loading="busy" icon="i-lucide-play" label="Start work" @click="begin" />

            <template v-else-if="canSubmit">
              <div v-if="showSubmit" class="space-y-3">
                <UFormField :label="status === 'revision_requested' ? 'Upload your revised deliverable' : 'Upload your deliverable'">
                  <input type="file" class="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm dark:file:bg-stone-800" @change="onFile" >
                </UFormField>
                <UFormField label="Note to the requester (optional)">
                  <UTextarea v-model="note" :rows="2" placeholder="Anything they should know about this submission" class="w-full" />
                </UFormField>
                <div class="flex gap-2">
                  <UButton color="neutral" variant="soft" label="Cancel" class="flex-1" @click="showSubmit = false" />
                  <UButton color="primary" class="flex-1 zc-tap" :loading="busy" :disabled="!file" label="Submit for review" @click="submit" />
                </div>
                <p class="text-center text-xs text-stone-400">The requester reviews your submission and can accept it or ask for changes. You can keep chatting and resubmit as needed.</p>
              </div>
              <UButton v-else color="primary" block size="lg" class="zc-tap" icon="i-lucide-upload" :label="status === 'revision_requested' ? 'Submit a revision' : 'Submit project'" @click="showSubmit = true" />
            </template>

            <div v-else-if="submitted" class="rounded-xl bg-stone-50 p-3 text-center text-sm text-stone-500 dark:bg-stone-800/40">
              <UIcon name="i-lucide-clock" class="mr-1 inline size-4" />
              Submitted — awaiting the requester's confirmation.
            </div>
          </div>
        </template>

        <div v-else class="p-8 text-center text-sm text-stone-500">Project not found.</div>
      </div>
    </div>
  </Teleport>
</template>
