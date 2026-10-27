<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ done: number; total: number }>();
const pct = computed(() => (props.total ? Math.round((props.done / props.total) * 100) : 0));
</script>

<template>
  <div>
    <div class="h-2 overflow-hidden rounded-full bg-slate-200">
      <div class="h-full rounded-full bg-indigo-500 transition-all" :style="{ width: `${pct}%` }" />
    </div>
    <p class="mt-1 text-xs text-slate-500">{{ total ? `${done}/${total} tareas · ${pct}%` : 'Sin tareas' }}</p>
  </div>
</template>
