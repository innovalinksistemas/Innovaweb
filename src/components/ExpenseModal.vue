<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import AppModal from '@/components/AppModal.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import { supabase } from '@/lib/supabase';
import { label } from '@/lib/labels';
import { usePickers } from '@/lib/usePickers';
import { isoInDays, toForm, toRecord } from '@/lib/utils';
import { EXPENSE_CATEGORIES, EXPENSE_FIELDS, EXPENSE_FREQUENCIES, type Expense } from '@/lib/types';

/** Crea (sin id) o edita (con id) un gasto. Sin id, `expense` sirve para precargar sitio/proyecto/cliente. */
const props = defineProps<{ expense?: Partial<Expense> }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const { clients, sites, projects } = usePickers();
const isNew = !props.expense?.id;
const form = reactive(toForm(EXPENSE_FIELDS, { category: 'hosting', frequency: 'mensual', start_date: isoInDays(0), ...props.expense }));
const rebillable = ref(props.expense?.rebillable ?? false);
const busy = ref(false);
const error = ref<string | null>(null);

// Sitios y proyectos del cliente elegido (si no hay cliente, todos).
const clientSites = computed(() => sites.value.filter((s) => !form.client_id || s.client_id === form.client_id));
const clientProjects = computed(() => projects.value.filter((p) => !form.client_id || p.client_id === form.client_id));

function onClientChange() {
  if (!clientSites.value.some((s) => s.id === form.site_id)) form.site_id = '';
  if (!clientProjects.value.some((p) => p.id === form.project_id)) form.project_id = '';
}
// Al elegir sitio o proyecto, el cliente se completa solo.
function onLinkChange(kind: 'site' | 'project') {
  const owner =
    kind === 'site'
      ? sites.value.find((s) => s.id === form.site_id)?.client_id
      : projects.value.find((p) => p.id === form.project_id)?.client_id;
  if (owner) form.client_id = owner;
}

async function save() {
  busy.value = true;
  error.value = null;
  const record = { ...toRecord(form), rebillable: rebillable.value };
  const { error: err } = isNew
    ? await supabase.from('expenses').insert(record)
    : await supabase.from('expenses').update(record).eq('id', props.expense!.id!);
  busy.value = false;
  if (err) return (error.value = err.message);
  emit('saved');
}

async function remove() {
  if (!window.confirm('¿Eliminar este gasto?')) return;
  const { error: err } = await supabase.from('expenses').delete().eq('id', props.expense!.id!);
  if (err) return (error.value = err.message);
  emit('saved');
}
</script>

<template>
  <AppModal :title="isNew ? 'Nuevo gasto' : 'Editar gasto'" wide @close="emit('close')">
    <ErrorBox :message="error" />
    <form class="grid gap-4 md:grid-cols-2" @submit.prevent="save">
      <div class="md:col-span-2">
        <label class="label" for="ex-concept">Concepto *</label>
        <input id="ex-concept" v-model="form.concept" class="input" required placeholder="Ej: Hosting plan Business" />
      </div>
      <div>
        <label class="label" for="ex-category">Categoría</label>
        <select id="ex-category" v-model="form.category" class="input">
          <option v-for="c in EXPENSE_CATEGORIES" :key="c" :value="c">{{ label(c) }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="ex-provider">Proveedor</label>
        <input id="ex-provider" v-model="form.provider" class="input" placeholder="Hostinger, Elementor…" />
      </div>
      <div>
        <label class="label" for="ex-amount">Monto *</label>
        <input id="ex-amount" v-model="form.amount" class="input" type="number" min="0" step="0.01" required />
      </div>
      <div>
        <label class="label" for="ex-frequency">Frecuencia</label>
        <select id="ex-frequency" v-model="form.frequency" class="input">
          <option v-for="f in EXPENSE_FREQUENCIES" :key="f" :value="f">{{ label(f) }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="ex-start">{{ form.frequency === 'unica' ? 'Fecha' : 'Primer cobro' }}</label>
        <input id="ex-start" v-model="form.start_date" class="input" type="date" required />
      </div>
      <div v-if="form.frequency !== 'unica'">
        <label class="label" for="ex-end">Fin (si se canceló)</label>
        <input id="ex-end" v-model="form.end_date" class="input" type="date" :min="form.start_date" />
      </div>

      <fieldset class="grid gap-4 rounded-md border border-slate-200 p-4 md:col-span-2 md:grid-cols-3">
        <legend class="px-1 text-xs text-slate-500">¿A qué corresponde? (opcional — vacío = gasto interno)</legend>
        <div>
          <label class="label" for="ex-client">Cliente</label>
          <select id="ex-client" v-model="form.client_id" class="input" @change="onClientChange">
            <option value="">—</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="ex-site">Sitio</label>
          <select id="ex-site" v-model="form.site_id" class="input" @change="onLinkChange('site')">
            <option value="">—</option>
            <option v-for="s in clientSites" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="ex-project">Proyecto</label>
          <select id="ex-project" v-model="form.project_id" class="input" @change="onLinkChange('project')">
            <option value="">—</option>
            <option v-for="p in clientProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <p class="text-xs text-slate-500 md:col-span-3">Solo los gastos ligados a un proyecto suman a su costo.</p>
      </fieldset>

      <label class="flex items-center gap-2 text-sm md:col-span-2">
        <input v-model="rebillable" type="checkbox" /> Se le cobra al cliente
      </label>
      <div class="md:col-span-2">
        <label class="label" for="ex-notes">Notas</label>
        <textarea id="ex-notes" v-model="form.notes" class="input" rows="2" />
      </div>
      <div class="flex items-center justify-between gap-2 md:col-span-2">
        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar' }}</button>
        <button v-if="!isNew" class="text-sm text-red-700 hover:underline" type="button" @click="remove">Eliminar gasto</button>
      </div>
    </form>
  </AppModal>
</template>
