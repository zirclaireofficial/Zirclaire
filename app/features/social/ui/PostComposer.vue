<script setup lang="ts">
// The post composer. Providers only — RLS enforces that too, this is just the
// UI half of the same rule so nobody stares at a form that will reject them.

import { useSocial } from '~/features/social/application/useSocial'
import { useMediaUpload } from '~/shared/lib/useMediaUpload'
import { useMe } from '~/features/auth/application/useMe'
import { MAX_POST_MEDIA, isPostPublishable } from '~/features/social/domain'

const emit = defineEmits<{ published: [] }>()

const { publishPost, screenPost } = useSocial()
const { upload } = useMediaUpload()
const { me } = useMe()
const toast = useToast()

// The wireframe identifies the author by member ID, so that's the byline.
const initials = computed(() => {
  const n = me.value?.full_name
  if (!n) return '?'
  return n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
})

const body = ref('')
const files = ref<File[]>([])
const previews = ref<string[]>([])
const posting = ref(false)

const canPost = computed(() => isPostPublishable(body.value, files.value.length))
const remaining = computed(() => MAX_POST_MEDIA - files.value.length)

function onPick(e: Event) {
  const picked = Array.from((e.target as HTMLInputElement).files ?? [])
  if (!picked.length) return
  const room = remaining.value
  if (picked.length > room) {
    toast.add({ title: `You can add ${MAX_POST_MEDIA} images at most`, color: 'warning' })
  }
  for (const f of picked.slice(0, room)) {
    files.value.push(f)
    previews.value.push(URL.createObjectURL(f))
  }
  ;(e.target as HTMLInputElement).value = ''
}

function removeAt(i: number) {
  URL.revokeObjectURL(previews.value[i]!)
  files.value.splice(i, 1)
  previews.value.splice(i, 1)
}

onBeforeUnmount(() => previews.value.forEach((u) => URL.revokeObjectURL(u)))

async function submit() {
  if (!canPost.value || posting.value) return
  posting.value = true
  try {
    const uploaded = await Promise.all(
      files.value.map(async (f) => {
        const up = await upload(f, 'post')
        return { media_url: up.publicId, media_type: 'image' }
      }),
    )
    const post = await publishPost({ body: body.value, media: uploaded })
    // AI sweeper screens it in the background (flag-only; never blocks the post).
    if (post?.id) screenPost(post.id).catch(() => {})
    toast.add({ title: 'Posted', description: "It's live on the feed.", color: 'success' })
    body.value = ''
    previews.value.forEach((u) => URL.revokeObjectURL(u))
    files.value = []
    previews.value = []
    emit('published')
    navigateTo('/')
  } catch (e) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not post', description: err?.message, color: 'error' })
  } finally {
    posting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Laid out as in the wireframe: member-ID byline, an attach (+) control,
         the prompt, then Send on the right. -->
    <div
      class="rounded-2xl border border-stone-200 bg-white p-4 transition focus-within:border-primary/60 dark:border-stone-800 dark:bg-stone-900"
    >
      <div class="flex items-center gap-2.5">
        <div class="flex size-9 items-center justify-center rounded-full bg-stone-900 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-900">
          {{ initials }}
        </div>
        <span class="font-mono text-sm text-stone-500 dark:text-stone-400">{{ me?.member_id ?? '' }}</span>
      </div>

      <label
        class="zc-tap mt-3 flex size-9 cursor-pointer items-center justify-center rounded-lg border border-stone-300 text-stone-500 transition hover:border-primary hover:text-primary dark:border-stone-700"
        :class="remaining ? '' : 'pointer-events-none opacity-40'"
        :title="remaining ? 'Attach an image' : 'Maximum images reached'"
      >
        <UIcon name="i-lucide-plus" class="size-5" />
        <span class="sr-only">Attach an image</span>
        <input type="file" accept="image/*" multiple class="hidden" @change="onPick" >
      </label>

      <textarea
        v-model="body"
        rows="6"
        placeholder="What's on your mind?"
        class="mt-3 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-stone-400"
      />

      <div v-if="previews.length" class="grid grid-cols-3 gap-2">
        <div v-for="(src, i) in previews" :key="src" class="relative">
          <img :src="src" alt="" class="aspect-square w-full rounded-lg object-cover" >
          <button
            type="button"
            class="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label="Remove image"
            @click="removeAt(i)"
          >
            <UIcon name="i-lucide-x" class="size-4" />
          </button>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-end gap-3">
        <span v-if="files.length" class="text-xs text-stone-400">{{ files.length }} / {{ MAX_POST_MEDIA }}</span>
        <UButton
          color="primary"
          class="zc-tap px-6"
          :loading="posting"
          :disabled="!canPost"
          :label="posting ? 'Sending…' : 'Send'"
          @click="submit"
        />
      </div>
    </div>

    <p class="text-center text-xs text-stone-400">Posts go live right away and can't be edited.</p>
  </div>
</template>
