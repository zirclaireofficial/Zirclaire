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
    <h1 class="font-serif text-2xl leading-tight">About, Services &amp; Legal</h1>

    <!-- Vision / mission / core business -->
    <div class="mt-4">
      <ShellCompanyOverview />
    </div>

    <!-- Products / services (public, for transparency + payment verification) -->
    <h2 class="mt-6 font-serif text-lg">Our services</h2>
    <ul class="mt-2 space-y-2 text-sm leading-relaxed text-stone-700 dark:text-stone-200">
      <li><span class="font-medium">Project marketplace</span> — requesters post and fully fund a project; a verified provider is selected, delivers the work, and the funds held in escrow are released on completion.</li>
      <li><span class="font-medium">Fixed-price services</span> — providers offer set-price services (with tiers); requesters order and pay upfront into escrow.</li>
      <li><span class="font-medium">Digital works store</span> — providers sell finished digital works (e.g. research, journals, e-books) at a fixed price for instant download.</li>
    </ul>

    <!-- Pricing / checkout -->
    <h2 class="mt-5 font-serif text-lg">Pricing &amp; payment</h2>
    <p class="mt-2 text-sm leading-relaxed text-stone-700 dark:text-stone-200">
      Buyers pay the price shown for each project, service, or digital work. Zirclaire charges a platform
      service fee of 20% on project and service work (the provider receives 80%); digital works are priced
      by the seller. All payments are processed securely at checkout through Xendit and — for projects and
      services — held in escrow until the work is completed. Approved cancellations are refunded per the
      Refund Policy below (a 5% administrative fee applies).
    </p>

    <h2 class="mt-6 font-serif text-lg">Business information</h2>
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
