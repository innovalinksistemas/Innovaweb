<script setup lang="ts">
import { reactive } from 'vue';
import { CLIENT_FIELDS, CLIENT_STATUSES, type Client, type ClientField } from '@/lib/types';
import { toForm } from '@/lib/utils';

const props = defineProps<{ initial?: Partial<Client>; submitLabel: string; busy?: boolean }>();
const emit = defineEmits<{ submit: [values: Record<ClientField, string>] }>();

const form = reactive(toForm(CLIENT_FIELDS, { status: 'activo', ...props.initial }));
</script>

<template>
  <form class="card grid gap-4 md:grid-cols-2" @submit.prevent="emit('submit', { ...form })">
    <div class="md:col-span-2">
      <label class="label" for="name">Nombre del cliente *</label>
      <input id="name" v-model="form.name" class="input" required />
    </div>
    <div>
      <label class="label" for="contact_name">Persona de contacto</label>
      <input id="contact_name" v-model="form.contact_name" class="input" />
    </div>
    <div>
      <label class="label" for="email">Correo</label>
      <input id="email" v-model="form.email" class="input" type="email" />
    </div>
    <div>
      <label class="label" for="phone">Teléfono</label>
      <input id="phone" v-model="form.phone" class="input" />
    </div>
    <div>
      <label class="label" for="tax_id">RUC / RFC / NIT</label>
      <input id="tax_id" v-model="form.tax_id" class="input" />
    </div>
    <div>
      <label class="label" for="status">Estado</label>
      <select id="status" v-model="form.status" class="input capitalize">
        <option v-for="s in CLIENT_STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <div class="md:col-span-2">
      <label class="label" for="notes">Notas</label>
      <textarea id="notes" v-model="form.notes" class="input" rows="3" />
    </div>
    <div class="md:col-span-2">
      <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Guardando…' : submitLabel }}</button>
    </div>
  </form>
</template>
