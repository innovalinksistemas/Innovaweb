<script setup lang="ts">
import { computed } from 'vue';

/** Mini tendencia sin ejes. Gris para el contexto, el último punto en azul. */
const props = withDefaults(defineProps<{ values: number[]; width?: number; height?: number; label?: string }>(), {
  width: 96,
  height: 28,
});

const geo = computed(() => {
  const v = props.values;
  if (v.length < 2) return null;
  const max = Math.max(...v, 0);
  const min = Math.min(...v, 0);
  const span = max - min || 1;
  const pad = 4;
  const x = (i: number) => pad + (i / (v.length - 1)) * (props.width - pad * 2);
  const y = (val: number) => props.height - pad - ((val - min) / span) * (props.height - pad * 2);
  const d = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ');
  return { d, lastX: x(v.length - 1), lastY: y(v[v.length - 1]) };
});
</script>

<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="label ?? 'Tendencia'">
    <template v-if="geo">
      <path :d="geo.d" fill="none" stroke="var(--viz-axis)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
      <circle :cx="geo.lastX" :cy="geo.lastY" r="3" fill="var(--viz-series)" stroke="#fff" stroke-width="1.5" />
    </template>
  </svg>
</template>
