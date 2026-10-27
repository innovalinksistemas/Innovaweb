<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

defineProps<{ label: string; title: string; message: string }>();
const emit = defineEmits<{ confirm: [] }>();

const open = ref(false);
const busy = ref(false);
const cancelBtn = ref<HTMLButtonElement | null>(null);

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') open.value = false;
};

watch(open, async (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', onKey);
    await nextTick();
    cancelBtn.value?.focus();
  } else {
    window.removeEventListener('keydown', onKey);
  }
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

function confirm() {
  busy.value = true;
  emit('confirm');
}
</script>

<template>
  <button class="btn-danger" type="button" @click="open = true">{{ label }}</button>

  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" @click.self="open = false">
      <div class="card w-full max-w-sm" role="dialog" aria-modal="true">
        <h2 class="text-lg font-semibold">{{ title }}</h2>
        <p class="mt-2 text-sm text-slate-600">{{ message }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button ref="cancelBtn" class="btn-secondary" type="button" @click="open = false">Cancelar</button>
          <button class="btn bg-red-600 hover:bg-red-700" type="button" :disabled="busy" @click="confirm">Sí, eliminar</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
