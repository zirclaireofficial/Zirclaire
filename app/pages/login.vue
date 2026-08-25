<script setup lang="ts">
import LoginForm from '~/features/auth/ui/LoginForm.vue'
definePageMeta({ layout: 'auth' })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="font-serif text-xl">Welcome back</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Sign in to your account.</p>
    </div>
    <LoginForm />
    <div class="space-y-1 text-center text-sm text-stone-500 dark:text-stone-400">
      <p>
        <NuxtLink to="/forgot" class="font-medium text-primary">Forgot your password?</NuxtLink>
      </p>
      <p>
        New here?
        <NuxtLink to="/signup" class="font-medium text-primary">Create an account</NuxtLink>
      </p>
    </div>

    <div class="border-t border-stone-200 pt-5 dark:border-stone-800">
      <ShellCompanyOverview />
    </div>
  </div>
</template>
