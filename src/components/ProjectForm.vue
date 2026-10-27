<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { PROJECT_FIELDS, PROJECT_STATUSES, type Client, type Project, type ProjectField, type Site } from '@/lib/types';
import { label } from '@/lib/labels';
import { toForm } from '@/lib/utils';

const props = defineProps<{
  initial?: Partial<Project>;
  clients: Pick<Client, 'id' | 'name'>[];
  sites: Pick<Site, 'id' | 'name' | 'client_id'>[];
  submitLabel: string;
  busy?: boolean;
}>();
const emit = defineEmits<{ submit: [values: Record<ProjectField, string>] }>();

const form = reactive(toForm(PROJECT_FIELDS, { status: 'planificacion', ...props.initial }));

// Solo los sitios del cliente elegido; si cambia el cliente, se limpia el sitio.
const clientSites = computed(() => props.sites.filter((s) => s.client_id === form.client_id));
watch(
  () => form.client_id,
  () => {
    if (!clientSites.value.some((s) => s.id === form.site_id)) form.site_id = '';
  },
);
</script>

<template>
  <form class="card grid gap-4 md:grid-cols-2" @submit.prevent="emit('submit', { ...form })">
    <div class="md:col-span-2">
      <label class="label" for="name">Nombre del proyecto *</label>
      <input id="name" v-model="form.name" class="input" required placeholder="Ej: Rediseño web 2026" />
    </div>
    <div>
      <label class="label" for="client_id">Cliente *</label>
      <select id="client_id" v-model="form.client_id" class="input" required>
        <option value="">Selecciona…</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>
    <div>
      <label class="label" for="site_id">Sitio (opcional)</label>
      <select id="site_id" v-model="form.site_id" class="input" :disabled="!form.client_id">
        <option value="">{{ form.client_id ? (clientSites.length ? 'Ninguno' : 'Este cliente no tiene sitios') : 'Elige un cliente primero' }}</option>
        <option v-for="s in clientSites" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </div>
    <div>
      <label class="label" for="status">Estado</label>
      <select id="status" v-model="form.status" class="input">
        <option v-for="s in PROJECT_STATUSES" :key="s" :value="s">{{ label(s) }}</option>
      </select>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label" for="start_date">Inicio</label>
        <input id="start_date" v-model="form.start_date" class="input" type="date" />
      </div>
      <div>
        <label class="label" for="due_date">Entrega</label>
        <input id="due_date" v-model="form.due_date" class="input" type="date" :min="form.start_date || undefined" />
      </div>
    </div>
    <div class="md:col-span-2">
      <label class="label" for="description">Descripción / alcance</label>
      <textarea id="description" v-model="form.description" class="input" rows="3" />
    </div>
    <div>
      <label class="label" for="budget">Presupuesto cotizado</label>
      <input id="budget" v-model="form.budget" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
    </div>
    <div>
      <label class="label" for="hourly_rate">Tarifa por hora</label>
      <input id="hourly_rate" v-model="form.hourly_rate" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
    </div>
    <p class="text-xs text-slate-500 md:col-span-2">El presupuesto y la tarifa se usarán en la Etapa 3 (costeo).</p>
    <div class="md:col-span-2">
      <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Guardando…' : submitLabel }}</button>
    </div>
  </form>
</template>
