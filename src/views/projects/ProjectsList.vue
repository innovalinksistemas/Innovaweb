<script setup lang="ts">
import { computed } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import { supabase } from '@/lib/supabase';
import { label } from '@/lib/labels';
import { useQuery } from '@/lib/useQuery';
import { useQueryParam } from '@/lib/useQueryParam';
import { daysUntil, expiryTone, formatDate } from '@/lib/utils';
import { PROJECT_STATUSES, type Project, type TaskStatus } from '@/lib/types';

type Row = Project & {
  clients: { id: string; name: string } | null;
  sites: { id: string; name: string } | null;
  tasks: { status: TaskStatus }[];
};

const { data, error, loading } = useQuery<Row[]>(() =>
  supabase.from('projects').select('*, clients(id, name), sites(id, name), tasks(status)').order('due_date', { nullsFirst: false }),
);

const q = useQueryParam('q');
// "activos" = todo menos completados y cancelados.
const status = useQueryParam('estado', 'activos');
const clientId = useQueryParam('cliente');

const clients = computed(() => {
  const map = new Map<string, string>();
  for (const p of data.value ?? []) if (p.clients) map.set(p.clients.id, p.clients.name);
  return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
});

const rows = computed(() => {
  const term = q.value.trim().toLowerCase();
  return (data.value ?? [])
    .filter((p) => {
      if (status.value === 'activos' && (p.status === 'completado' || p.status === 'cancelado')) return false;
      if (status.value !== 'activos' && status.value && p.status !== status.value) return false;
      if (clientId.value && p.client_id !== clientId.value) return false;
      return !term || [p.name, p.clients?.name, p.sites?.name].some((v) => v?.toLowerCase().includes(term));
    })
    .map((p) => ({
      ...p,
      done: p.tasks.filter((t) => t.status === 'completada').length,
      total: p.tasks.length,
    }));
});
</script>

<template>
  <PageHeader title="Proyectos" :subtitle="`${rows.length} de ${data?.length ?? 0} proyectos`">
    <RouterLink class="btn" to="/proyectos/nuevo">+ Nuevo proyecto</RouterLink>
  </PageHeader>
  <ErrorBox :message="error" />

  <div class="mb-4 flex flex-wrap gap-2">
    <input v-model="q" class="input max-w-xs" placeholder="Buscar proyecto, cliente o sitio…" />
    <select v-model="status" class="input w-auto">
      <option value="activos">Activos</option>
      <option value="">Todos los estados</option>
      <option v-for="s in PROJECT_STATUSES" :key="s" :value="s">{{ label(s) }}</option>
    </select>
    <select v-model="clientId" class="input w-auto">
      <option value="">Todos los clientes</option>
      <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
    </select>
  </div>

  <LoadingState v-if="loading" />
  <div v-else class="card overflow-x-auto p-0">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-4 py-3">Proyecto</th>
          <th class="px-4 py-3">Cliente / sitio</th>
          <th class="px-4 py-3">Estado</th>
          <th class="px-4 py-3">Avance</th>
          <th class="px-4 py-3">Entrega</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="p in rows" :key="p.id" class="hover:bg-slate-50">
          <td class="px-4 py-3"><RouterLink class="link font-medium" :to="`/proyectos/${p.id}`">{{ p.name }}</RouterLink></td>
          <td class="px-4 py-3">
            {{ p.clients?.name ?? '—' }}
            <span v-if="p.sites" class="block text-xs text-slate-400">{{ p.sites.name }}</span>
          </td>
          <td class="px-4 py-3"><AppBadge :value="p.status" /></td>
          <td class="w-40 px-4 py-3"><ProgressBar :done="p.done" :total="p.total" /></td>
          <td class="px-4 py-3" :class="p.status === 'completado' ? 'text-slate-400' : expiryTone(daysUntil(p.due_date))">{{ formatDate(p.due_date) }}</td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="5" class="px-4 py-8 text-center text-slate-500">
            <template v-if="data?.length">No hay proyectos con esos filtros.</template>
            <template v-else>Aún no hay proyectos. <RouterLink class="link" to="/proyectos/nuevo">Crea el primero</RouterLink>.</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
