<script setup lang="ts">
import SignupForm from '~/features/kyc/ui/SignupForm.vue'
definePageMeta({ layout: 'auth' })
</script>

<template>
  <div class="space-y-6">
    <SignupForm />
    <p class="text-center text-sm text-stone-500 dark:text-stone-400">
      Already have an account?
      <NuxtLink to="/login" class="font-medium text-primary">Sign in</NuxtLink>
    </p>
  </div>
</template>
