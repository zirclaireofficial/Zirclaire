<script setup lang="ts">
// Vercel Speed Insights — collects real-user performance (Core Web Vitals).
// Only reports in production on Vercel; does nothing in local dev.
import { SpeedInsights } from '@vercel/speed-insights/nuxt'
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <SpeedInsights />
  </UApp>
</template>
