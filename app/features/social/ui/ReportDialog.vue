<script setup lang="ts">
// Basic reporting: pick a reason, add a note, file it. Deliberately simple —
// this exists so content can be flagged and reviewed by a human today. The
// AI screening pass plugs in later as a separate sweeper and doesn't change
// anything here.

import { useSocial } from '~/features/social/application/useSocial'

const props = defineProps<{
  target: 'post' | 'comment'
  targetId: string
}>()

const emit = defineEmits<{ close: []; filed: [] }>()

const { reportPost, reportComment } = useSocial()
const toast = useToast()

const REASONS = [
  'Spam or advertising',
  'Harassment or abuse',
  'Misleading or scam',
  'Inappropriate content',
  'Not professional conduct',
  'Something else',
]

const reason = ref<string>(REASONS[0]!)
const note = ref('')
const filing = ref(false)

async function submit() {
  filing.value = true
  try {
    const full = note.value.trim() ? `${reason.value} — ${note.value.trim()}` : reason.value
    if (props.target === 'post') await reportPost(props.targetId, full)
    else await reportComment(props.targetId, full)
    toast.add({
      title: 'Report submitted',
      description: 'An admin will review it. Thanks for flagging it.',
      color: 'success',
    })
    emit('filed')
    emit('close')
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not send report', description: err?.message, color: 'error' })
  } finally {
    filing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-stone-900 sm:rounded-2xl">
        <div class="mb-4 flex items-start gap-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UIcon name="i-lucide-flag" class="size-4 text-primary" />
          </div>
          <div>
            <h2 class="font-medium leading-tight">Report this {{ target }}</h2>
            <p class="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Only admins see reports. The author isn't told who reported them.
            </p>
          </div>
        </div>

        <div class="space-y-1.5">
          <label
            v-for="r in REASONS"
            :key="r"
            class="zc-tap flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition"
            :class="reason === r ? 'border-primary ring-1 ring-primary' : 'border-stone-200 dark:border-stone-800'"
          >
            <input v-model="reason" type="radio" :value="r" class="accent-primary" >
            {{ r }}
          </label>
        </div>

        <UTextarea
          v-model="note"
          :rows="2"
          placeholder="Anything else we should know? (optional)"
          class="mt-3 w-full"
        />

        <div class="mt-4 flex gap-2">
          <UButton
            color="primary"
            class="zc-tap flex-1"
            :loading="filing"
            label="Submit report"
            @click="submit"
          />
          <UButton color="neutral" variant="ghost" label="Cancel" @click="emit('close')" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
