<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppModal from '@/components/AppModal.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import { supabase } from '@/lib/supabase';
import { memberName } from '@/lib/labels';
import { usePickers } from '@/lib/usePickers';
import { useTeam } from '@/lib/useTeam';
import { isoInDays, toForm, toRecord } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { TIME_ENTRY_FIELDS, type TimeEntry } from '@/lib/types';

/** Crea (sin id) o edita (con id) un registro de horas. `projectId` fija el proyecto. */
const props = defineProps<{ entry?: Partial<TimeEntry>; projectId?: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const auth = useAuthStore();
const { team } = useTeam();
const { projects, tasks } = usePickers({ tasks: true });

const isNew = !props.entry?.id;
const form = reactive(
  toForm(TIME_ENTRY_FIELDS, {
    entry_date: isoInDays(0),
    member_id: auth.member?.id,
    project_id: props.projectId,
    ...props.entry,
  }),
);
const billable = ref(props.entry?.billable ?? true);
const busy = ref(false);
const error = ref<string | null>(null);

const projectTasks = computed(() => tasks.value.filter((t) => t.project_id === form.project_id));
const activeProjects = computed(() =>
  projects.value.filter((p) => !['completado', 'cancelado'].includes(p.status) || p.id === form.project_id),
);
watch(
  () => form.project_id,
  () => {
    if (!projectTasks.value.some((t) => t.id === form.task_id)) form.task_id = '';
  },
);

async function save() {
  busy.value = true;
  error.value = null;
  const record = { ...toRecord(form), billable: billable.value };
  const { error: err } = isNew
    ? await supabase.from('time_entries').insert(record)
    : await supabase.from('time_entries').update(record).eq('id', props.entry!.id!);
  busy.value = false;
  if (err) return (error.value = err.message);
  emit('saved');
}

async function remove() {
  if (!window.confirm('¿Eliminar este registro de horas?')) return;
  const { error: err } = await supabase.from('time_entries').delete().eq('id', props.entry!.id!);
  if (err) return (error.value = err.message);
  emit('saved');
}
</script>

<template>
  <AppModal :title="isNew ? 'Registrar horas' : 'Editar horas'" wide @close="emit('close')">
    <ErrorBox :message="error" />
    <form class="grid gap-4 md:grid-cols-2" @submit.prevent="save">
      <div>
        <label class="label" for="te-project">Proyecto *</label>
        <select id="te-project" v-model="form.project_id" class="input" required :disabled="!!projectId">
          <option value="">Selecciona…</option>
          <option v-for="p in activeProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="te-task">Tarea (opcional)</label>
        <select id="te-task" v-model="form.task_id" class="input" :disabled="!form.project_id">
          <option value="">Ninguna</option>
          <option v-for="t in projectTasks" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="te-member">Persona</label>
        <select id="te-member" v-model="form.member_id" class="input" required>
          <option v-for="m in team" :key="m.id" :value="m.id">{{ memberName(m) }}</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label" for="te-date">Fecha</label>
          <input id="te-date" v-model="form.entry_date" class="input" type="date" required />
        </div>
        <div>
          <label class="label" for="te-hours">Horas *</label>
          <input id="te-hours" v-model="form.hours" class="input" type="number" min="0.01" max="24" step="0.25" required placeholder="1.5" />
        </div>
      </div>
      <div class="md:col-span-2">
        <label class="label" for="te-desc">¿Qué se hizo?</label>
        <textarea id="te-desc" v-model="form.description" class="input" rows="2" />
      </div>
      <label class="flex items-center gap-2 text-sm md:col-span-2">
        <input v-model="billable" type="checkbox" /> Facturable al cliente
      </label>
      <div class="flex items-center justify-between gap-2 md:col-span-2">
        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar' }}</button>
        <button v-if="!isNew" class="text-sm text-red-700 hover:underline" type="button" @click="remove">Eliminar registro</button>
      </div>
    </form>
  </AppModal>
</template>
