<script setup lang="ts">
import { computed } from 'vue';
import ErrorBox from '@/components/ErrorBox.vue';
import TimeEntriesPanel from '@/components/TimeEntriesPanel.vue';
import ExpensesPanel from '@/components/ExpensesPanel.vue';
import InvoicesPanel from '@/components/InvoicesPanel.vue';
import { supabase } from '@/lib/supabase';
import { analyze, marginTone } from '@/lib/finance';
import { hours, money, num, percent } from '@/lib/money';
import { useQuery } from '@/lib/useQuery';
import type { ProjectFinancials } from '@/lib/types';

const props = defineProps<{ projectId: string }>();

const { data, error, reload } = useQuery<ProjectFinancials>(() =>
  supabase.from('project_financials').select('*').eq('project_id', props.projectId).maybeSingle(),
);
const a = computed(() => (data.value ? analyze(data.value) : null));
</script>

<template>
  <div class="space-y-8">
    <ErrorBox :message="error" />

    <div v-if="data && a" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="card">
        <p class="text-sm text-slate-500">Costo real</p>
        <p class="mt-1 text-2xl font-semibold">{{ money(a.cost) }}</p>
        <p class="mt-1 text-xs text-slate-500">
          {{ hours(data.hours) }} → {{ money(data.labor_cost) }} · gastos {{ money(data.expenses_cost) }}
        </p>
        <p v-if="a.missingCostHours" class="mt-1 text-xs text-amber-700">
          {{ hours(a.missingCostHours) }} sin costo/hora. <RouterLink class="underline" to="/equipo">Configúralo en Equipo</RouterLink>.
        </p>
      </div>

      <div class="card">
        <p class="text-sm text-slate-500">Presupuesto</p>
        <p class="mt-1 text-2xl font-semibold">{{ money(a.budget) }}</p>
        <template v-if="a.budgetUsed !== null">
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              class="h-full rounded-full"
              :class="a.budgetUsed > 1 ? 'bg-red-500' : a.budgetUsed > 0.8 ? 'bg-amber-500' : 'bg-indigo-500'"
              :style="{ width: `${Math.min(100, a.budgetUsed * 100)}%` }"
            />
          </div>
          <p class="mt-1 text-xs" :class="a.budgetUsed > 1 ? 'font-semibold text-red-700' : 'text-slate-500'">
            {{ percent(a.budgetUsed) }} consumido{{ a.budgetUsed > 1 ? ' — ¡excedido!' : '' }}
          </p>
        </template>
        <p v-else class="mt-1 text-xs text-slate-500">Agrega un presupuesto al editar el proyecto.</p>
      </div>

      <div class="card">
        <p class="text-sm text-slate-500">Facturado (sin impuestos)</p>
        <p class="mt-1 text-2xl font-semibold">{{ money(data.invoiced_net) }}</p>
        <p class="mt-1 text-xs text-slate-500">
          Cobrado {{ money(data.collected) }}
          <span v-if="num(data.receivable) > 0" class="text-amber-700">· por cobrar {{ money(data.receivable) }}</span>
        </p>
        <p v-if="num(data.billable_value) > 0" class="mt-1 text-xs text-slate-500">
          Horas facturables × tarifa: {{ money(data.billable_value) }}
        </p>
      </div>

      <div class="card">
        <p class="text-sm text-slate-500">Margen</p>
        <p class="mt-1 text-2xl font-semibold" :class="marginTone(a.marginPct)">{{ money(a.margin) }}</p>
        <p class="mt-1 text-xs" :class="marginTone(a.marginPct)">
          {{ a.marginPct !== null ? percent(a.marginPct) : '' }}
          <span class="text-slate-500">
            {{ a.incomeSource === 'presupuesto' ? 'esperado (sobre presupuesto)' : a.incomeSource === 'facturado' ? 'sobre lo facturado' : 'Sin presupuesto ni facturas' }}
          </span>
        </p>
      </div>
    </div>

    <section>
      <h3 class="mb-3 font-medium">Horas trabajadas</h3>
      <TimeEntriesPanel :project-id="projectId" @changed="reload" />
    </section>
    <section>
      <h3 class="mb-3 font-medium">Gastos del proyecto</h3>
      <ExpensesPanel :project-id="projectId" @changed="reload" />
    </section>
    <section>
      <h3 class="mb-3 font-medium">Facturas</h3>
      <InvoicesPanel :project-id="projectId" />
    </section>
  </div>
</template>
