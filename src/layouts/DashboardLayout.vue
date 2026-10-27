<script setup lang="ts">
import { watch } from 'vue';
import TimerWidget from '@/components/TimerWidget.vue';
import { useTimerStore } from '@/stores/timer';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const timer = useTimerStore();

// Cronómetro del usuario (si dejó uno corriendo, se recupera al entrar).
watch(
  () => auth.member?.id ?? null,
  (id) => timer.load(id),
  { immediate: true },
);

const nav = [
  { to: '/', label: 'Inicio' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/sitios', label: 'Sitios' },
  { to: '/proyectos', label: 'Proyectos' },
  { to: '/tareas', label: 'Tareas' },
  { to: '/costeo', label: 'Costeo' },
  { to: '/analitica', label: 'Analítica' },
  { to: '/equipo', label: 'Equipo' },
];
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to));

// Si la sesión se cierra (por ejemplo en otra pestaña), volvemos al login.
watch(
  () => auth.isAuthenticated,
  (ok) => {
    if (!ok) router.replace('/login');
  },
);

async function logout() {
  await auth.signOut();
}
</script>

<template>
  <div class="flex min-h-screen flex-col md:flex-row">
    <aside class="flex flex-col border-b border-slate-200 bg-white md:w-56 md:border-r md:border-b-0">
      <div class="px-5 py-4 text-lg font-semibold">Innovaweb</div>
      <nav class="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm"
          :class="isActive(item.to) ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-600 hover:bg-slate-50'"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="mt-auto md:pt-4"><TimerWidget /></div>
      <div class="flex items-center justify-between gap-3 border-t border-slate-200 p-4 text-xs text-slate-500 md:block">
        <p class="truncate" :title="auth.user?.email">{{ auth.user?.email }}</p>
        <div class="flex gap-3 md:mt-2 md:flex-col md:gap-1">
          <RouterLink class="link" to="/nueva-contrasena">Cambiar contraseña</RouterLink>
          <button class="link text-left" type="button" @click="logout">Cerrar sesión</button>
        </div>
      </div>
    </aside>
    <main class="flex-1 p-4 md:p-8">
      <div class="mx-auto max-w-6xl">
        <!-- Clave por ruta (no por query) para que los filtros en la URL no recarguen la vista. -->
        <RouterView :key="route.path" />
      </div>
    </main>
  </div>
</template>
