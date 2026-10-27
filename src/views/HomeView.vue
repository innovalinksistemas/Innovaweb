<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import { supabase } from '@/lib/supabase';
import { daysLabel, daysUntil, expiryTone, formatDate, isoInDays } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import type { TaskRow } from '@/lib/types';

type NextStep = {
  id: string;
  content: string;
  due_date: string | null;
  projects: { id: string; name: string } | null;
};

type UpcomingSite = {
  id: string;
  name: string;
  domain_expiry_date: string | null;
  hosting_renewal_date: string | null;
  clients: { name: string } | null;
};

const loading = ref(true);
const error = ref<string | null>(null);
const counts = ref({ clients: 0, projects: 0, sites: 0, astro: 0, wordpress: 0 });
const upcoming = ref<UpcomingSite[]>([]);
const limit = isoInDays(30);
const today = isoInDays(0);
const auth = useAuthStore();
const myTasks = ref<TaskRow[]>([]);
const overdueTasks = ref<TaskRow[]>([]);
const nextSteps = ref<NextStep[]>([]);

const activeSites = () => supabase.from('sites').select('id', { count: 'exact', head: true }).neq('status', 'archivado');

onMounted(async () => {
  const taskSelect = 'id, project_id, title, status, priority, assignee_id, due_date, projects(id, name, clients(name))';
  const [clients, projects, sites, astro, wordpress, soon, mine, overdue, steps] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'activo'),
    supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['planificacion', 'en_curso', 'en_pausa']),
    activeSites(),
    activeSites().eq('platform', 'astro'),
    activeSites().eq('platform', 'wordpress'),
    supabase
      .from('sites')
      .select('id, name, domain_expiry_date, hosting_renewal_date, clients(name)')
      .neq('status', 'archivado')
      .or(`domain_expiry_date.lte.${limit},hosting_renewal_date.lte.${limit}`),
    supabase
      .from('tasks')
      .select(taskSelect)
      .eq('assignee_id', auth.member?.id ?? '00000000-0000-0000-0000-000000000000')
      .neq('status', 'completada')
      .order('due_date', { nullsFirst: false })
      .limit(8),
    supabase.from('tasks').select(taskSelect).neq('status', 'completada').lt('due_date', today).order('due_date').limit(8),
    supabase
      .from('follow_ups')
      .select('id, content, due_date, projects(id, name)')
      .eq('kind', 'proximo_paso')
      .eq('done', false)
      .order('due_date', { nullsFirst: false })
      .limit(8),
  ]);
  error.value = [clients, projects, sites, astro, wordpress, soon, mine, overdue, steps].find((r) => r.error)?.error?.message ?? null;
  myTasks.value = (mine.data ?? []) as unknown as TaskRow[];
  overdueTasks.value = (overdue.data ?? []) as unknown as TaskRow[];
  nextSteps.value = (steps.data ?? []) as unknown as NextStep[];
  counts.value = {
    clients: clients.count ?? 0,
    projects: projects.count ?? 0,
    sites: sites.count ?? 0,
    astro: astro.count ?? 0,
    wordpress: wordpress.count ?? 0,
  };
  upcoming.value = (soon.data ?? []) as unknown as UpcomingSite[];
  loading.value = false;
});

const stats = computed(() => [
  { label: 'Clientes activos', value: counts.value.clients, to: '/clientes' },
  { label: 'Proyectos activos', value: counts.value.projects, to: '/proyectos' },
  { label: 'Sitios', value: counts.value.sites, to: '/sitios' },
  { label: 'Astro', value: counts.value.astro, to: '/sitios?plataforma=astro' },
  { label: 'WordPress', value: counts.value.wordpress, to: '/sitios?plataforma=wordpress' },
]);

// Un renglón por cada vencimiento (dominio u hosting) dentro de los próximos 30 días.
const expiries = computed(() =>
  upcoming.value
    .flatMap((site) => [
      { site, kind: 'dominio', date: site.domain_expiry_date },
      { site, kind: 'hosting', date: site.hosting_renewal_date },
    ])
    .filter((e): e is typeof e & { date: string } => !!e.date && e.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ ...e, days: daysUntil(e.date) })),
);
</script>

<template>
  <PageHeader title="Inicio" subtitle="Resumen de tus proyectos, tareas y sitios" />
  <ErrorBox :message="error" />
  <LoadingState v-if="loading" />
  <template v-else>
    <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <RouterLink v-for="s in stats" :key="s.label" :to="s.to" class="card hover:border-indigo-300">
        <p class="text-sm text-slate-500">{{ s.label }}</p>
        <p class="mt-1 text-3xl font-semibold">{{ s.value }}</p>
      </RouterLink>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <section class="card">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-medium">Mis tareas</h2>
          <RouterLink class="link text-xs" to="/tareas">Ver todas</RouterLink>
        </div>
        <p v-if="myTasks.length === 0" class="text-sm text-slate-500">No tienes tareas abiertas.</p>
        <ul v-else class="divide-y divide-slate-100 text-sm">
          <li v-for="t in myTasks" :key="t.id" class="py-2">
            <RouterLink class="font-medium hover:underline" :to="`/proyectos/${t.project_id}`">{{ t.title }}</RouterLink>
            <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{{ t.projects?.name }}</span>
              <AppBadge v-if="t.priority === 'alta' || t.priority === 'urgente'" :value="t.priority" />
              <span v-if="t.due_date" :class="expiryTone(daysUntil(t.due_date))">{{ formatDate(t.due_date) }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section class="card" :class="{ 'border-red-200': overdueTasks.length }">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-medium" :class="{ 'text-red-700': overdueTasks.length }">Tareas vencidas</h2>
          <RouterLink class="link text-xs" to="/tareas?responsable=todos&vencidas=1">Ver todas</RouterLink>
        </div>
        <p v-if="overdueTasks.length === 0" class="text-sm text-slate-500">Ninguna tarea vencida.</p>
        <ul v-else class="divide-y divide-slate-100 text-sm">
          <li v-for="t in overdueTasks" :key="t.id" class="py-2">
            <RouterLink class="font-medium hover:underline" :to="`/proyectos/${t.project_id}`">{{ t.title }}</RouterLink>
            <p class="mt-0.5 text-xs text-slate-500">
              {{ t.projects?.name }} · <span class="text-red-700">{{ daysLabel(daysUntil(t.due_date)) }}</span>
            </p>
          </li>
        </ul>
      </section>

      <section class="card">
        <h2 class="mb-3 font-medium">Próximos pasos</h2>
        <p v-if="nextSteps.length === 0" class="text-sm text-slate-500">Sin próximos pasos pendientes.</p>
        <ul v-else class="divide-y divide-slate-100 text-sm">
          <li v-for="f in nextSteps" :key="f.id" class="py-2">
            <p class="line-clamp-2">{{ f.content }}</p>
            <p class="mt-0.5 text-xs text-slate-500">
              <RouterLink v-if="f.projects" class="link" :to="`/proyectos/${f.projects.id}?vista=seguimientos`">{{ f.projects.name }}</RouterLink>
              <span v-if="f.due_date" :class="expiryTone(daysUntil(f.due_date))"> · {{ formatDate(f.due_date) }}</span>
            </p>
          </li>
        </ul>
      </section>
    </div>

    <section class="card mt-6">
      <h2 class="mb-3 font-medium">Vencimientos en los próximos 30 días</h2>
      <p v-if="expiries.length === 0" class="text-sm text-slate-500">Nada por vencer.</p>
      <ul v-else class="divide-y divide-slate-100 text-sm">
        <li v-for="e in expiries" :key="e.site.id + e.kind" class="flex items-center justify-between gap-3 py-2">
          <div>
            <RouterLink class="link font-medium" :to="`/sitios/${e.site.id}`">{{ e.site.name }}</RouterLink>
            <span class="ml-2 text-slate-500">{{ e.site.clients?.name }}</span>
          </div>
          <div class="text-right" :class="expiryTone(e.days)">
            <AppBadge :value="e.kind" /> {{ formatDate(e.date) }}
            <span class="block text-xs">{{ daysLabel(e.days) }}</span>
          </div>
        </li>
      </ul>
    </section>
  </template>
</template>
