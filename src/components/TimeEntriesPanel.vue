<script setup lang="ts">
import { computed, ref } from 'vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import TimeEntryModal from '@/components/TimeEntryModal.vue';
import { supabase } from '@/lib/supabase';
import { memberName } from '@/lib/labels';
import { hours, money, num } from '@/lib/money';
import { useQuery } from '@/lib/useQuery';
import { useTeam } from '@/lib/useTeam';
import { formatDate, isoInDays } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import type { TimeEntry, TimeEntryRow } from '@/lib/types';

/** Registro de horas. Con `projectId` muestra solo ese proyecto. */
const props = defineProps<{ projectId?: string }>();
const emit = defineEmits<{ changed: [] }>();

const auth = useAuthStore();
const { team, byId } = useTeam();

// Filtros: por defecto este mes y (fuera de un proyecto) solo mis horas.
const firstOfMonth = isoInDays(0).slice(0, 8) + '01';
const from = ref(props.projectId ? '' : firstOfMonth);
const to = ref('');
const member = ref(props.projectId ? '' : (auth.member?.id ?? ''));

const { data, error, loading, reload } = useQuery<TimeEntryRow[]>(
  () => {
    let q = supabase
      .from('time_entries')
      .select('*, projects(id, name), tasks(id, title)')
      .not('hours', 'is', null)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (props.projectId) q = q.eq('project_id', props.projectId);
    if (member.value) q = q.eq('member_id', member.value);
    if (from.value) q = q.gte('entry_date', from.value);
    if (to.value) q = q.lte('entry_date', to.value);
    return q;
  },
  [from, to, member],
);

const totals = computed(() => {
  const rows = data.value ?? [];
  return {
    hours: rows.reduce((s, r) => s + num(r.hours), 0),
    billable: rows.filter((r) => r.billable).reduce((s, r) => s + num(r.hours), 0),
    cost: rows.reduce((s, r) => s + num(r.hours) * num(r.cost_rate), 0),
  };
});

const editing = ref<Partial<TimeEntry> | null>(null);
async function onSaved() {
  editing.value = null;
  await reload();
  emit('changed');
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-end gap-2">
      <div>
        <label class="label" for="te-from">Desde</label>
        <input id="te-from" v-model="from" class="input w-auto" type="date" />
      </div>
      <div>
        <label class="label" for="te-to">Hasta</label>
        <input id="te-to" v-model="to" class="input w-auto" type="date" />
      </div>
      <div>
        <label class="label" for="te-member">Persona</label>
        <select id="te-member" v-model="member" class="input w-auto">
          <option value="">Todo el equipo</option>
          <option v-for="m in team" :key="m.id" :value="m.id">{{ memberName(m) }}</option>
        </select>
      </div>
      <button class="btn ml-auto" type="button" @click="editing = {}">+ Registrar horas</button>
    </div>

    <ErrorBox :message="error" />
    <LoadingState v-if="loading" />
    <div v-else class="card overflow-x-auto p-0">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Persona</th>
            <th v-if="!projectId" class="px-4 py-3">Proyecto</th>
            <th class="px-4 py-3">Tarea / descripción</th>
            <th class="px-4 py-3 text-right">Horas</th>
            <th class="px-4 py-3 text-right">Costo</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="r in data" :key="r.id" class="cursor-pointer hover:bg-slate-50" @click="editing = r">
            <td class="whitespace-nowrap px-4 py-3">{{ formatDate(r.entry_date) }}</td>
            <td class="px-4 py-3">{{ memberName(byId(r.member_id)) }}</td>
            <td v-if="!projectId" class="px-4 py-3">
              <RouterLink v-if="r.projects" class="link" :to="`/proyectos/${r.projects.id}?vista=costos`" @click.stop>{{ r.projects.name }}</RouterLink>
            </td>
            <td class="px-4 py-3">
              <span v-if="r.tasks" class="font-medium">{{ r.tasks.title }}</span>
              <span v-if="r.description" class="block text-xs text-slate-500">{{ r.description }}</span>
              <span v-if="!r.billable" class="text-xs text-slate-400">No facturable</span>
            </td>
            <td class="px-4 py-3 text-right font-medium">{{ hours(r.hours) }}</td>
            <td class="px-4 py-3 text-right" :class="{ 'text-amber-700': r.cost_rate == null }" :title="r.cost_rate == null ? 'Esta persona no tiene costo/hora configurado' : ''">
              {{ r.cost_rate == null ? 'sin costo' : money(num(r.hours) * num(r.cost_rate)) }}
            </td>
          </tr>
          <tr v-if="!data?.length">
            <td :colspan="projectId ? 5 : 6" class="px-4 py-8 text-center text-slate-500">No hay horas registradas en este periodo.</td>
          </tr>
        </tbody>
        <tfoot v-if="data?.length" class="border-t border-slate-200 bg-slate-50 font-medium">
          <tr>
            <td :colspan="projectId ? 3 : 4" class="px-4 py-3 text-right text-xs uppercase text-slate-500">
              Total · facturables {{ hours(totals.billable) }}
            </td>
            <td class="px-4 py-3 text-right">{{ hours(totals.hours) }}</td>
            <td class="px-4 py-3 text-right">{{ money(totals.cost) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <TimeEntryModal v-if="editing" :entry="editing" :project-id="projectId" @close="editing = null" @saved="onSaved" />
  </div>
</template>
