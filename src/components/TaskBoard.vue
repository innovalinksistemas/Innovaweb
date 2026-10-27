<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import TaskCard from '@/components/TaskCard.vue';
import { supabase } from '@/lib/supabase';
import { label } from '@/lib/labels';
import { TASK_STATUSES, type Task, type TaskStatus } from '@/lib/types';

const props = defineProps<{ projectId: string; tasks: Task[] }>();
const emit = defineEmits<{ open: [task: Task]; changed: []; error: [message: string] }>();

// Copia local por columna para que el arrastre se vea al instante.
const columns = reactive(Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as Task[]])) as Record<TaskStatus, Task[]>);
watch(
  () => props.tasks,
  (tasks) => {
    for (const s of TASK_STATUSES) {
      columns[s] = tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position);
    }
  },
  { immediate: true },
);

/** Guarda el orden (y el estado) de una columna después de soltar una tarjeta. */
async function persist(status: TaskStatus) {
  const list = columns[status];
  list.forEach((t) => (t.status = status));
  const { error } = await supabase.rpc('reorder_tasks', {
    p_project: props.projectId,
    p_status: status,
    p_ids: list.map((t) => t.id),
  });
  if (error) emit('error', error.message);
  emit('changed');
}

// Agregar tarea rápida al final de una columna.
const quickTitle = reactive(Object.fromEntries(TASK_STATUSES.map((s) => [s, ''])) as Record<TaskStatus, string>);
const adding = ref<TaskStatus | null>(null);

async function quickAdd(status: TaskStatus) {
  const title = quickTitle[status].trim();
  if (!title) return;
  const { error } = await supabase.from('tasks').insert({ project_id: props.projectId, title, status });
  if (error) return emit('error', error.message);
  quickTitle[status] = '';
  emit('changed');
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <section v-for="status in TASK_STATUSES" :key="status" class="flex flex-col rounded-lg bg-slate-200/60 p-3">
      <header class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-700">{{ label(status) }}</h3>
        <span class="rounded-full bg-white px-2 text-xs text-slate-500">{{ columns[status].length }}</span>
      </header>

      <VueDraggable
        v-model="columns[status]"
        group="tasks"
        :animation="150"
        ghost-class="opacity-40"
        class="flex min-h-16 flex-1 flex-col gap-2"
        @add="persist(status)"
        @update="persist(status)"
      >
        <TaskCard v-for="t in columns[status]" :key="t.id" :task="t" @open="emit('open', $event)" />
      </VueDraggable>

      <form v-if="adding === status" class="mt-2" @submit.prevent="quickAdd(status)">
        <input
          v-model="quickTitle[status]"
          class="input"
          placeholder="Título y Enter…"
          autofocus
          @keydown.esc="adding = null"
          @blur="!quickTitle[status] && (adding = null)"
        />
      </form>
      <button v-else class="mt-2 rounded-md px-2 py-1 text-left text-sm text-slate-500 hover:bg-white/70" type="button" @click="adding = status">
        + Agregar tarea
      </button>
    </section>
  </div>
</template>
