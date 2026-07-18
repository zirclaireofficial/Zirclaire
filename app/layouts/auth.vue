<template>
  <div class="zc-canvas flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4 py-10 dark:bg-stone-950">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex flex-col items-center text-center">
        <ShellLogo :size="52" rounded="rounded-2xl" class="mb-3 shadow-lg shadow-stone-900/10" />
        <div class="font-serif text-3xl">Zirclaire<span class="text-primary">.</span></div>
        <p class="mt-1 text-xs text-stone-500 dark:text-stone-400">Empowered by MORATT INC</p>
      </div>
      <div class="zc-lift rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
        <slot />
      </div>
    </div>
  </div>
</template>
