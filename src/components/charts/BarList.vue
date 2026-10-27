<script setup lang="ts">
import { computed } from 'vue';

/** Barras horizontales (una serie, magnitud): etiqueta arriba, valor al final de la barra. */
const props = defineProps<{ items: { label: string; value: number; hint?: string }[]; format?: (v: number) => string; empty?: string }>();

const max = computed(() => Math.max(...props.items.map((i) => i.value), 1));
const fmt = (v: number) => (props.format ? props.format(v) : v.toLocaleString('es'));
</script>

<template>
  <p v-if="!items.length" class="py-4 text-sm text-slate-500">{{ empty ?? 'Sin datos todavía.' }}</p>
  <ul v-else class="space-y-2.5">
    <li v-for="item in items" :key="item.label" class="group" :title="`${item.label}: ${fmt(item.value)}${item.hint ? ' · ' + item.hint : ''}`">
      <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span class="truncate" style="color: var(--viz-ink)">{{ item.label }}</span>
        <span class="shrink-0 font-medium" style="color: var(--viz-ink-2); font-variant-numeric: tabular-nums">{{ fmt(item.value) }}</span>
      </div>
      <div class="h-2.5 rounded-r" style="background: transparent">
        <div
          class="h-full rounded-r transition-opacity group-hover:opacity-80"
          style="background: var(--viz-series)"
          :style="{ width: `${Math.max(1, (item.value / max) * 100)}%` }"
        />
      </div>
    </li>
  </ul>
</template>
