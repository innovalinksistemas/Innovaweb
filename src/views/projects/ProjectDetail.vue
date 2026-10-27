<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import ProjectForm from '@/components/ProjectForm.vue';
import ConfirmDelete from '@/components/ConfirmDelete.vue';
import TaskBoard from '@/components/TaskBoard.vue';
import TaskTable from '@/components/TaskTable.vue';
import TaskModal from '@/components/TaskModal.vue';
import FollowUpFeed from '@/components/FollowUpFeed.vue';
import ProjectCosts from '@/components/ProjectCosts.vue';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/useQuery';
import { useQueryParam } from '@/lib/useQueryParam';
import { useTeam } from '@/lib/useTeam';
import { daysLabel, daysUntil, expiryTone, formatDate, toRecord } from '@/lib/utils';
import type { Client, FollowUp, Project, ProjectField, Site, Task } from '@/lib/types';

type ProjectFull = Project & {
  clients: { id: string; name: string } | null;
  sites: { id: string; name: string; url: string } | null;
};

const props = defineProps<{ id: string }>();
const router = useRouter();
useTeam(); // precarga el equipo para mostrar responsables

const { data: project, error: loadError, loading, reload } = useQuery<ProjectFull>(() =>
  supabase.from('projects').select('*, clients(id, name), sites(id, name, url)').eq('id', props.id).maybeSingle(),
);
const { data: tasks, reload: reloadTasks } = useQuery<Task[]>(() =>
  supabase.from('tasks').select('*').eq('project_id', props.id).order('position'),
);
const { data: followUps, reload: reloadFollowUps } = useQuery<FollowUp[]>(() =>
  supabase.from('follow_ups_with_author').select('*').eq('project_id', props.id).order('created_at', { ascending: false }),
);

const view = useQueryParam('vista', 'tablero');
const tabs = [
  { id: 'tablero', label: 'Tablero' },
  { id: 'lista', label: 'Lista' },
  { id: 'seguimientos', label: 'Seguimientos' },
  { id: 'costos', label: 'Costos' },
];

const error = ref<string | null>(null);
const progress = computed(() => {
  const list = tasks.value ?? [];
  return { done: list.filter((t) => t.status === 'completada').length, total: list.length };
});

// Panel lateral: puntos importantes y próximos pasos pendientes.
const important = computed(() =>
  (followUps.value ?? []).filter((f) => (f.pinned || f.kind === 'importante') && !f.done && f.kind !== 'proximo_paso'),
);
const nextSteps = computed(() =>
  (followUps.value ?? [])
    .filter((f) => f.kind === 'proximo_paso' && !f.done)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
);

async function markStepDone(f: FollowUp) {
  const { error: err } = await supabase.from('follow_ups').update({ done: true }).eq('id', f.id);
  if (err) error.value = err.message;
  await reloadFollowUps();
}

// Modal de tarea: null = cerrado; {} = nueva; Task = editar.
const editingTask = ref<Partial<Task> | null>(null);
async function onTaskSaved() {
  editingTask.value = null;
  await reloadTasks();
}

// Edición del proyecto
const editing = ref(false);
const busy = ref(false);
const { data: clients } = useQuery<Pick<Client, 'id' | 'name'>[]>(() => supabase.from('clients').select('id, name').order('name'));
const { data: sites } = useQuery<Pick<Site, 'id' | 'name' | 'client_id'>[]>(() => supabase.from('sites').select('id, name, client_id').order('name'));

async function save(values: Record<ProjectField, string>) {
  busy.value = true;
  const { error: err } = await supabase.from('projects').update(toRecord(values)).eq('id', props.id);
  busy.value = false;
  if (err) return (error.value = err.message);
  error.value = null;
  editing.value = false;
  await reload();
}

async function remove() {
  const { error: err } = await supabase.from('projects').delete().eq('id', props.id);
  if (err) return (error.value = err.message);
  await router.push('/proyectos');
}

const money = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

<template>
  <LoadingState v-if="loading && !project" />
  <div v-else-if="!project" class="card text-sm">
    {{ loadError ?? 'Este proyecto no existe.' }} <RouterLink class="link" to="/proyectos">Volver a proyectos</RouterLink>
  </div>
  <template v-else>
    <PageHeader :title="project.name">
      <button class="btn" type="button" @click="editingTask = {}">+ Nueva tarea</button>
    </PageHeader>
    <ErrorBox :message="error" />

    <!-- Resumen -->
    <div class="mb-6 grid gap-4 md:grid-cols-4">
      <div class="card text-sm">
        <AppBadge :value="project.status" />
        <p class="mt-2">
          <RouterLink v-if="project.clients" class="link" :to="`/clientes/${project.clients.id}`">{{ project.clients.name }}</RouterLink>
        </p>
        <p v-if="project.sites" class="text-xs">
          <RouterLink class="text-slate-500 hover:underline" :to="`/sitios/${project.sites.id}`">{{ project.sites.name }}</RouterLink>
        </p>
      </div>
      <div class="card text-sm">
        <p class="text-slate-500">Fechas</p>
        <p class="mt-1">{{ formatDate(project.start_date) }} → {{ formatDate(project.due_date) }}</p>
        <p v-if="project.due_date && project.status !== 'completado'" class="text-xs" :class="expiryTone(daysUntil(project.due_date))">
          Entrega {{ daysLabel(daysUntil(project.due_date)) }}
        </p>
      </div>
      <div class="card text-sm">
        <p class="text-slate-500">Avance</p>
        <div class="mt-2"><ProgressBar :done="progress.done" :total="progress.total" /></div>
      </div>
      <div class="card text-sm">
        <p class="text-slate-500">Presupuesto</p>
        <p class="mt-1 text-lg font-semibold">{{ money(project.budget) }}</p>
        <p class="text-xs text-slate-500">Tarifa/hora: {{ money(project.hourly_rate) }}</p>
      </div>
    </div>

    <p v-if="project.description" class="card mb-6 whitespace-pre-line text-sm">{{ project.description }}</p>

    <div class="grid gap-6" :class="{ 'xl:grid-cols-[1fr_18rem]': view !== 'costos' }">
      <!-- Contenido principal -->
      <div class="min-w-0">
        <nav class="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            class="-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm"
            :class="view === t.id ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
            @click="view = t.id"
          >
            {{ t.label }}
            <span v-if="t.id === 'seguimientos'" class="text-xs text-slate-400">({{ followUps?.length ?? 0 }})</span>
          </button>
        </nav>

        <TaskBoard
          v-if="view === 'tablero'"
          :project-id="project.id"
          :tasks="tasks ?? []"
          @open="editingTask = $event"
          @changed="reloadTasks"
          @error="error = $event"
        />
        <TaskTable v-else-if="view === 'lista'" :tasks="tasks ?? []" empty-text="Este proyecto aún no tiene tareas." @open="editingTask = $event" />
        <FollowUpFeed v-else-if="view === 'seguimientos'" :project-id="project.id" :items="followUps ?? []" @changed="reloadFollowUps" />
        <ProjectCosts v-else :project-id="project.id" />
      </div>

      <!-- Panel lateral -->
      <aside v-if="view !== 'costos'" class="space-y-4">
        <section class="card">
          <h2 class="mb-2 text-sm font-semibold">Próximos pasos</h2>
          <p v-if="nextSteps.length === 0" class="text-xs text-slate-500">Sin pasos pendientes.</p>
          <ul v-else class="space-y-2 text-sm">
            <li v-for="f in nextSteps" :key="f.id" class="flex gap-2">
              <input class="mt-1" type="checkbox" title="Marcar hecho" @change="markStepDone(f)" />
              <div>
                <p class="whitespace-pre-line">{{ f.content }}</p>
                <p v-if="f.due_date" class="text-xs" :class="expiryTone(daysUntil(f.due_date))">
                  {{ formatDate(f.due_date) }} · {{ daysLabel(daysUntil(f.due_date)) }}
                </p>
              </div>
            </li>
          </ul>
        </section>
        <section class="card">
          <h2 class="mb-2 text-sm font-semibold">Puntos importantes</h2>
          <p v-if="important.length === 0" class="text-xs text-slate-500">Fija un seguimiento o crea uno de tipo “Punto importante”.</p>
          <ul v-else class="space-y-2 text-sm">
            <li v-for="f in important" :key="f.id" class="whitespace-pre-line border-l-2 border-amber-400 pl-2">{{ f.content }}</li>
          </ul>
        </section>
        <button class="link text-sm" type="button" @click="view = 'seguimientos'">+ Agregar seguimiento</button>
      </aside>
    </div>

    <!-- Edición -->
    <div class="mt-8">
      <button class="link text-sm font-medium" type="button" @click="editing = !editing">
        {{ editing ? 'Cerrar edición' : 'Editar proyecto' }}
      </button>
      <div v-if="editing" class="mt-3">
        <ProjectForm :initial="project" :clients="clients ?? []" :sites="sites ?? []" submit-label="Guardar cambios" :busy="busy" @submit="save" />
      </div>
    </div>
    <div class="mt-6">
      <ConfirmDelete
        label="Eliminar proyecto"
        title="Eliminar proyecto"
        message="Se eliminará el proyecto con todas sus tareas y seguimientos. No se puede deshacer."
        @confirm="remove"
      />
    </div>

    <TaskModal v-if="editingTask" :project-id="project.id" :task="editingTask" @close="editingTask = null" @saved="onTaskSaved" />
  </template>
</template>
