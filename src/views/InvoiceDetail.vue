<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import ConfirmDelete from '@/components/ConfirmDelete.vue';
import InvoiceModal from '@/components/InvoiceModal.vue';
import { supabase } from '@/lib/supabase';
import { money, num } from '@/lib/money';
import { useQuery } from '@/lib/useQuery';
import { formatDate, isoInDays } from '@/lib/utils';
import type { InvoiceRow, Payment } from '@/lib/types';

type Row = InvoiceRow & { clients: { id: string; name: string } | null; projects: { id: string; name: string } | null };

const props = defineProps<{ id: string }>();
const router = useRouter();

const { data: invoice, error: loadError, loading, reload } = useQuery<Row>(() =>
  supabase.from('invoices_overview').select('*, clients(id, name), projects(id, name)').eq('id', props.id).maybeSingle(),
);
const { data: payments, reload: reloadPayments } = useQuery<Payment[]>(() =>
  supabase.from('payments').select('*').eq('invoice_id', props.id).order('paid_date'),
);

const error = ref<string | null>(null);
const editing = ref(false);
const balance = computed(() => num(invoice.value?.balance));

// Registrar pago (por defecto, el saldo completo).
const draft = reactive({ amount: '', paid_date: isoInDays(0), method: 'transferencia', notes: '' });
const busy = ref(false);

async function addPayment() {
  busy.value = true;
  error.value = null;
  const { error: err } = await supabase.from('payments').insert({
    invoice_id: props.id,
    amount: draft.amount || balance.value,
    paid_date: draft.paid_date,
    method: draft.method || null,
    notes: draft.notes || null,
  });
  busy.value = false;
  if (err) return (error.value = err.message);
  Object.assign(draft, { amount: '', notes: '' });
  await Promise.all([reload(), reloadPayments()]);
}

async function removePayment(p: Payment) {
  if (!window.confirm(`¿Eliminar el pago de ${money(p.amount)}?`)) return;
  const { error: err } = await supabase.from('payments').delete().eq('id', p.id);
  if (err) return (error.value = err.message);
  await Promise.all([reload(), reloadPayments()]);
}

async function removeInvoice() {
  const { error: err } = await supabase.from('invoices').delete().eq('id', props.id);
  if (err) return (error.value = err.message);
  await router.push('/costeo?vista=facturas');
}

async function onSaved() {
  editing.value = false;
  await reload();
}
</script>

<template>
  <LoadingState v-if="loading && !invoice" />
  <div v-else-if="!invoice" class="card text-sm">
    {{ loadError ?? 'Esta factura no existe.' }} <RouterLink class="link" to="/costeo?vista=facturas">Volver a facturas</RouterLink>
  </div>
  <template v-else>
    <PageHeader :title="`Factura ${invoice.number || 'sin número'}`" :subtitle="invoice.concept">
      <button class="btn-secondary" type="button" @click="editing = true">Editar</button>
    </PageHeader>
    <ErrorBox :message="error" />

    <div class="grid gap-6 lg:grid-cols-3">
      <section class="card space-y-2 text-sm">
        <AppBadge :value="invoice.payment_status" />
        <p>
          <span class="text-slate-500">Cliente:</span>
          <RouterLink v-if="invoice.clients" class="link" :to="`/clientes/${invoice.clients.id}`">{{ invoice.clients.name }}</RouterLink>
        </p>
        <p v-if="invoice.projects">
          <span class="text-slate-500">Proyecto:</span>
          <RouterLink class="link" :to="`/proyectos/${invoice.projects.id}?vista=costos`">{{ invoice.projects.name }}</RouterLink>
        </p>
        <p><span class="text-slate-500">Emisión:</span> {{ formatDate(invoice.issue_date) }}</p>
        <p><span class="text-slate-500">Vence:</span> {{ formatDate(invoice.due_date) }}</p>
        <p v-if="invoice.notes" class="whitespace-pre-line border-t border-slate-100 pt-2">{{ invoice.notes }}</p>
      </section>

      <section class="card text-sm">
        <dl class="space-y-2">
          <div class="flex justify-between"><dt class="text-slate-500">Subtotal</dt><dd>{{ money(invoice.subtotal) }}</dd></div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Impuesto ({{ num(invoice.tax_rate) }}%)</dt>
            <dd>{{ money(num(invoice.total) - num(invoice.subtotal)) }}</dd>
          </div>
          <div class="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold"><dt>Total</dt><dd>{{ money(invoice.total) }}</dd></div>
          <div class="flex justify-between text-green-700"><dt>Pagado</dt><dd>{{ money(invoice.paid) }}</dd></div>
          <div class="flex justify-between text-base font-semibold" :class="balance > 0 ? 'text-amber-700' : 'text-slate-400'">
            <dt>Saldo</dt><dd>{{ money(balance) }}</dd>
          </div>
        </dl>
      </section>

      <section class="card text-sm">
        <h2 class="mb-3 font-medium">Registrar pago</h2>
        <p v-if="invoice.status !== 'emitida'" class="text-slate-500">
          Solo se registran pagos en facturas <strong>emitidas</strong>. Cambia el estado al editarla.
        </p>
        <p v-else-if="balance <= 0" class="text-green-700">Factura pagada por completo.</p>
        <form v-else class="space-y-3" @submit.prevent="addPayment">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label" for="pay-amount">Monto</label>
              <input id="pay-amount" v-model="draft.amount" class="input" type="number" min="0.01" :max="balance" step="0.01" :placeholder="String(balance)" />
            </div>
            <div>
              <label class="label" for="pay-date">Fecha</label>
              <input id="pay-date" v-model="draft.paid_date" class="input" type="date" required />
            </div>
          </div>
          <div>
            <label class="label" for="pay-method">Método</label>
            <select id="pay-method" v-model="draft.method" class="input">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="deposito">Depósito</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <input v-model="draft.notes" class="input" placeholder="Nota (opcional, ej. N° de operación)" />
          <button class="btn w-full" type="submit" :disabled="busy">{{ draft.amount ? `Registrar ${money(draft.amount)}` : `Registrar saldo (${money(balance)})` }}</button>
        </form>
      </section>
    </div>

    <section class="card mt-6">
      <h2 class="mb-3 font-medium">Pagos ({{ payments?.length ?? 0 }})</h2>
      <p v-if="!payments?.length" class="text-sm text-slate-500">Aún no hay pagos registrados.</p>
      <ul v-else class="divide-y divide-slate-100 text-sm">
        <li v-for="p in payments" :key="p.id" class="flex items-center justify-between gap-3 py-2">
          <div>
            <span class="font-medium">{{ money(p.amount) }}</span>
            <span class="ml-2 text-slate-500">{{ formatDate(p.paid_date) }} · {{ p.method }}</span>
            <span v-if="p.notes" class="block text-xs text-slate-500">{{ p.notes }}</span>
          </div>
          <button class="text-xs text-red-700 hover:underline" type="button" @click="removePayment(p)">Eliminar</button>
        </li>
      </ul>
    </section>

    <div class="mt-6">
      <ConfirmDelete label="Eliminar factura" title="Eliminar factura" message="Se eliminará la factura y todos sus pagos. No se puede deshacer." @confirm="removeInvoice" />
    </div>

    <InvoiceModal v-if="editing" :invoice="invoice" @close="editing = false" @saved="onSaved" />
  </template>
</template>
