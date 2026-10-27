<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import ClientForm from '@/components/ClientForm.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import { supabase } from '@/lib/supabase';
import { toRecord } from '@/lib/utils';
import type { ClientField } from '@/lib/types';

const router = useRouter();
const busy = ref(false);
const error = ref<string | null>(null);

async function save(values: Record<ClientField, string>) {
  busy.value = true;
  const { data, error: err } = await supabase.from('clients').insert(toRecord(values)).select('id').single();
  busy.value = false;
  if (err) return (error.value = err.message);
  await router.push(`/clientes/${data.id}`);
}
</script>

<template>
  <PageHeader title="Nuevo cliente"><RouterLink class="btn-secondary" to="/clientes">Cancelar</RouterLink></PageHeader>
  <ErrorBox :message="error" />
  <ClientForm submit-label="Crear cliente" :busy="busy" @submit="save" />
</template>
