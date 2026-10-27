import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import DashboardLayout from '@/layouts/DashboardLayout.vue';

declare module 'vue-router' {
  interface RouteMeta {
    /** Página accesible sin sesión. */
    public?: boolean;
    /** Solo para visitantes sin sesión (login, recuperar). */
    guestOnly?: boolean;
    title?: string;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true, guestOnly: true, title: 'Iniciar sesión' } },
    { path: '/recuperar', component: () => import('@/views/RecoverView.vue'), meta: { public: true, guestOnly: true, title: 'Recuperar contraseña' } },
    { path: '/nueva-contrasena', component: () => import('@/views/NewPasswordView.vue'), meta: { title: 'Nueva contraseña' } },
    {
      path: '/',
      component: DashboardLayout,
      children: [
        { path: '', component: () => import('@/views/HomeView.vue'), meta: { title: 'Inicio' } },
        { path: 'clientes', component: () => import('@/views/clients/ClientsList.vue'), meta: { title: 'Clientes' } },
        { path: 'clientes/nuevo', component: () => import('@/views/clients/ClientNew.vue'), meta: { title: 'Nuevo cliente' } },
        { path: 'clientes/:id', component: () => import('@/views/clients/ClientDetail.vue'), props: true, meta: { title: 'Cliente' } },
        { path: 'sitios', component: () => import('@/views/sites/SitesList.vue'), meta: { title: 'Sitios' } },
        { path: 'sitios/nuevo', component: () => import('@/views/sites/SiteNew.vue'), meta: { title: 'Nuevo sitio' } },
        { path: 'sitios/:id', component: () => import('@/views/sites/SiteDetail.vue'), props: true, meta: { title: 'Sitio' } },
        { path: 'proyectos', component: () => import('@/views/projects/ProjectsList.vue'), meta: { title: 'Proyectos' } },
        { path: 'proyectos/nuevo', component: () => import('@/views/projects/ProjectNew.vue'), meta: { title: 'Nuevo proyecto' } },
        { path: 'proyectos/:id', component: () => import('@/views/projects/ProjectDetail.vue'), props: true, meta: { title: 'Proyecto' } },
        { path: 'tareas', component: () => import('@/views/TasksView.vue'), meta: { title: 'Tareas' } },
        { path: 'costeo', component: () => import('@/views/CostingView.vue'), meta: { title: 'Costeo' } },
        { path: 'facturas/:id', component: () => import('@/views/InvoiceDetail.vue'), props: true, meta: { title: 'Factura' } },
        { path: 'equipo', component: () => import('@/views/TeamView.vue'), meta: { title: 'Equipo' } },
        { path: 'analitica', component: () => import('@/views/AnalyticsView.vue'), meta: { title: 'Analítica' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.init();

  // Tiene sesión en Supabase pero no está en team_members → fuera.
  if (auth.user && !auth.isMember) {
    await auth.signOut();
    return { path: '/login', query: { error: 'no-autorizado' } };
  }
  if (to.meta.guestOnly && auth.isAuthenticated) return '/';
  if (!to.meta.public && !auth.isAuthenticated) {
    return { path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} };
  }
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Innovaweb` : 'Innovaweb';
});
