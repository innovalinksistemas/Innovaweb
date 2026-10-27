<script setup lang="ts">
defineProps<{ subtitle: string }>();
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <main class="card w-full max-w-sm">
      <h1 class="text-xl font-semibold text-slate-900">Innovaweb</h1>
      <p class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
      <slot />
    </main>
  </div>
</template>
