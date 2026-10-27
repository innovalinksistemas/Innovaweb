<script setup lang="ts">
import { computed, ref } from 'vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import ExpenseModal from '@/components/ExpenseModal.vue';
import { supabase } from '@/lib/supabase';
import { money, num } from '@/lib/money';
import { useQuery } from '@/lib/useQuery';
import { daysUntil, expiryTone, formatDate } from '@/lib/utils';
import type { Expense, ExpenseRow } from '@/lib/types';

type Row = ExpenseRow & {
  clients: { id: string; name: string } | null;
  sites: { id: string; name: string } | null;
  projects: { id: string; name: string } | null;
};

/** Gastos. Filtra por `siteId`, `projectId` o `clientId` si se indican. */
const props = defineProps<{ siteId?: string; projectId?: string; clientId?: string }>();
const emit = defineEmits<{ changed: [] }>();

const showEnded = ref(false);
const { data, error, loading, reload } = useQuery<Row[]>(() => {
  let q = supabase.from('expenses_overview').select('*, clients(id, name), sites(id, name), projects(id, name)').order('next_due', { nullsFirst: false });
  if (props.siteId) q = q.eq('site_id', props.siteId);
  if (props.projectId) q = q.eq('project_id', props.projectId);
  if (props.clientId) q = q.eq('client_id', props.clientId);
  return q;
});

// Vigentes: recurrentes con próximo cobro, o únicos (siempre se muestran).
const rows = computed(() => (data.value ?? []).filter((e) => showEnded.value || e.frequency === 'unica' || e.next_due));
const totals = computed(() => {
  const active = (data.value ?? []).filter((e) => e.frequency !== 'unica' && e.next_due);
  const monthly = active.reduce((s, e) => s + num(e.monthly_equivalent), 0);
  return { monthly, yearly: monthly * 12, toDate: (data.value ?? []).reduce((s, e) => s + num(e.total_to_date), 0) };
});
const endedCount = computed(() => (data.value ?? []).filter((e) => e.frequency !== 'unica' && !e.next_due).length);

const editing = ref<Partial<Expense> | null>(null);
const defaults = computed(() => ({ site_id: props.siteId, project_id: props.projectId, client_id: props.clientId }));
async function onSaved() {
  editing.value = null;
  await reload();
  emit('changed');
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center gap-4">
      <div class="text-sm">
        <span class="text-slate-500">Recurrente:</span> <strong>{{ money(totals.monthly) }}</strong>/mes ·
        <strong>{{ money(totals.yearly) }}</strong>/año
      </div>
      <label v-if="endedCount" class="flex items-center gap-2 text-xs text-slate-500">
        <input v-model="showEnded" type="checkbox" /> Mostrar finalizados ({{ endedCount }})
      </label>
      <button class="btn ml-auto" type="button" @click="editing = { ...defaults }">+ Nuevo gasto</button>
    </div>

    <ErrorBox :message="error" />
    <LoadingState v-if="loading" />
    <div v-else class="card overflow-x-auto p-0">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Concepto</th>
            <th v-if="!siteId && !projectId" class="px-4 py-3">Para</th>
            <th class="px-4 py-3">Frecuencia</th>
            <th class="px-4 py-3 text-right">Monto</th>
            <th class="px-4 py-3">Próximo cobro</th>
            <th class="px-4 py-3 text-right">Total a la fecha</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="e in rows" :key="e.id" class="cursor-pointer hover:bg-slate-50" @click="editing = e">
            <td class="px-4 py-3">
              <span class="font-medium">{{ e.concept }}</span>
              <span class="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                <AppBadge :value="e.category" />
                <span v-if="e.provider">{{ e.provider }}</span>
                <span v-if="e.rebillable" class="text-green-700">· se cobra al cliente</span>
              </span>
            </td>
            <td v-if="!siteId && !projectId" class="px-4 py-3 text-xs">
              <span v-if="!e.clients" class="italic text-slate-400">Interno</span>
              <template v-else>
                {{ e.clients.name }}
                <span v-if="e.sites" class="block text-slate-500">{{ e.sites.name }}</span>
                <span v-if="e.projects" class="block text-slate-500">{{ e.projects.name }}</span>
              </template>
            </td>
            <td class="px-4 py-3"><AppBadge :value="e.frequency" /></td>
            <td class="px-4 py-3 text-right font-medium">{{ money(e.amount) }}</td>
            <td class="whitespace-nowrap px-4 py-3" :class="e.next_due ? expiryTone(daysUntil(e.next_due)) : 'text-slate-400'">
              {{ e.next_due ? formatDate(e.next_due) : e.frequency === 'unica' ? 'Pagado' : 'Finalizado' }}
            </td>
            <td class="px-4 py-3 text-right">{{ money(e.total_to_date) }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="6" class="px-4 py-8 text-center text-slate-500">No hay gastos registrados.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ExpenseModal v-if="editing" :expense="editing" @close="editing = null" @saved="onSaved" />
  </div>
</template>
