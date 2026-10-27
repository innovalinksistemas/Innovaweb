<script setup lang="ts">
import { reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/money';
import { useQuery } from '@/lib/useQuery';
import { resetTeam, useTeam } from '@/lib/useTeam';
import { useAuthStore } from '@/stores/auth';

type Member = { id: string; email: string; full_name: string | null; hourly_cost: number | null; active: boolean };

const auth = useAuthStore();
const { data, error: loadError, loading, reload } = useQuery<Member[]>(() =>
  supabase.from('team_members').select('id, email, full_name, hourly_cost, active').order('active', { ascending: false }).order('full_name'),
);

const editingId = ref<string | null>(null);
const draft = reactive({ full_name: '', hourly_cost: '' });
const error = ref<string | null>(null);

function edit(m: Member) {
  editingId.value = m.id;
  draft.full_name = m.full_name ?? '';
  draft.hourly_cost = m.hourly_cost == null ? '' : String(m.hourly_cost);
}

async function save(m: Member) {
  const { error: err } = await supabase.rpc('update_team_member', {
    p_id: m.id,
    p_full_name: draft.full_name,
    p_hourly_cost: draft.hourly_cost === '' ? null : Number(draft.hourly_cost),
  });
  if (err) return (error.value = err.message);
  error.value = null;
  editingId.value = null;
  resetTeam(); // refresca nombres en el resto del panel
  useTeam();
  await reload();
}
</script>

<template>
  <PageHeader title="Equipo" subtitle="Costo por hora interno de cada persona (se usa para calcular el costo real de los proyectos)" />
  <ErrorBox :message="error ?? loadError" />
  <LoadingState v-if="loading" />
  <div v-else class="card overflow-x-auto p-0">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-4 py-3">Persona</th>
          <th class="px-4 py-3">Costo por hora</th>
          <th class="px-4 py-3">Estado</th>
          <th class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="m in data" :key="m.id">
          <template v-if="editingId === m.id">
            <td class="px-4 py-3">
              <input v-model="draft.full_name" class="input" placeholder="Nombre completo" />
              <span class="mt-1 block text-xs text-slate-400">{{ m.email }}</span>
            </td>
            <td class="px-4 py-3"><input v-model="draft.hourly_cost" class="input w-32" type="number" min="0" step="0.01" placeholder="0.00" /></td>
            <td class="px-4 py-3" />
            <td class="space-x-3 px-4 py-3 text-right">
              <button class="btn" type="button" @click="save(m)">Guardar</button>
              <button class="link text-sm" type="button" @click="editingId = null">Cancelar</button>
            </td>
          </template>
          <template v-else>
            <td class="px-4 py-3">
              <span class="font-medium">{{ m.full_name || '—' }}</span>
              <span v-if="m.id === auth.member?.id" class="ml-1 text-xs text-indigo-600">(tú)</span>
              <span class="block text-xs text-slate-400">{{ m.email }}</span>
            </td>
            <td class="px-4 py-3" :class="{ 'text-amber-700': m.hourly_cost == null }">
              {{ m.hourly_cost == null ? 'Sin configurar' : money(m.hourly_cost) }}
            </td>
            <td class="px-4 py-3">{{ m.active ? 'Activo' : 'Inactivo' }}</td>
            <td class="px-4 py-3 text-right"><button class="link text-sm" type="button" @click="edit(m)">Editar</button></td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="card mt-6 text-sm text-slate-600">
    <p class="font-medium text-slate-800">¿Cómo agrego o quito personas?</p>
    <p class="mt-1">
      Por seguridad se hace desde Supabase: crea el usuario en <em>Authentication → Users</em> y luego, en el SQL Editor,
      <code class="rounded bg-slate-100 px-1">insert into public.team_members (email, full_name) values ('correo', 'Nombre');</code>
    </p>
    <p class="mt-2">Cambiar el costo por hora solo afecta las horas que se registren desde ahora; las anteriores mantienen su costo.</p>
  </div>
</template>
