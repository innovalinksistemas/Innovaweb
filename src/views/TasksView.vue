<script setup lang="ts">
import { computed, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import TaskTable from '@/components/TaskTable.vue';
import TaskModal from '@/components/TaskModal.vue';
import { supabase } from '@/lib/supabase';
import { label, memberName } from '@/lib/labels';
import { useQuery } from '@/lib/useQuery';
import { useQueryParam } from '@/lib/useQueryParam';
import { useTeam } from '@/lib/useTeam';
import { daysUntil } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { TASK_STATUSES, type TaskRow } from '@/lib/types';

const auth = useAuthStore();
const { team } = useTeam();

const { data, error, loading, reload } = useQuery<TaskRow[]>(() =>
  supabase
    .from('tasks')
    .select('*, projects(id, name, clients(name))')
    .order('due_date', { nullsFirst: false }),
);

// Filtros en la URL. Por defecto: mis tareas abiertas.
const assignee = useQueryParam('responsable', 'yo'); // 'yo' | 'todos' | 'sin' | <id>
const status = useQueryParam('estado', 'abiertas'); // 'abiertas' | 'todas' | <estado>
const overdueOnly = useQueryParam('vencidas');
const q = useQueryParam('q');

const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, baja: 3 } as const;

const rows = computed(() => {
  const me = auth.member?.id ?? null;
  const term = q.value.trim().toLowerCase();
  return (data.value ?? [])
    .filter((t) => {
      if (assignee.value === 'yo' && t.assignee_id !== me) return false;
      if (assignee.value === 'sin' && t.assignee_id) return false;
      if (!['yo', 'todos', 'sin'].includes(assignee.value) && t.assignee_id !== assignee.value) return false;
      if (status.value === 'abiertas' && t.status === 'completada') return false;
      if (!['abiertas', 'todas'].includes(status.value) && t.status !== status.value) return false;
      if (overdueOnly.value && !(t.status !== 'completada' && (daysUntil(t.due_date) ?? 0) < 0)) return false;
      return !term || [t.title, t.projects?.name, t.projects?.clients?.name].some((v) => v?.toLowerCase().includes(term));
    })
    .sort(
      (a, b) =>
        (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
});

const overdueCount = computed(
  () => (data.value ?? []).filter((t) => t.status !== 'completada' && (daysUntil(t.due_date) ?? 0) < 0).length,
);

const editing = ref<TaskRow | null>(null);
async function onSaved() {
  editing.value = null;
  await reload();
}
</script>

<template>
  <PageHeader title="Tareas" :subtitle="`${rows.length} tareas`" />
  <ErrorBox :message="error" />

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <input v-model="q" class="input max-w-xs" placeholder="Buscar tarea, proyecto o cliente…" />
    <select v-model="assignee" class="input w-auto">
      <option value="yo">Asignadas a mí</option>
      <option value="todos">Todo el equipo</option>
      <option value="sin">Sin asignar</option>
      <option v-for="m in team" :key="m.id" :value="m.id">{{ memberName(m) }}</option>
    </select>
    <select v-model="status" class="input w-auto">
      <option value="abiertas">Abiertas</option>
      <option value="todas">Todas</option>
      <option v-for="s in TASK_STATUSES" :key="s" :value="s">{{ label(s) }}</option>
    </select>
    <label class="flex items-center gap-2 text-sm" :class="overdueCount ? 'text-red-700' : 'text-slate-600'">
      <input type="checkbox" :checked="!!overdueOnly" @change="overdueOnly = ($event.target as HTMLInputElement).checked ? '1' : ''" />
      Solo vencidas ({{ overdueCount }})
    </label>
  </div>

  <LoadingState v-if="loading" />
  <TaskTable v-else :tasks="rows" show-project empty-text="No hay tareas con esos filtros." @open="editing = $event" />

  <TaskModal v-if="editing" :project-id="editing.project_id" :task="editing" @close="editing = null" @saved="onSaved" />
</template>
