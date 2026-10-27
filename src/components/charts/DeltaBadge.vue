<script setup lang="ts">
import { computed } from 'vue';

/** Variación vs periodo anterior: flecha + signo + color (nunca solo color). */
const props = defineProps<{ value: number | null; upIsGood?: boolean; suffix?: string }>();

const view = computed(() => {
  const v = props.value;
  if (v === null || !Number.isFinite(v)) return { text: 'sin comparación', tone: 'var(--viz-neutral)', icon: '' };
  if (Math.abs(v) < 0.005) return { text: '0%', tone: 'var(--viz-neutral)', icon: '→' };
  const good = (v > 0) === (props.upIsGood ?? true);
  return {
    text: `${v > 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`,
    tone: good ? 'var(--viz-good)' : 'var(--viz-bad)',
    icon: v > 0 ? '▲' : '▼',
  };
});
</script>

<template>
  <span class="inline-flex items-center gap-1 text-xs font-medium" :style="{ color: view.tone }">
    <span v-if="view.icon" aria-hidden="true">{{ view.icon }}</span>{{ view.text }}<span v-if="suffix" class="font-normal text-slate-500"> {{ suffix }}</span>
  </span>
</template>
