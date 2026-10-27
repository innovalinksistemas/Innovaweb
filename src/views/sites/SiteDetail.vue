<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import SiteForm from '@/components/SiteForm.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import ExternalLink from '@/components/ExternalLink.vue';
import ConfirmDelete from '@/components/ConfirmDelete.vue';
import LoadingState from '@/components/LoadingState.vue';
import ExpensesPanel from '@/components/ExpensesPanel.vue';
import SiteAnalytics from '@/components/SiteAnalytics.vue';
import { useQueryParam } from '@/lib/useQueryParam';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/useQuery';
import { daysLabel, daysUntil, expiryTone, formatDate, toRecord } from '@/lib/utils';
import type { Client, Project, Site, SiteField } from '@/lib/types';

type SiteWithClient = Site & {
  clients: { id: string; name: string } | null;
  projects: Pick<Project, 'id' | 'name' | 'status' | 'due_date'>[];
};

const props = defineProps<{ id: string }>();
const router = useRouter();

const { data: site, error: loadError, loading, reload } = useQuery<SiteWithClient>(() =>
  supabase.from('sites').select('*, clients(id, name), projects(id, name, status, due_date)').eq('id', props.id).maybeSingle(),
);
const { data: clients } = useQuery<Pick<Client, 'id' | 'name'>[]>(() => supabase.from('clients').select('id, name').order('name'));

const view = useQueryParam('vista', 'resumen');
const editing = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);

// Para WordPress, si no hay URL de administración usamos /wp-admin.
const adminUrl = computed(() => {
  const s = site.value;
  if (!s) return null;
  return s.admin_url ?? (s.platform === 'wordpress' ? `${s.url.replace(/\/$/, '')}/wp-admin` : null);
});

const expiries = computed(() => {
  const s = site.value;
  if (!s) return [];
  return [
    { label: 'Dominio', date: s.domain_expiry_date, extra: s.domain_registrar },
    { label: 'Hosting', date: s.hosting_renewal_date, extra: s.hosting_provider },
  ].map((e) => ({ ...e, days: daysUntil(e.date) }));
});

async function save(values: Record<SiteField, string>) {
  busy.value = true;
  const { error: err } = await supabase.from('sites').update(toRecord(values)).eq('id', props.id);
  busy.value = false;
  if (err) return (error.value = err.message);
  error.value = null;
  editing.value = false;
  await reload();
}

async function remove() {
  const { error: err } = await supabase.from('sites').delete().eq('id', props.id);
  if (err) return (error.value = err.message);
  await router.push('/sitios');
}
</script>

<template>
  <LoadingState v-if="loading && !site" />
  <div v-else-if="!site" class="card text-sm">
    {{ loadError ?? 'Este sitio no existe.' }} <RouterLink class="link" to="/sitios">Volver a sitios</RouterLink>
  </div>
  <template v-else>
    <PageHeader :title="site.name" :subtitle="site.clients?.name">
      <ExternalLink :href="site.url" label="Ver sitio" />
    </PageHeader>
    <ErrorBox :message="error" />

    <nav class="mb-6 flex gap-1 border-b border-slate-200">
      <button
        v-for="t in [{ id: 'resumen', label: 'Resumen' }, { id: 'analitica', label: 'Analítica' }]"
        :key="t.id"
        type="button"
        class="-mb-px border-b-2 px-4 py-2 text-sm"
        :class="view === t.id ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="view = t.id"
      >
        {{ t.label }}
      </button>
    </nav>

    <SiteAnalytics v-if="view === 'analitica'" :site="site" @synced="reload" />

    <template v-else>
    <div class="mb-6 flex flex-wrap items-center gap-2">
      <AppBadge :value="site.platform" />
      <AppBadge :value="site.status" />
      <RouterLink v-if="site.clients" class="link text-sm" :to="`/clientes/${site.clients.id}`">Ver cliente</RouterLink>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <section class="card">
        <h2 class="mb-3 font-medium">Accesos rápidos</h2>
        <div class="flex flex-wrap gap-2">
          <ExternalLink :href="adminUrl" label="Administración" />
          <ExternalLink :href="site.hosting_panel_url" label="Hosting" />
          <ExternalLink :href="site.repo_url" label="Repositorio" />
          <ExternalLink :href="site.deploy_url" label="Deploy" />
          <ExternalLink :href="site.credentials_url" label="Credenciales" />
        </div>
      </section>

      <section class="card">
        <h2 class="mb-3 font-medium">Vencimientos</h2>
        <dl class="space-y-2 text-sm">
          <div v-for="e in expiries" :key="e.label" class="flex justify-between gap-2">
            <dt class="text-slate-500">
              {{ e.label }}
              <span v-if="e.extra" class="block text-xs">{{ e.extra }}</span>
            </dt>
            <dd class="text-right" :class="expiryTone(e.days)">
              {{ formatDate(e.date) }}
              <span class="block text-xs">{{ daysLabel(e.days) }}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="card text-sm">
        <h2 class="mb-3 font-medium">Analítica</h2>
        <template v-if="site.ga4_property_id">
          <p>GA4: <code class="rounded bg-slate-100 px-1">{{ site.ga4_property_id }}</code></p>
          <p v-if="site.ga4_last_error" class="mt-1 text-xs text-red-700">⚠ Error en la última sincronización</p>
          <p v-else class="mt-1 text-xs text-slate-500">{{ site.ga4_last_sync_at ? 'Sincronizado ' + formatDate(site.ga4_last_sync_at) : 'Aún sin sincronizar' }}</p>
          <button class="link mt-2 text-sm" type="button" @click="view = 'analitica'">Ver analítica →</button>
        </template>
        <p v-else class="text-slate-500">Sin propiedad GA4. Agrégala al editar el sitio.</p>
      </section>
    </div>

    <section v-if="site.notes" class="card mt-6 whitespace-pre-line text-sm">{{ site.notes }}</section>

    <section class="card mt-6">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-medium">Proyectos ({{ site.projects.length }})</h2>
        <RouterLink class="link text-sm" :to="`/proyectos/nuevo?cliente=${site.client_id}&sitio=${site.id}`">+ Nuevo proyecto</RouterLink>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="p in site.projects" :key="p.id" class="flex items-center justify-between gap-3 py-2 text-sm">
          <RouterLink class="link font-medium" :to="`/proyectos/${p.id}`">{{ p.name }}</RouterLink>
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span v-if="p.due_date">Entrega {{ formatDate(p.due_date) }}</span>
            <AppBadge :value="p.status" />
          </div>
        </li>
        <li v-if="site.projects.length === 0" class="py-4 text-sm text-slate-500">Este sitio aún no tiene proyectos.</li>
      </ul>
    </section>

    <section class="mt-6">
      <h2 class="mb-3 font-medium">Gastos del sitio (hosting, dominio, plugins…)</h2>
      <ExpensesPanel :site-id="site.id" :client-id="site.client_id" />
    </section>

    <div class="mt-6">
      <button class="link text-sm font-medium" type="button" @click="editing = !editing">
        {{ editing ? 'Cerrar edición' : 'Editar sitio' }}
      </button>
      <div v-if="editing" class="mt-3">
        <SiteForm :initial="site" :clients="clients ?? []" submit-label="Guardar cambios" :busy="busy" @submit="save" />
      </div>
    </div>

    <div class="mt-6">
      <ConfirmDelete label="Eliminar sitio" title="Eliminar sitio" message="Se eliminará este sitio. No se puede deshacer." @confirm="remove" />
    </div>
    </template>
  </template>
</template>
