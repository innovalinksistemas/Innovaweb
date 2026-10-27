<script setup lang="ts">
import { useTimerStore } from '@/stores/timer';

const timer = useTimerStore();
</script>

<template>
  <div v-if="timer.running" class="mx-3 mb-3 rounded-md border border-green-200 bg-green-50 p-3 text-xs">
    <p class="flex items-center gap-2 font-medium text-green-800">
      <span class="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Cronómetro
      <span class="ml-auto font-mono text-sm">{{ timer.elapsedLabel }}</span>
    </p>
    <p class="mt-1 truncate text-slate-600">
      <RouterLink v-if="timer.running.projects" class="hover:underline" :to="`/proyectos/${timer.running.projects.id}`">
        {{ timer.running.projects.name }}
      </RouterLink>
      <span v-if="timer.running.tasks"> · {{ timer.running.tasks.title }}</span>
    </p>
    <button class="mt-2 w-full rounded-md bg-green-600 px-2 py-1 font-medium text-white hover:bg-green-700" type="button" @click="timer.stop()">
      ■ Detener y guardar
    </button>
    <p v-if="timer.error" class="mt-1 text-red-700">{{ timer.error }}</p>
  </div>
</template>
