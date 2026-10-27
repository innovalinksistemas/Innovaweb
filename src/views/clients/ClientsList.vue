<script setup lang="ts">
import { computed, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/useQuery';
import type { Client } from '@/lib/types';

type Row = Pick<Client, 'id' | 'name' | 'contact_name' | 'email' | 'status'> & { sites: { count: number }[] };

const { data, error, loading } = useQuery<Row[]>(() =>
  supabase.from('clients').select('id, name, contact_name, email, status, sites(count)').order('name'),
);

// Búsqueda instantánea en el navegador (sin recargar).
const q = ref('');
const rows = computed(() => {
  const term = q.value.trim().toLowerCase();
  const list = data.value ?? [];
  return term ? list.filter((c) => [c.name, c.contact_name, c.email].some((v) => v?.toLowerCase().includes(term))) : list;
});
</script>

<template>
  <PageHeader title="Clientes" :subtitle="`${data?.length ?? 0} clientes`">
    <RouterLink class="btn" to="/clientes/nuevo">+ Nuevo cliente</RouterLink>
  </PageHeader>
  <ErrorBox :message="error" />

  <input v-model="q" class="input mb-4 max-w-xs" placeholder="Buscar cliente…" />

  <LoadingState v-if="loading" />
  <div v-else class="card overflow-x-auto p-0">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-4 py-3">Cliente</th>
          <th class="px-4 py-3">Contacto</th>
          <th class="px-4 py-3">Sitios</th>
          <th class="px-4 py-3">Estado</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="c in rows" :key="c.id" class="hover:bg-slate-50">
          <td class="px-4 py-3"><RouterLink class="link font-medium" :to="`/clientes/${c.id}`">{{ c.name }}</RouterLink></td>
          <td class="px-4 py-3 text-slate-600">
            {{ c.contact_name ?? '—' }}
            <span v-if="c.email" class="block text-xs text-slate-400">{{ c.email }}</span>
          </td>
          <td class="px-4 py-3">{{ c.sites[0]?.count ?? 0 }}</td>
          <td class="px-4 py-3"><AppBadge :value="c.status" /></td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="4" class="px-4 py-8 text-center text-slate-500">
            <template v-if="q">Ningún cliente coincide con “{{ q }}”.</template>
            <template v-else>Aún no hay clientes. <RouterLink class="link" to="/clientes/nuevo">Crea el primero</RouterLink>.</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
