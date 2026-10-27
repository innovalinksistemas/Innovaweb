<script setup lang="ts">
import { computed } from 'vue';
import AppBadge from '@/components/AppBadge.vue';
import { memberName } from '@/lib/labels';
import { useTeam } from '@/lib/useTeam';
import { daysUntil, formatDate } from '@/lib/utils';
import type { Task } from '@/lib/types';

const props = defineProps<{ task: Task }>();
defineEmits<{ open: [task: Task] }>();

const { byId } = useTeam();
const assignee = computed(() => byId(props.task.assignee_id));
const days = computed(() => daysUntil(props.task.due_date));
const overdue = computed(() => props.task.status !== 'completada' && days.value !== null && days.value < 0);
</script>

<template>
  <button
    type="button"
    class="w-full cursor-grab rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-indigo-300 active:cursor-grabbing"
    :class="{ 'opacity-60': task.status === 'completada' }"
    @click="$emit('open', task)"
  >
    <p class="text-sm font-medium" :class="{ 'line-through': task.status === 'completada' }">{{ task.title }}</p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <AppBadge v-if="task.priority !== 'media'" :value="task.priority" />
      <span v-if="task.due_date" :class="overdue ? 'font-semibold text-red-700' : days !== null && days <= 2 ? 'text-amber-700' : ''">
        {{ overdue ? 'Vencida · ' : '' }}{{ formatDate(task.due_date) }}
      </span>
      <span class="ml-auto truncate" :class="{ 'italic text-slate-400': !assignee }">{{ memberName(assignee) }}</span>
    </div>
  </button>
</template>
