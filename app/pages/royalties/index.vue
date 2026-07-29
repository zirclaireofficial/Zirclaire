<script setup lang="ts">
import RoyaltyStore from '~/features/royalties/ui/RoyaltyStore.vue'

useSeoMeta({
  title: 'Royalties — Zirclaire',
  description: 'Buy novels, research and journals from verified authors on Zirclaire.',
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <RoyaltyStore />
  </div>
</template>
