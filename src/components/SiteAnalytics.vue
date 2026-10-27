<script setup lang="ts">
import { computed, ref } from 'vue';
import ErrorBox from '@/components/ErrorBox.vue';
import Ga4Setup from '@/components/Ga4Setup.vue';
import StatTile from '@/components/charts/StatTile.vue';
import LineChart from '@/components/charts/LineChart.vue';
import BarList from '@/components/charts/BarList.vue';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/useQuery';
import { isoInDays } from '@/lib/utils';
import { gaLabel } from '@/lib/gaLabels';
import { change, compact, dailyValue, METRICS, splitPeriods, summarize, syncGa4, type BreakdownRow, type DailyRow, type MetricKey } from '@/lib/analytics';

const props = defineProps<{
  site: { id: string; url: string; ga4_property_id: string | null; ga4_last_sync_at: string | null; ga4_last_error: string | null };
}>();
const emit = defineEmits<{ synced: [] }>();

const range = ref<7 | 30 | 90>(30);
const metric = ref<MetricKey>('active_users');

// Traemos 180 días una sola vez: alcanza para 90 días + el periodo anterior.
const { data: daily, loading, reload } = useQuery<DailyRow[]>(() =>
  supabase.from('analytics_daily').select('*').eq('site_id', props.site.id).gte('date', isoInDays(-179)).order('date'),
);
const { data: tops, reload: reloadTops } = useQuery<BreakdownRow[]>(() =>
  supabase.from('analytics_breakdowns').select('*').eq('site_id', props.site.id),
);

const periods = computed(() => splitPeriods(daily.value ?? [], range.value, props.site.id));
const current = computed(() => summarize(periods.value.current));
const previous = computed(() => summarize(periods.value.previous));
const hasPrevious = computed(() => periods.value.previous.length > 0);

const tiles = computed(() =>
  METRICS.map((m) => ({
    ...m,
    value: m.format(current.value[m.key]),
    delta: hasPrevious.value ? change(current.value[m.key], previous.value[m.key]) : null,
    // Tendencia semanal para la mini-gráfica (o diaria si el rango es corto)
    trend: bucket(periods.value.current.map((r) => dailyValue(r, m.key)), range.value === 7 ? 1 : 7, m.key),
  })),
);

/** Agrupa días en bloques (suma o promedio según la métrica). */
function bucket(values: number[], size: number, key: MetricKey) {
  if (size === 1) return values;
  const avg = key === 'engagement_rate' || key === 'avg_session_duration';
  const out: number[] = [];
  for (let i = 0; i < values.length; i += size) {
    const chunk = values.slice(i, i + size);
    const sum = chunk.reduce((s, v) => s + v, 0);
    out.push(avg ? sum / chunk.length : sum);
  }
  return out;
}

const selected = computed(() => METRICS.find((m) => m.key === metric.value)!);
const points = computed(() => periods.value.current.map((r) => ({ date: r.date, value: dailyValue(r, metric.value) })));

const topOf = (dim: BreakdownRow['dimension'], by: 'page_views' | 'sessions' | 'active_users', n = 8) =>
  (tops.value ?? [])
    .filter((t) => t.dimension === dim)
    .sort((a, b) => b[by] - a[by])
    .slice(0, n)
    .map((t) => ({ label: dim === 'page' ? t.value : gaLabel(t.value), value: Number(t[by]) }));

const topsPeriod = computed(() => {
  const t = tops.value?.[0];
  if (!t) return '';
  const f = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  return `${f(t.period_start)} – ${f(t.period_end)}`;
});

// Sincronización
const syncing = ref(false);
const syncError = ref<string | null>(null);
const serviceEmail = ref<string | null>(null);

async function sync() {
  syncing.value = true;
  syncError.value = null;
  const res = await syncGa4({ site_id: props.site.id });
  syncing.value = false;
  serviceEmail.value = res.service_account_email;
  syncError.value = res.error ?? res.results.find((r) => !r.ok)?.error ?? null;
  await Promise.all([reload(), reloadTops()]);
  emit('synced');
}

const lastSync = computed(() =>
  props.site.ga4_last_sync_at
    ? new Date(props.site.ga4_last_sync_at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null,
);
const error = computed(() => syncError.value ?? props.site.ga4_last_error);
</script>

<template>
  <div>
    <div v-if="!site.ga4_property_id" class="space-y-3">
      <p class="card text-sm text-slate-600">Este sitio no tiene ID de propiedad GA4. Agrégalo al <strong>editar el sitio</strong>.</p>
    </div>

    <template v-else>
      <!-- Filtros: una fila arriba de todo -->
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
        <span class="text-xs text-slate-500">
          {{ lastSync ? `Actualizado ${lastSync}` : 'Aún no se ha sincronizado' }} · propiedad {{ site.ga4_property_id }}
        </span>
        <button class="btn-secondary ml-auto" type="button" :disabled="syncing" @click="sync">
          {{ syncing ? 'Sincronizando…' : '↻ Sincronizar ahora' }}
        </button>
      </div>

      <ErrorBox :message="error" />
      <Ga4Setup v-if="error && /desplegada|GA4_SERVICE_ACCOUNT|permiso|Data API/i.test(error)" class="mb-4" :service-email="serviceEmail" compact />

      <p v-if="!loading && !daily?.length" class="card text-sm text-slate-600">
        Todavía no hay datos. Pulsa <strong>Sincronizar ahora</strong> para traer los últimos 90 días.
      </p>

      <div v-else :class="{ 'opacity-60': loading || syncing }" class="transition-opacity">
        <!-- Indicadores -->
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile
            v-for="t in tiles"
            :key="t.key"
            :label="t.label"
            :value="t.value"
            :delta="t.delta"
            :up-is-good="t.upIsGood"
            :trend="t.trend"
            :active="metric === t.key"
            @select="metric = t.key"
          />
        </div>

        <!-- Tendencia de la métrica elegida -->
        <section class="card mt-4">
          <h3 class="font-medium">{{ selected.label }} por día</h3>
          <p class="mb-3 text-xs text-slate-500">Últimos {{ range }} días · elige otra métrica tocando un indicador</p>
          <LineChart :points="points" :label="selected.label" :format="selected.format" />
        </section>

        <!-- Tops (últimos 30 días) -->
        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <section class="card">
            <h3 class="font-medium">Páginas más vistas</h3>
            <p class="mb-3 text-xs text-slate-500">Vistas de página · {{ topsPeriod }}</p>
            <BarList :items="topOf('page', 'page_views')" :format="compact" />
          </section>
          <section class="card">
            <h3 class="font-medium">¿De dónde llegan?</h3>
            <p class="mb-3 text-xs text-slate-500">Sesiones por canal · {{ topsPeriod }}</p>
            <BarList :items="topOf('channel', 'sessions')" :format="compact" />
          </section>
          <section class="card">
            <h3 class="font-medium">Dispositivos</h3>
            <p class="mb-3 text-xs text-slate-500">Sesiones · {{ topsPeriod }}</p>
            <BarList :items="topOf('device', 'sessions', 4)" :format="compact" />
          </section>
          <section class="card">
            <h3 class="font-medium">Países</h3>
            <p class="mb-3 text-xs text-slate-500">Usuarios · {{ topsPeriod }}</p>
            <BarList :items="topOf('country', 'active_users')" :format="compact" />
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
