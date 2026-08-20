<script setup lang="ts">
// Public site footer — carries the legally-required business identity so it's
// visible without logging in (needed for payment-gateway KYB verification and
// general transparency). An "info" disclosure reveals the registered company
// details; a second disclosure shows the full Terms below it.
const showInfo = ref(false)
const showTerms = ref(false)
const rules = ref('')
const year = new Date().getFullYear()

async function loadRules() {
  showTerms.value = !showTerms.value
  if (showTerms.value && !rules.value) {
    try { rules.value = await $fetch<string>('/rules.txt', { responseType: 'text' }) }
    catch { rules.value = 'Terms could not be loaded — please try again.' }
  }
}
</script>

<template>
  <footer class="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-600 dark:border-stone-800 dark:text-stone-300">
    <!-- What Zirclaire is + pricing (covers products / services / prices) -->
    <p class="font-serif text-lg text-stone-800 dark:text-stone-100">Zirclaire<span class="text-primary">.</span></p>
    <p class="mt-1 max-w-2xl text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">
      An escrow-backed marketplace for verified professionals: post and fund projects, order fixed-price
      services, and buy digital works. Project funds are held in escrow and released on completion. The
      platform fee is 20% on project and service work (the provider receives 80%), and 15% on royalty
      sales. Payments are processed securely through Xendit.
    </p>

    <!-- ℹ️ Business information -->
    <button
      class="zc-tap mt-4 flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-200"
      @click="showInfo = !showInfo"
    >
      <UIcon name="i-lucide-info" class="size-4 text-primary" />
      Business information
      <UIcon name="i-lucide-chevron-down" class="size-4 transition" :class="showInfo ? 'rotate-180' : ''" />
    </button>
    <div
      v-if="showInfo"
      class="mt-2 space-y-1 rounded-xl bg-stone-50 p-3 text-[13px] leading-relaxed dark:bg-stone-800/40"
    >
      <p class="font-medium text-stone-800 dark:text-stone-100">ZIRCLAIRE ENTERPRISE</p>
      <p>Business Registration No. 202603179161 (003867899-K)</p>
      <p>No 15, Tingkat 1, Persiaran Raja Muda Musa, 42000 Pelabuhan Klang, Selangor, Malaysia</p>
      <p>Email: <a href="mailto:zirclaireofficial@gmail.com" class="text-primary">zirclaireofficial@gmail.com</a></p>
      <p>Phone: <a href="tel:+601166336379" class="text-primary">+60 11-6633 6379</a></p>
    </div>

    <!-- Terms & Conditions (with Refund & Privacy inside) -->
    <button
      class="zc-tap mt-3 flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-200"
      @click="loadRules"
    >
      <UIcon name="i-lucide-file-text" class="size-4 text-primary" />
      Terms &amp; Conditions, Refund &amp; Privacy Policy
      <UIcon name="i-lucide-chevron-down" class="size-4 transition" :class="showTerms ? 'rotate-180' : ''" />
    </button>
    <div
      v-if="showTerms"
      class="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
    >{{ rules || 'Loading…' }}</div>

    <p class="mt-3 text-xs text-stone-400">
      A full-page version is available at
      <NuxtLink to="/legal" class="text-primary">/legal</NuxtLink>.
    </p>
    <p class="mt-4 text-xs text-stone-400">© {{ year }} ZIRCLAIRE ENTERPRISE. All rights reserved.</p>
  </footer>
</template>
