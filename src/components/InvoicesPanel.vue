<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import InvoiceModal from '@/components/InvoiceModal.vue';
import { supabase } from '@/lib/supabase';
import { label } from '@/lib/labels';
import { money, num } from '@/lib/money';
import { useQuery } from '@/lib/useQuery';
import { formatDate } from '@/lib/utils';
import type { Invoice, InvoiceRow, PaymentStatus } from '@/lib/types';

type Row = InvoiceRow & { clients: { id: string; name: string } | null; projects: { id: string; name: string } | null };

/** Facturas. Filtra por `clientId` o `projectId` si se indican. */
const props = defineProps<{ clientId?: string; projectId?: string }>();
const router = useRouter();

const status = ref<PaymentStatus | 'por_cobrar' | ''>('');
const { data, error, loading } = useQuery<Row[]>(() => {
  let q = supabase.from('invoices_overview').select('*, clients(id, name), projects(id, name)').order('issue_date', { ascending: false });
  if (props.clientId) q = q.eq('client_id', props.clientId);
  if (props.projectId) q = q.eq('project_id', props.projectId);
  return q;
});

const rows = computed(() =>
  (data.value ?? []).filter((i) =>
    status.value === 'por_cobrar' ? num(i.balance) > 0 : !status.value || i.payment_status === status.value,
  ),
);
const totals = computed(() => {
  const list = data.value ?? [];
  return {
    receivable: list.reduce((s, i) => s + num(i.balance), 0),
    overdue: list.filter((i) => i.payment_status === 'vencida').reduce((s, i) => s + num(i.balance), 0),
  };
});

const creating = ref<Partial<Invoice> | null>(null);
const statuses: PaymentStatus[] = ['pendiente', 'parcial', 'vencida', 'pagada', 'borrador', 'anulada'];
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center gap-4">
      <div class="text-sm">
        <span class="text-slate-500">Por cobrar:</span> <strong>{{ money(totals.receivable) }}</strong>
        <template v-if="totals.overdue">
          · <span class="text-red-700">vencido <strong>{{ money(totals.overdue) }}</strong></span>
        </template>
      </div>
      <select v-model="status" class="input w-auto">
        <option value="">Todas</option>
        <option value="por_cobrar">Con saldo por cobrar</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ label(s) }}</option>
      </select>
      <button class="btn ml-auto" type="button" @click="creating = { client_id: clientId, project_id: projectId }">+ Nueva factura</button>
    </div>

    <ErrorBox :message="error" />
    <LoadingState v-if="loading" />
    <div v-else class="card overflow-x-auto p-0">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Factura</th>
            <th v-if="!clientId && !projectId" class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Emisión</th>
            <th class="px-4 py-3">Vence</th>
            <th class="px-4 py-3 text-right">Total</th>
            <th class="px-4 py-3 text-right">Saldo</th>
            <th class="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="i in rows" :key="i.id" class="cursor-pointer hover:bg-slate-50" @click="router.push(`/facturas/${i.id}`)">
            <td class="px-4 py-3">
              <span class="font-medium">{{ i.number || 'Sin número' }}</span>
              <span class="block text-xs text-slate-500">{{ i.concept || i.projects?.name }}</span>
            </td>
            <td v-if="!clientId && !projectId" class="px-4 py-3">{{ i.clients?.name }}</td>
            <td class="whitespace-nowrap px-4 py-3">{{ formatDate(i.issue_date) }}</td>
            <td class="whitespace-nowrap px-4 py-3" :class="{ 'font-semibold text-red-700': i.payment_status === 'vencida' }">{{ formatDate(i.due_date) }}</td>
            <td class="px-4 py-3 text-right">{{ money(i.total) }}</td>
            <td class="px-4 py-3 text-right font-medium">{{ num(i.balance) ? money(i.balance) : '—' }}</td>
            <td class="px-4 py-3"><AppBadge :value="i.payment_status" /></td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="7" class="px-4 py-8 text-center text-slate-500">No hay facturas.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <InvoiceModal v-if="creating" :invoice="creating" @close="creating = null" @saved="router.push(`/facturas/${$event}`)" />
  </div>
</template>
