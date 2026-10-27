<script setup lang="ts">
import DeltaBadge from '@/components/charts/DeltaBadge.vue';
import Sparkline from '@/components/charts/Sparkline.vue';

defineProps<{
  label: string;
  value: string;
  delta: number | null;
  upIsGood?: boolean;
  trend?: number[];
  active?: boolean;
}>();
defineEmits<{ select: [] }>();
</script>

<template>
  <button
    type="button"
    class="card w-full p-4 text-left transition hover:border-indigo-300"
    :class="{ 'border-indigo-500 ring-1 ring-indigo-500': active }"
    :aria-pressed="active"
    @click="$emit('select')"
  >
    <p class="text-sm text-slate-500">{{ label }}</p>
    <p class="mt-1 text-2xl font-semibold">{{ value }}</p>
    <div class="mt-1 flex items-end justify-between gap-2">
      <DeltaBadge :value="delta" :up-is-good="upIsGood" suffix="vs anterior" />
      <Sparkline v-if="trend" :values="trend" :label="`Tendencia de ${label}`" />
    </div>
  </button>
</template>
