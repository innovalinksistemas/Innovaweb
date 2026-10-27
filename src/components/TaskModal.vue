<script setup lang="ts">
import { reactive, ref } from 'vue';
import AppModal from '@/components/AppModal.vue';
import ConfirmDelete from '@/components/ConfirmDelete.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import { supabase } from '@/lib/supabase';
import { label, memberName } from '@/lib/labels';
import { useTeam } from '@/lib/useTeam';
import { toForm, toRecord } from '@/lib/utils';
import { TASK_FIELDS, TASK_PRIORITIES, TASK_STATUSES, type Task } from '@/lib/types';
import { useTimerStore } from '@/stores/timer';

/** Si `task` tiene id, edita; si no, crea una tarea nueva en `projectId`. */
const props = defineProps<{ projectId: string; task?: Partial<Task> }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const { team } = useTeam();
const isNew = !props.task?.id;
const form = reactive(toForm(TASK_FIELDS, { status: 'pendiente', priority: 'media', ...props.task }));
const busy = ref(false);
const error = ref<string | null>(null);

async function save() {
  busy.value = true;
  error.value = null;
  const record = toRecord(form);
  const { error: err } = isNew
    ? await supabase.from('tasks').insert({ ...record, project_id: props.projectId })
    : await supabase.from('tasks').update(record).eq('id', props.task!.id!);
  busy.value = false;
  if (err) return (error.value = err.message);
  emit('saved');
}

const timer = useTimerStore();
const timerRunningHere = () => timer.running?.task_id === props.task?.id;

async function toggleTimer() {
  if (timerRunningHere()) await timer.stop();
  else await timer.start(props.projectId, props.task!.id!, form.title);
  if (timer.error) error.value = timer.error;
}

async function remove() {
  const { error: err } = await supabase.from('tasks').delete().eq('id', props.task!.id!);
  if (err) return (error.value = err.message);
  emit('saved');
}
</script>

<template>
  <AppModal :title="isNew ? 'Nueva tarea' : 'Editar tarea'" wide @close="emit('close')">
    <ErrorBox :message="error" />
    <form class="grid gap-4 md:grid-cols-2" @submit.prevent="save">
      <div class="md:col-span-2">
        <label class="label" for="task-title">Título *</label>
        <input id="task-title" v-model="form.title" class="input" required autofocus />
      </div>
      <div class="md:col-span-2">
        <label class="label" for="task-description">Descripción</label>
        <textarea id="task-description" v-model="form.description" class="input" rows="4" />
      </div>
      <div>
        <label class="label" for="task-status">Estado</label>
        <select id="task-status" v-model="form.status" class="input">
          <option v-for="s in TASK_STATUSES" :key="s" :value="s">{{ label(s) }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="task-priority">Prioridad</label>
        <select id="task-priority" v-model="form.priority" class="input">
          <option v-for="p in TASK_PRIORITIES" :key="p" :value="p">{{ label(p) }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="task-assignee">Responsable</label>
        <select id="task-assignee" v-model="form.assignee_id" class="input">
          <option value="">Sin asignar</option>
          <option v-for="m in team" :key="m.id" :value="m.id">{{ memberName(m) }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="task-due">Fecha límite</label>
        <input id="task-due" v-model="form.due_date" class="input" type="date" />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 md:col-span-2">
        <div class="flex flex-wrap gap-2">
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Guardando…' : isNew ? 'Crear tarea' : 'Guardar cambios' }}</button>
          <button v-if="!isNew" class="btn-secondary" type="button" @click="toggleTimer">
            {{ timerRunningHere() ? `■ Detener (${timer.elapsedLabel})` : '▶ Iniciar cronómetro' }}
          </button>
        </div>
        <ConfirmDelete v-if="!isNew" label="Eliminar" title="Eliminar tarea" message="Se eliminará esta tarea. No se puede deshacer." @confirm="remove" />
      </div>
    </form>
  </AppModal>
</template>
