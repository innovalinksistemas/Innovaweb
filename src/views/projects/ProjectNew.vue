<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import ProjectForm from '@/components/ProjectForm.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/useQuery';
import { toRecord } from '@/lib/utils';
import type { Client, ProjectField, Site } from '@/lib/types';

const route = useRoute();
const router = useRouter();
const busy = ref(false);
const error = ref<string | null>(null);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const initial = { client_id: str(route.query.cliente), site_id: str(route.query.sitio) };

const { data: clients, loading } = useQuery<Pick<Client, 'id' | 'name'>[]>(() => supabase.from('clients').select('id, name').order('name'));
const { data: sites } = useQuery<Pick<Site, 'id' | 'name' | 'client_id'>[]>(() => supabase.from('sites').select('id, name, client_id').order('name'));

async function save(values: Record<ProjectField, string>) {
  busy.value = true;
  const { data, error: err } = await supabase.from('projects').insert(toRecord(values)).select('id').single();
  busy.value = false;
  if (err) return (error.value = err.message);
  await router.push(`/proyectos/${data.id}`);
}
</script>

<template>
  <PageHeader title="Nuevo proyecto"><RouterLink class="btn-secondary" to="/proyectos">Cancelar</RouterLink></PageHeader>
  <ErrorBox :message="error" />
  <LoadingState v-if="loading" />
  <p v-else-if="!clients?.length" class="card text-sm">
    Primero <RouterLink class="link" to="/clientes/nuevo">crea un cliente</RouterLink>.
  </p>
  <ProjectForm v-else :initial="initial" :clients="clients" :sites="sites ?? []" submit-label="Crear proyecto" :busy="busy" @submit="save" />
</template>
