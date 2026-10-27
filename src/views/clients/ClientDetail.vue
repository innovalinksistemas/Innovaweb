<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import ClientForm from '@/components/ClientForm.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import ConfirmDelete from '@/components/ConfirmDelete.vue';
import LoadingState from '@/components/LoadingState.vue';
import InvoicesPanel from '@/components/InvoicesPanel.vue';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/useQuery';
import { formatDate, toRecord } from '@/lib/utils';
import type { Client, ClientField, Project, Site } from '@/lib/types';

type ClientWithSites = Client & {
  sites: Pick<Site, 'id' | 'name' | 'url' | 'platform' | 'status'>[];
  projects: Pick<Project, 'id' | 'name' | 'status' | 'due_date'>[];
};

const props = defineProps<{ id: string }>();
const router = useRouter();

const { data: client, error: loadError, loading, reload } = useQuery<ClientWithSites>(() =>
  supabase
    .from('clients')
    .select('*, sites(id, name, url, platform, status), projects(id, name, status, due_date)')
    .eq('id', props.id)
    .order('name', { referencedTable: 'sites' })
    .maybeSingle()
    ,
);

const editing = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);

async function save(values: Record<ClientField, string>) {
  busy.value = true;
  const { error: err } = await supabase.from('clients').update(toRecord(values)).eq('id', props.id);
  busy.value = false;
  if (err) return (error.value = err.message);
  error.value = null;
  editing.value = false;
  await reload();
}

async function remove() {
  const { error: err } = await supabase.from('clients').delete().eq('id', props.id);
  if (err) return (error.value = err.message);
  await router.push('/clientes');
}
</script>

<template>
  <LoadingState v-if="loading && !client" />
  <div v-else-if="!client" class="card text-sm">
    {{ loadError ?? 'Este cliente no existe.' }} <RouterLink class="link" to="/clientes">Volver a clientes</RouterLink>
  </div>
  <template v-else>
    <PageHeader :title="client.name" :subtitle="client.contact_name">
      <RouterLink class="btn" :to="`/sitios/nuevo?cliente=${client.id}`">+ Agregar sitio</RouterLink>
    </PageHeader>
    <ErrorBox :message="error" />

    <div class="grid gap-6 lg:grid-cols-3">
      <section class="card space-y-2 text-sm">
        <AppBadge :value="client.status" />
        <p><span class="text-slate-500">Correo:</span> {{ client.email ?? '—' }}</p>
        <p><span class="text-slate-500">Teléfono:</span> {{ client.phone ?? '—' }}</p>
        <p><span class="text-slate-500">RUC/RFC/NIT:</span> {{ client.tax_id ?? '—' }}</p>
        <p v-if="client.notes" class="whitespace-pre-line border-t border-slate-100 pt-2 text-slate-700">{{ client.notes }}</p>
      </section>

      <section class="card lg:col-span-2">
        <h2 class="mb-3 font-medium">Sitios ({{ client.sites.length }})</h2>
        <ul class="divide-y divide-slate-100">
          <li v-for="s in client.sites" :key="s.id" class="flex items-center justify-between gap-3 py-2">
            <div>
              <RouterLink class="link font-medium" :to="`/sitios/${s.id}`">{{ s.name }}</RouterLink>
              <span class="block text-xs text-slate-400">{{ s.url }}</span>
            </div>
            <div class="flex gap-1"><AppBadge :value="s.platform" /><AppBadge :value="s.status" /></div>
          </li>
          <li v-if="client.sites.length === 0" class="py-4 text-sm text-slate-500">Este cliente aún no tiene sitios.</li>
        </ul>
      </section>
    </div>

    <section class="card mt-6">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-medium">Proyectos ({{ client.projects.length }})</h2>
        <RouterLink class="link text-sm" :to="`/proyectos/nuevo?cliente=${client.id}`">+ Nuevo proyecto</RouterLink>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="p in client.projects" :key="p.id" class="flex items-center justify-between gap-3 py-2 text-sm">
          <RouterLink class="link font-medium" :to="`/proyectos/${p.id}`">{{ p.name }}</RouterLink>
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span v-if="p.due_date">Entrega {{ formatDate(p.due_date) }}</span>
            <AppBadge :value="p.status" />
          </div>
        </li>
        <li v-if="client.projects.length === 0" class="py-4 text-sm text-slate-500">Este cliente aún no tiene proyectos.</li>
      </ul>
    </section>

    <section class="mt-6">
      <h2 class="mb-3 font-medium">Facturación</h2>
      <InvoicesPanel :client-id="client.id" />
    </section>

    <div class="mt-6">
      <button class="link text-sm font-medium" type="button" @click="editing = !editing">
        {{ editing ? 'Cerrar edición' : 'Editar cliente' }}
      </button>
      <div v-if="editing" class="mt-3">
        <ClientForm :initial="client" submit-label="Guardar cambios" :busy="busy" @submit="save" />
      </div>
    </div>

    <div class="mt-6">
      <ConfirmDelete
        label="Eliminar cliente"
        title="Eliminar cliente"
        message="Se eliminará este cliente y todos sus sitios. No se puede deshacer."
        @confirm="remove"
      />
    </div>
  </template>
</template>
