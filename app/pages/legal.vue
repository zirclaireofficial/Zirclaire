<script setup lang="ts">
// Public legal page — Terms of Service, Refund Policy and Privacy Policy in one
// place (the full Rules & Regulations). No auth: reviewers and prospective
// users must be able to read it while logged out.
const rules = ref('')
onMounted(async () => {
  try { rules.value = await $fetch<string>('/rules.txt', { responseType: 'text' }) }
  catch { rules.value = 'The document could not be loaded. Please refresh the page.' }
})

useSeoMeta({
  title: 'Terms, Refund & Privacy — Zirclaire',
  description: 'Terms of Service, Payment & Refund Policy, and Privacy Policy for Zirclaire, operated by ZIRCLAIRE ENTERPRISE.',
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <h1 class="font-serif text-2xl leading-tight">Terms, Refund &amp; Privacy Policy</h1>

    <h2 class="mt-4 font-serif text-lg">Business information</h2>
    <div class="mt-2 space-y-1 rounded-xl bg-stone-50 p-4 text-sm dark:bg-stone-800/40">
      <p class="font-medium">ZIRCLAIRE ENTERPRISE</p>
      <p>Business Registration No. 202603179161 (003867899-K)</p>
      <p>No 15, Tingkat 1, Persiaran Raja Muda Musa, 42000 Pelabuhan Klang, Selangor, Malaysia</p>
      <p>Email: <a href="mailto:zirclaireofficial@gmail.com" class="text-primary">zirclaireofficial@gmail.com</a></p>
      <p>Phone: <a href="tel:+601166336379" class="text-primary">+60 11-6633 6379</a></p>
    </div>

    <div
      class="mt-5 whitespace-pre-wrap text-[13px] leading-relaxed text-stone-700 dark:text-stone-200"
    >{{ rules || 'Loading…' }}</div>

    <p class="mt-8 border-t border-stone-200 pt-4 text-xs text-stone-400 dark:border-stone-800">
      © {{ new Date().getFullYear() }} ZIRCLAIRE ENTERPRISE. All rights reserved.
    </p>
  </div>
</template>
