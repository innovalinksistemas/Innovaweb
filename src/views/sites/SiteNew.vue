<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import SiteForm from '@/components/SiteForm.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/useQuery';
import { toRecord } from '@/lib/utils';
import type { Client, SiteField } from '@/lib/types';

const route = useRoute();
const router = useRouter();
const busy = ref(false);
const error = ref<string | null>(null);
const preselected = typeof route.query.cliente === 'string' ? route.query.cliente : '';

const { data: clients, loading } = useQuery<Pick<Client, 'id' | 'name'>[]>(() =>
  supabase.from('clients').select('id, name').order('name'),
);

async function save(values: Record<SiteField, string>) {
  busy.value = true;
  const { data, error: err } = await supabase.from('sites').insert(toRecord(values)).select('id').single();
  busy.value = false;
  if (err) return (error.value = err.message);
  await router.push(`/sitios/${data.id}`);
}
</script>

<template>
  <PageHeader title="Nuevo sitio"><RouterLink class="btn-secondary" to="/sitios">Cancelar</RouterLink></PageHeader>
  <ErrorBox :message="error" />
  <LoadingState v-if="loading" />
  <p v-else-if="!clients?.length" class="card text-sm">
    Primero <RouterLink class="link" to="/clientes/nuevo">crea un cliente</RouterLink>.
  </p>
  <SiteForm v-else :initial="{ client_id: preselected }" :clients="clients" submit-label="Crear sitio" :busy="busy" @submit="save" />
</template>
