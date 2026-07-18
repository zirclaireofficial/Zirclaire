<script setup lang="ts">
import { useKycAdmin } from '~/features/kyc/application/useKycAdmin'
import type { Profile } from '~/shared/types/database'

const { listPending, approve, reject, signedMedia, publicMedia } = useKycAdmin()
const toast = useToast()

const pending = ref<Profile[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)

const rejectingId = ref<string | null>(null)
const rejectReason = ref('')

async function load() {
  loading.value = true
  try {
    pending.value = await listPending()
  } catch {
    toast.add({ title: 'Could not load the queue', color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function roleLabel(role: string) {
  return role === 'service_requester' ? 'Requester' : role === 'service_provider' ? 'Provider' : role
}

async function onApprove(p: Profile) {
  busy.value = p.id
  try {
    const res = await approve(p.id)
    toast.add({ title: 'Approved', description: `ID issued: ${res.profile.member_id}`, color: 'success' })
    pending.value = pending.value.filter((x) => x.id !== p.id)
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Approve failed', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}

async function confirmReject(p: Profile) {
  busy.value = p.id
  try {
    await reject(p.id, rejectReason.value)
    toast.add({ title: 'Application rejected', color: 'neutral' })
    pending.value = pending.value.filter((x) => x.id !== p.id)
    rejectingId.value = null
    rejectReason.value = ''
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({ title: 'Reject failed', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    busy.value = null
  }
}

const docUrl = ref<string | null>(null)
const docLoading = ref(false)

async function viewId(p: Profile) {
  if (!p.id_document_image) return
  docLoading.value = true
  try {
    docUrl.value = await signedMedia(p.id_document_image)
  } catch {
    toast.add({ title: 'Could not load document', color: 'error' })
  } finally {
    docLoading.value = false
  }
}

function onImgError() {
  toast.add({ title: 'Document failed to load', color: 'error' })
  docUrl.value = null
}
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="zc-card h-40 animate-pulse" />
    </div>

    <div v-else-if="!pending.length" class="flex flex-col items-center gap-2 py-20 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-success/10">
        <UIcon name="i-lucide-check" class="size-6 text-success" />
      </div>
      <p class="font-medium">All caught up</p>
      <p class="text-sm text-stone-500 dark:text-stone-400">No pending applications right now.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="p in pending" :key="p.id" class="zc-card p-4">
        <div class="flex items-center gap-3">
          <img
            v-if="p.profile_picture"
            :src="publicMedia(p.profile_picture)"
            :alt="p.full_name"
            class="size-11 rounded-full object-cover"
          >
          <div v-else class="flex size-11 items-center justify-center rounded-full bg-stone-200 font-medium dark:bg-stone-800">
            {{ initials(p.full_name) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate font-medium">{{ p.full_name }}</span>
              <UBadge color="neutral" variant="soft" size="sm">{{ roleLabel(p.role) }}</UBadge>
            </div>
            <p class="truncate text-xs text-stone-500 dark:text-stone-400">{{ p.email }}</p>
          </div>
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-stone-100 pt-3 text-sm dark:border-stone-800">
          <div><dt class="text-[11px] text-stone-400">Phone</dt><dd>{{ p.phone || '—' }}</dd></div>
          <div><dt class="text-[11px] text-stone-400">ID / passport</dt><dd>{{ p.id_document_number || '—' }}</dd></div>
          <div class="col-span-2"><dt class="text-[11px] text-stone-400">Address</dt><dd>{{ p.home_address || '—' }}</dd></div>
          <div><dt class="text-[11px] text-stone-400">Payout</dt><dd class="capitalize">{{ p.payout_provider?.replace('_', ' ') || '—' }}</dd></div>
          <div><dt class="text-[11px] text-stone-400">Account</dt><dd>{{ p.payout_account || '—' }}</dd></div>
        </dl>

        <div class="mt-4">
          <UButton
            v-if="p.id_document_image"
            icon="i-lucide-file-text"
            color="neutral"
            variant="outline"
            size="sm"
            label="View ID document"
            class="zc-tap"
            :loading="docLoading"
            @click="viewId(p)"
          />
        </div>

        <div v-if="rejectingId === p.id" class="mt-4 space-y-2">
          <UTextarea v-model="rejectReason" placeholder="Reason for rejection (optional)" :rows="2" class="w-full" />
          <div class="flex gap-2">
            <UButton color="error" size="sm" label="Confirm reject" :loading="busy === p.id" @click="confirmReject(p)" />
            <UButton color="neutral" variant="ghost" size="sm" label="Cancel" @click="rejectingId = null" />
          </div>
        </div>

        <div v-else class="mt-4 flex gap-2">
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-check"
            label="Approve"
            class="zc-tap flex-1"
            :loading="busy === p.id"
            @click="onApprove(p)"
          />
          <UButton
            color="error"
            variant="soft"
            size="sm"
            icon="i-lucide-x"
            label="Reject"
            class="zc-tap"
            @click="rejectingId = p.id; rejectReason = ''"
          />
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="docUrl"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        @click.self="docUrl = null"
      >
        <div class="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-2 dark:bg-stone-900">
          <button
            class="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white"
            aria-label="Close"
            @click="docUrl = null"
          >
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
          <img :src="docUrl" alt="ID document" class="w-full rounded-xl" @error="onImgError" >
        </div>
      </div>
    </Teleport>
  </div>
</template>

