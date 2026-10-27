<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import TimeEntriesPanel from '@/components/TimeEntriesPanel.vue';
import ExpensesPanel from '@/components/ExpensesPanel.vue';
import InvoicesPanel from '@/components/InvoicesPanel.vue';
import { supabase } from '@/lib/supabase';
import { analyze, marginTone } from '@/lib/finance';
import { hours, money, num, percent } from '@/lib/money';
import { useQueryParam } from '@/lib/useQueryParam';
import { isoInDays } from '@/lib/utils';
import type { ProjectFinancials } from '@/lib/types';

const view = useQueryParam('vista', 'resumen');
const tabs = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'horas', label: 'Horas' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'facturas', label: 'Facturas' },
];

// ---- Resumen ----
const loading = ref(true);
const error = ref<string | null>(null);
const kpi = ref({ receivable: 0, overdue: 0, collectedMonth: 0, hoursMonth: 0, recurringMonthly: 0 });
const projects = ref<(ProjectFinancials & { clientName: string })[]>([]);
const showClosed = ref(false);
const monthStart = isoInDays(0).slice(0, 8) + '01';

onMounted(async () => {
  const [inv, pay, te, exp, fin, cli] = await Promise.all([
    supabase.from('invoices_overview').select('balance, payment_status'),
    supabase.from('payments').select('amount').gte('paid_date', monthStart),
    supabase.from('time_entries').select('hours').not('hours', 'is', null).gte('entry_date', monthStart),
    supabase.from('expenses_overview').select('monthly_equivalent, next_due').neq('frequency', 'unica'),
    supabase.from('project_financials').select('*'),
    supabase.from('clients').select('id, name'),
  ]);
  error.value = [inv, pay, te, exp, fin, cli].find((r) => r.error)?.error?.message ?? null;

  const invoices = (inv.data ?? []) as { balance: number; payment_status: string }[];
  const clientNames = new Map(((cli.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  kpi.value = {
    receivable: invoices.reduce((s, i) => s + num(i.balance), 0),
    overdue: invoices.filter((i) => i.payment_status === 'vencida').reduce((s, i) => s + num(i.balance), 0),
    collectedMonth: ((pay.data ?? []) as { amount: number }[]).reduce((s, p) => s + num(p.amount), 0),
    hoursMonth: ((te.data ?? []) as { hours: number }[]).reduce((s, t) => s + num(t.hours), 0),
    recurringMonthly: ((exp.data ?? []) as { monthly_equivalent: number; next_due: string | null }[])
      .filter((e) => e.next_due)
      .reduce((s, e) => s + num(e.monthly_equivalent), 0),
  };
  projects.value = ((fin.data ?? []) as ProjectFinancials[]).map((p) => ({ ...p, clientName: clientNames.get(p.client_id) ?? '' }));
  loading.value = false;
});

const rows = computed(() =>
  projects.value
    .filter((p) => showClosed.value || !['completado', 'cancelado'].includes(p.status))
    .map((p) => ({ ...p, a: analyze(p) }))
    .sort((x, y) => (x.a.marginPct ?? 99) - (y.a.marginPct ?? 99)),
);
const totals = computed(() =>
  rows.value.reduce(
    (t, p) => ({
      hours: t.hours + num(p.hours),
      cost: t.cost + p.a.cost,
      budget: t.budget + (p.a.budget ?? 0),
      invoiced: t.invoiced + num(p.invoiced_net),
      collected: t.collected + num(p.collected),
    }),
    { hours: 0, cost: 0, budget: 0, invoiced: 0, collected: 0 },
  ),
);

const cards = computed(() => [
  { label: 'Por cobrar', value: money(kpi.value.receivable), sub: kpi.value.overdue ? `${money(kpi.value.overdue)} vencido` : 'Nada vencido', danger: kpi.value.overdue > 0, to: '/costeo?vista=facturas' },
  { label: 'Cobrado este mes', value: money(kpi.value.collectedMonth), sub: 'Pagos registrados', to: '/costeo?vista=facturas' },
  { label: 'Horas este mes', value: hours(kpi.value.hoursMonth), sub: 'Todo el equipo', to: '/costeo?vista=horas' },
  { label: 'Gastos recurrentes', value: money(kpi.value.recurringMonthly), sub: `${money(kpi.value.recurringMonthly * 12)} al año`, to: '/costeo?vista=gastos' },
]);
</script>

<template>
  <PageHeader title="Costeo" subtitle="Horas, gastos, facturación y margen por proyecto" />

  <nav class="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
    <button
      v-for="t in tabs"
      :key="t.id"
      type="button"
      class="-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm"
      :class="view === t.id ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
      @click="view = t.id"
    >
      {{ t.label }}
    </button>
  </nav>

  <template v-if="view === 'resumen'">
    <ErrorBox :message="error" />
    <LoadingState v-if="loading" />
    <template v-else>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RouterLink v-for="c in cards" :key="c.label" :to="c.to" class="card hover:border-indigo-300" :class="{ 'border-red-200': c.danger }">
          <p class="text-sm text-slate-500">{{ c.label }}</p>
          <p class="mt-1 text-2xl font-semibold">{{ c.value }}</p>
          <p class="mt-1 text-xs" :class="c.danger ? 'font-medium text-red-700' : 'text-slate-500'">{{ c.sub }}</p>
        </RouterLink>
      </div>

      <section class="mt-8">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-medium">Rentabilidad por proyecto</h2>
          <label class="flex items-center gap-2 text-xs text-slate-500">
            <input v-model="showClosed" type="checkbox" /> Incluir completados y cancelados
          </label>
        </div>
        <div class="card overflow-x-auto p-0">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-4 py-3">Proyecto</th>
                <th class="px-4 py-3 text-right">Horas</th>
                <th class="px-4 py-3 text-right">Costo real</th>
                <th class="px-4 py-3 text-right">Presupuesto</th>
                <th class="px-4 py-3 text-right">Facturado</th>
                <th class="px-4 py-3 text-right">Cobrado</th>
                <th class="px-4 py-3 text-right">Margen</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="p in rows" :key="p.project_id" class="hover:bg-slate-50">
                <td class="px-4 py-3">
                  <RouterLink class="link font-medium" :to="`/proyectos/${p.project_id}?vista=costos`">{{ p.name }}</RouterLink>
                  <span class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">{{ p.clientName }} <AppBadge :value="p.status" /></span>
                </td>
                <td class="px-4 py-3 text-right">{{ hours(p.hours) }}</td>
                <td class="px-4 py-3 text-right">
                  {{ money(p.a.cost) }}
                  <span v-if="p.a.missingCostHours" class="block text-xs text-amber-700" title="Horas de personas sin costo/hora configurado">⚠ {{ hours(p.a.missingCostHours) }} sin costo</span>
                </td>
                <td class="px-4 py-3 text-right">
                  {{ money(p.a.budget) }}
                  <span v-if="p.a.budgetUsed !== null" class="block text-xs" :class="p.a.budgetUsed > 1 ? 'font-semibold text-red-700' : 'text-slate-500'">
                    {{ percent(p.a.budgetUsed) }} usado
                  </span>
                </td>
                <td class="px-4 py-3 text-right">{{ money(p.invoiced_net) }}</td>
                <td class="px-4 py-3 text-right">{{ money(p.collected) }}</td>
                <td class="px-4 py-3 text-right font-medium" :class="marginTone(p.a.marginPct)">
                  {{ money(p.a.margin) }}
                  <span class="block text-xs font-normal">
                    {{ percent(p.a.marginPct) }}{{ p.a.incomeSource === 'presupuesto' ? ' esperado' : '' }}
                  </span>
                </td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500">No hay proyectos activos.</td>
              </tr>
            </tbody>
            <tfoot v-if="rows.length" class="border-t border-slate-200 bg-slate-50 font-medium">
              <tr>
                <td class="px-4 py-3 text-xs uppercase text-slate-500">Total</td>
                <td class="px-4 py-3 text-right">{{ hours(totals.hours) }}</td>
                <td class="px-4 py-3 text-right">{{ money(totals.cost) }}</td>
                <td class="px-4 py-3 text-right">{{ money(totals.budget) }}</td>
                <td class="px-4 py-3 text-right">{{ money(totals.invoiced) }}</td>
                <td class="px-4 py-3 text-right">{{ money(totals.collected) }}</td>
                <td class="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          Margen = facturado sin impuestos − costo real. Si aún no hay facturas, se calcula sobre el presupuesto (“esperado”).
        </p>
      </section>
    </template>
  </template>

  <TimeEntriesPanel v-else-if="view === 'horas'" />
  <ExpensesPanel v-else-if="view === 'gastos'" />
  <InvoicesPanel v-else />
</template>
