<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import AppModal from '@/components/AppModal.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import { supabase } from '@/lib/supabase';
import { label } from '@/lib/labels';
import { money } from '@/lib/money';
import { usePickers } from '@/lib/usePickers';
import { isoInDays, toForm, toRecord } from '@/lib/utils';
import { INVOICE_FIELDS, INVOICE_STATUSES, type Invoice } from '@/lib/types';

const props = defineProps<{ invoice?: Partial<Invoice> }>();
const emit = defineEmits<{ close: []; saved: [id: string] }>();

const { clients, projects } = usePickers();
const isNew = !props.invoice?.id;
const form = reactive(
  toForm(INVOICE_FIELDS, { status: 'emitida', issue_date: isoInDays(0), due_date: isoInDays(15), tax_rate: 0, ...props.invoice }),
);
const busy = ref(false);
const error = ref<string | null>(null);

const clientProjects = computed(() => projects.value.filter((p) => p.client_id === form.client_id));
const total = computed(() => Number(form.subtotal || 0) * (1 + Number(form.tax_rate || 0) / 100));

function onClientChange() {
  if (!clientProjects.value.some((p) => p.id === form.project_id)) form.project_id = '';
}

async function save() {
  busy.value = true;
  error.value = null;
  const record = toRecord(form);
  const res = isNew
    ? await supabase.from('invoices').insert(record).select('id').single()
    : await supabase.from('invoices').update(record).eq('id', props.invoice!.id!).select('id').single();
  busy.value = false;
  if (res.error) return (error.value = res.error.message);
  emit('saved', (res.data as { id: string }).id);
}
</script>

<template>
  <AppModal :title="isNew ? 'Nueva factura' : 'Editar factura'" wide @close="emit('close')">
    <ErrorBox :message="error" />
    <form class="grid gap-4 md:grid-cols-2" @submit.prevent="save">
      <div>
        <label class="label" for="in-client">Cliente *</label>
        <select id="in-client" v-model="form.client_id" class="input" required @change="onClientChange">
          <option value="">Selecciona…</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="in-project">Proyecto</label>
        <select id="in-project" v-model="form.project_id" class="input" :disabled="!form.client_id">
          <option value="">Ninguno</option>
          <option v-for="p in clientProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="in-number">Número</label>
        <input id="in-number" v-model="form.number" class="input" placeholder="F001-000123" />
      </div>
      <div>
        <label class="label" for="in-status">Estado</label>
        <select id="in-status" v-model="form.status" class="input">
          <option v-for="s in INVOICE_STATUSES" :key="s" :value="s">{{ label(s) }}</option>
        </select>
      </div>
      <div class="md:col-span-2">
        <label class="label" for="in-concept">Concepto</label>
        <input id="in-concept" v-model="form.concept" class="input" placeholder="Ej: 50% adelanto rediseño web" />
      </div>
      <div>
        <label class="label" for="in-issue">Emisión</label>
        <input id="in-issue" v-model="form.issue_date" class="input" type="date" required />
      </div>
      <div>
        <label class="label" for="in-due">Vencimiento</label>
        <input id="in-due" v-model="form.due_date" class="input" type="date" :min="form.issue_date" />
      </div>
      <div>
        <label class="label" for="in-subtotal">Subtotal (sin impuestos) *</label>
        <input id="in-subtotal" v-model="form.subtotal" class="input" type="number" min="0" step="0.01" required />
      </div>
      <div>
        <label class="label" for="in-tax">Impuesto (%)</label>
        <input id="in-tax" v-model="form.tax_rate" class="input" type="number" min="0" max="100" step="0.01" />
      </div>
      <p class="text-right text-sm md:col-span-2">Total: <strong class="text-lg">{{ money(total) }}</strong></p>
      <div class="md:col-span-2">
        <label class="label" for="in-notes">Notas</label>
        <textarea id="in-notes" v-model="form.notes" class="input" rows="2" />
      </div>
      <div class="md:col-span-2">
        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar' }}</button>
      </div>
    </form>
  </AppModal>
</template>
