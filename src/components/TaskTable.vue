<script setup lang="ts">
import AppBadge from '@/components/AppBadge.vue';
import { memberName } from '@/lib/labels';
import { useTeam } from '@/lib/useTeam';
import { daysUntil, expiryTone, formatDate } from '@/lib/utils';
import type { Task, TaskRow } from '@/lib/types';

defineProps<{ tasks: TaskRow[]; showProject?: boolean; emptyText?: string }>();
const emit = defineEmits<{ open: [task: TaskRow] }>();

const { byId } = useTeam();
const dueTone = (t: Task) => (t.status === 'completada' ? 'text-slate-400' : expiryTone(daysUntil(t.due_date)));
</script>

<template>
  <div class="card overflow-x-auto p-0">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-4 py-3">Tarea</th>
          <th v-if="showProject" class="px-4 py-3">Proyecto</th>
          <th class="px-4 py-3">Estado</th>
          <th class="px-4 py-3">Prioridad</th>
          <th class="px-4 py-3">Responsable</th>
          <th class="px-4 py-3">Fecha límite</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="t in tasks" :key="t.id" class="cursor-pointer hover:bg-slate-50" @click="emit('open', t)">
          <td class="px-4 py-3 font-medium" :class="{ 'text-slate-400 line-through': t.status === 'completada' }">{{ t.title }}</td>
          <td v-if="showProject" class="px-4 py-3">
            <RouterLink v-if="t.projects" class="link" :to="`/proyectos/${t.projects.id}`" @click.stop>{{ t.projects.name }}</RouterLink>
            <span v-if="t.projects?.clients" class="block text-xs text-slate-400">{{ t.projects.clients.name }}</span>
          </td>
          <td class="px-4 py-3"><AppBadge :value="t.status" /></td>
          <td class="px-4 py-3"><AppBadge :value="t.priority" /></td>
          <td class="px-4 py-3" :class="{ 'italic text-slate-400': !t.assignee_id }">{{ memberName(byId(t.assignee_id)) }}</td>
          <td class="px-4 py-3" :class="dueTone(t)">{{ formatDate(t.due_date) }}</td>
        </tr>
        <tr v-if="tasks.length === 0">
          <td :colspan="showProject ? 6 : 5" class="px-4 py-8 text-center text-slate-500">{{ emptyText ?? 'No hay tareas.' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
