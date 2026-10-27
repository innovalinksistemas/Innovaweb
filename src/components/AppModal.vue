<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

defineProps<{ title: string; wide?: boolean }>();
const emit = defineEmits<{ close: [] }>();

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close');
};
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-10" @click.self="emit('close')">
      <div class="card w-full" :class="wide ? 'max-w-2xl' : 'max-w-md'" role="dialog" aria-modal="true">
        <div class="mb-4 flex items-start justify-between gap-4">
          <h2 class="text-lg font-semibold">{{ title }}</h2>
          <button class="text-xl leading-none text-slate-400 hover:text-slate-600" type="button" aria-label="Cerrar" @click="emit('close')">×</button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
