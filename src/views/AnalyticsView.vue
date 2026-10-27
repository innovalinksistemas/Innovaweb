<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import Ga4Setup from '@/components/Ga4Setup.vue';
import DeltaBadge from '@/components/charts/DeltaBadge.vue';
import Sparkline from '@/components/charts/Sparkline.vue';
import { supabase } from '@/lib/supabase';
import { isoInDays } from '@/lib/utils';
import { change, compact, METRICS, splitPeriods, summarize, syncGa4, type DailyRow, type MetricKey, type SyncResult } from '@/lib/analytics';

type SiteRow = {
  id: string;
  name: string;
  url: string;
  ga4_property_id: string | null;
  ga4_last_sync_at: string | null;
  ga4_last_error: string | null;
  clients: { name: string } | null;
};

const range = ref<7 | 30 | 90>(30);
const sortBy = ref<MetricKey>('active_users');
const loading = ref(true);
const error = ref<string | null>(null);
const sites = ref<SiteRow[]>([]);
const daily = ref<DailyRow[]>([]);

async function load() {
  loading.value = true;
  const [s, d] = await Promise.all([
    supabase.from('sites').select('id, name, url, ga4_property_id, ga4_last_sync_at, ga4_last_error, clients(name)').neq('status', 'archivado').order('name'),
    supabase.from('analytics_daily').select('*').gte('date', isoInDays(-179)).order('date'),
  ]);
  error.value = s.error?.message ?? d.error?.message ?? null;
  sites.value = (s.data ?? []) as unknown as SiteRow[];
  daily.value = (d.data ?? []) as DailyRow[];
  loading.value = false;
}
onMounted(load);

const connected = computed(() => sites.value.filter((s) => s.ga4_property_id));
const pending = computed(() => sites.value.filter((s) => !s.ga4_property_id));

const rows = computed(() => {
  const bySite = new Map<string, DailyRow[]>();
  for (const r of daily.value) (bySite.get(r.site_id) ?? bySite.set(r.site_id, []).get(r.site_id)!).push(r);
  return connected.value
    .map((site) => {
      const p = splitPeriods(bySite.get(site.id) ?? [], range.value, site.id);
      const cur = summarize(p.current);
      const prev = summarize(p.previous);
      const weekly: number[] = [];
      for (let i = 0; i < p.current.length; i += range.value === 7 ? 1 : 7) {
        weekly.push(p.current.slice(i, i + (range.value === 7 ? 1 : 7)).reduce((s, r) => s + Number(r.active_users), 0));
      }
      return {
        site,
        cur,
        delta: p.previous.length ? change(cur.active_users, prev.active_users) : null,
        trend: weekly,
        hasData: (bySite.get(site.id)?.length ?? 0) > 0,
      };
    })
    .sort((a, b) => b.cur[sortBy.value] - a.cur[sortBy.value]);
});

const totals = computed(() => summarize(rows.value.flatMap((r) => splitPeriods(daily.value.filter((d) => d.site_id === r.site.id), range.value).current)));

// Sincronizar todos
const syncing = ref(false);
const results = ref<SyncResult[]>([]);
const syncError = ref<string | null>(null);
const serviceEmail = ref<string | null>(null);

async function syncAll() {
  syncing.value = true;
  syncError.value = null;
  const res = await syncGa4();
  syncing.value = false;
  results.value = res.results;
  serviceEmail.value = res.service_account_email;
  syncError.value = res.error;
  await load();
}

// Al entrar, pedimos el correo de la cuenta de servicio para mostrar en la guía.
onMounted(async () => {
  const res = await syncGa4({ action: 'info' });
  serviceEmail.value = res.service_account_email;
  if (res.error && !connected.value.length) syncError.value = res.error;
});

const failed = computed(() => results.value.filter((r) => !r.ok));
const sortable: MetricKey[] = ['active_users', 'sessions', 'page_views', 'key_events'];
const fmt = (key: MetricKey, v: number) => METRICS.find((m) => m.key === key)!.format(v);
</script>

<template>
  <PageHeader title="Analítica" subtitle="Google Analytics 4 de todos tus sitios">
    <button class="btn" type="button" :disabled="syncing || !connected.length" @click="syncAll">
      {{ syncing ? 'Sincronizando…' : '↻ Sincronizar todos' }}
    </button>
  </PageHeader>

  <ErrorBox :message="error ?? syncError" />
  <div v-if="failed.length" class="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
    <p class="font-medium">{{ failed.length }} sitio(s) no se pudieron sincronizar:</p>
    <ul class="mt-1 list-disc space-y-1 pl-5">
      <li v-for="f in failed" :key="f.site_id"><strong>{{ f.name }}:</strong> {{ f.error }}</li>
    </ul>
  </div>
  <p v-else-if="results.length" class="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
    {{ results.length }} sitio(s) sincronizados correctamente.
  </p>

  <LoadingState v-if="loading" />
  <template v-else>
    <Ga4Setup v-if="!connected.length || (syncError && !daily.length)" class="mb-6" :service-email="serviceEmail" />

    <template v-if="connected.length">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label="Periodo">
          <button
            v-for="d in [7, 30, 90] as const"
            :key="d"
            type="button"
            class="rounded px-3 py-1"
            :class="range === d ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'"
            :aria-pressed="range === d"
            @click="range = d"
          >
            {{ d }} días
          </button>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-600">
          Ordenar por
          <select v-model="sortBy" class="input w-auto">
            <option v-for="k in sortable" :key="k" :value="k">{{ METRICS.find((m) => m.key === k)!.label }}</option>
          </select>
        </label>
        <span class="ml-auto text-sm text-slate-500">
          Total: <strong class="text-slate-800">{{ compact(totals.active_users) }}</strong> usuarios ·
          <strong class="text-slate-800">{{ compact(totals.page_views) }}</strong> vistas
        </span>
      </div>

      <div class="card overflow-x-auto p-0">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Sitio</th>
              <th class="px-4 py-3 text-right">Usuarios</th>
              <th class="px-4 py-3">Tendencia</th>
              <th class="px-4 py-3 text-right">Sesiones</th>
              <th class="px-4 py-3 text-right">Vistas</th>
              <th class="px-4 py-3 text-right">Interacción</th>
              <th class="px-4 py-3 text-right">Conversiones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100" style="font-variant-numeric: tabular-nums">
            <tr v-for="r in rows" :key="r.site.id" class="hover:bg-slate-50">
              <td class="px-4 py-3">
                <RouterLink class="link font-medium" :to="`/sitios/${r.site.id}?vista=analitica`">{{ r.site.name }}</RouterLink>
                <span class="block text-xs text-slate-500">{{ r.site.clients?.name }}</span>
                <span v-if="r.site.ga4_last_error" class="mt-0.5 block text-xs text-red-700" :title="r.site.ga4_last_error">⚠ Error al sincronizar</span>
                <span v-else-if="!r.hasData" class="mt-0.5 block text-xs text-amber-700">Sin datos aún</span>
              </td>
              <td class="px-4 py-3 text-right">
                <span class="font-medium">{{ compact(r.cur.active_users) }}</span>
                <span class="block"><DeltaBadge :value="r.delta" /></span>
              </td>
              <td class="px-4 py-3"><Sparkline :values="r.trend" :label="`Usuarios de ${r.site.name}`" /></td>
              <td class="px-4 py-3 text-right">{{ fmt('sessions', r.cur.sessions) }}</td>
              <td class="px-4 py-3 text-right">{{ fmt('page_views', r.cur.page_views) }}</td>
              <td class="px-4 py-3 text-right">{{ r.cur.sessions ? fmt('engagement_rate', r.cur.engagement_rate) : '—' }}</td>
              <td class="px-4 py-3 text-right">{{ fmt('key_events', r.cur.key_events) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-slate-500">Variación de usuarios frente a los {{ range }} días anteriores. La tendencia es semanal.</p>
    </template>

    <section v-if="pending.length" class="card mt-6 text-sm">
      <h2 class="font-medium">Sitios sin GA4 ({{ pending.length }})</h2>
      <p class="mb-2 text-xs text-slate-500">Edita cada sitio y agrega su ID de propiedad GA4.</p>
      <ul class="flex flex-wrap gap-2">
        <li v-for="s in pending" :key="s.id">
          <RouterLink class="inline-block rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-50" :to="`/sitios/${s.id}`">{{ s.name }}</RouterLink>
        </li>
      </ul>
    </section>
  </template>
</template>
