<script setup lang="ts">
import { reactive } from 'vue';
import { PLATFORMS, SITE_FIELDS, SITE_STATUSES, type Client, type Site, type SiteField } from '@/lib/types';
import { toForm } from '@/lib/utils';

const props = defineProps<{
  initial?: Partial<Site>;
  clients: Pick<Client, 'id' | 'name'>[];
  submitLabel: string;
  busy?: boolean;
}>();
const emit = defineEmits<{ submit: [values: Record<SiteField, string>] }>();

const form = reactive(toForm(SITE_FIELDS, { platform: 'wordpress', status: 'activo', ...props.initial }));

type Field = { name: SiteField; label: string; type: 'text' | 'url' | 'date'; placeholder?: string };
const sections: { title: string; fields: Field[] }[] = [
  {
    title: 'Hosting y dominio',
    fields: [
      { name: 'hosting_provider', label: 'Proveedor de hosting', type: 'text', placeholder: 'Hostinger, SiteGround, Vercel…' },
      { name: 'hosting_panel_url', label: 'Panel de hosting (URL)', type: 'url' },
      { name: 'hosting_renewal_date', label: 'Renovación de hosting', type: 'date' },
      { name: 'domain_registrar', label: 'Registrador del dominio', type: 'text', placeholder: 'GoDaddy, Namecheap…' },
      { name: 'domain_expiry_date', label: 'Vencimiento del dominio', type: 'date' },
    ],
  },
  {
    title: 'Accesos rápidos',
    fields: [
      { name: 'admin_url', label: 'Administración (wp-admin, CMS)', type: 'url' },
      { name: 'repo_url', label: 'Repositorio (GitHub)', type: 'url' },
      { name: 'deploy_url', label: 'Deploy (Vercel / Netlify)', type: 'url' },
      { name: 'credentials_url', label: 'Credenciales (enlace al gestor de contraseñas)', type: 'url' },
    ],
  },
  {
    title: 'Analítica',
    fields: [{ name: 'ga4_property_id', label: 'ID de propiedad GA4', type: 'text', placeholder: 'Ej: 412345678 (solo números)' }],
  },
];
</script>

<template>
  <form class="space-y-6" @submit.prevent="emit('submit', { ...form })">
    <section class="card grid gap-4 md:grid-cols-2">
      <h2 class="font-medium md:col-span-2">Datos generales</h2>
      <div>
        <label class="label" for="name">Nombre del sitio *</label>
        <input id="name" v-model="form.name" class="input" required />
      </div>
      <div>
        <label class="label" for="url">URL *</label>
        <input id="url" v-model="form.url" class="input" type="url" required placeholder="https://" />
      </div>
      <div>
        <label class="label" for="client_id">Cliente *</label>
        <select id="client_id" v-model="form.client_id" class="input" required>
          <option value="">Selecciona…</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label" for="platform">Plataforma</label>
          <select id="platform" v-model="form.platform" class="input capitalize">
            <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="status">Estado</label>
          <select id="status" v-model="form.status" class="input capitalize">
            <option v-for="s in SITE_STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
      </div>
    </section>

    <section v-for="section in sections" :key="section.title" class="card grid gap-4 md:grid-cols-2">
      <h2 class="font-medium md:col-span-2">{{ section.title }}</h2>
      <div v-for="f in section.fields" :key="f.name">
        <label class="label" :for="f.name">{{ f.label }}</label>
        <input :id="f.name" v-model="form[f.name]" class="input" :type="f.type" :placeholder="f.placeholder" />
      </div>
    </section>

    <section class="card">
      <label class="label" for="notes">Notas</label>
      <textarea id="notes" v-model="form.notes" class="input" rows="3" />
    </section>

    <p class="text-xs text-slate-500">No guardes contraseñas aquí: usa el enlace al gestor de contraseñas.</p>
    <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Guardando…' : submitLabel }}</button>
  </form>
</template>
