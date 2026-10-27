<script setup lang="ts">
import { computed } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/useQuery';
import { useQueryParam } from '@/lib/useQueryParam';
import { PLATFORMS, SITE_STATUSES, type Site } from '@/lib/types';
import { daysUntil, expiryTone, formatDate } from '@/lib/utils';

type Row = Pick<Site, 'id' | 'name' | 'url' | 'platform' | 'status' | 'domain_expiry_date' | 'hosting_renewal_date'> & {
  clients: { id: string; name: string } | null;
};

const { data, error, loading } = useQuery<Row[]>(() =>
  supabase
    .from('sites')
    .select('id, name, url, platform, status, domain_expiry_date, hosting_renewal_date, clients(id, name)')
    .order('name')
    ,
);

// Los filtros viven en la URL (?q=&plataforma=&estado=) para poder compartir el enlace.
const q = useQueryParam('q');
const platform = useQueryParam('plataforma');
const status = useQueryParam('estado');

const rows = computed(() => {
  const term = q.value.trim().toLowerCase();
  return (data.value ?? []).filter(
    (s) =>
      (!platform.value || s.platform === platform.value) &&
      (!status.value || s.status === status.value) &&
      (!term || [s.name, s.url, s.clients?.name].some((v) => v?.toLowerCase().includes(term))),
  );
});
</script>

<template>
  <PageHeader title="Sitios" :subtitle="`${rows.length} de ${data?.length ?? 0} sitios`">
    <RouterLink class="btn" to="/sitios/nuevo">+ Nuevo sitio</RouterLink>
  </PageHeader>
  <ErrorBox :message="error" />

  <div class="mb-4 flex flex-wrap gap-2">
    <input v-model="q" class="input max-w-xs" placeholder="Buscar por nombre, URL o cliente…" />
    <select v-model="platform" class="input w-auto capitalize">
      <option value="">Todas las plataformas</option>
      <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
    </select>
    <select v-model="status" class="input w-auto capitalize">
      <option value="">Todos los estados</option>
      <option v-for="s in SITE_STATUSES" :key="s" :value="s">{{ s }}</option>
    </select>
  </div>

  <LoadingState v-if="loading" />
  <div v-else class="card overflow-x-auto p-0">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-4 py-3">Sitio</th>
          <th class="px-4 py-3">Cliente</th>
          <th class="px-4 py-3">Plataforma</th>
          <th class="px-4 py-3">Estado</th>
          <th class="px-4 py-3">Dominio vence</th>
          <th class="px-4 py-3">Hosting renueva</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="s in rows" :key="s.id" class="hover:bg-slate-50">
          <td class="px-4 py-3">
            <RouterLink class="link font-medium" :to="`/sitios/${s.id}`">{{ s.name }}</RouterLink>
            <span class="block text-xs text-slate-400">{{ s.url }}</span>
          </td>
          <td class="px-4 py-3">
            <RouterLink v-if="s.clients" class="hover:underline" :to="`/clientes/${s.clients.id}`">{{ s.clients.name }}</RouterLink>
            <span v-else>—</span>
          </td>
          <td class="px-4 py-3"><AppBadge :value="s.platform" /></td>
          <td class="px-4 py-3"><AppBadge :value="s.status" /></td>
          <td class="px-4 py-3" :class="expiryTone(daysUntil(s.domain_expiry_date))">{{ formatDate(s.domain_expiry_date) }}</td>
          <td class="px-4 py-3" :class="expiryTone(daysUntil(s.hosting_renewal_date))">{{ formatDate(s.hosting_renewal_date) }}</td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="6" class="px-4 py-8 text-center text-slate-500">
            <template v-if="data?.length">No hay sitios con esos filtros.</template>
            <template v-else>Aún no hay sitios. <RouterLink class="link" to="/sitios/nuevo">Agrega el primero</RouterLink>.</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
