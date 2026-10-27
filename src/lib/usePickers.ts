import { shallowRef } from 'vue';
import { supabase } from '@/lib/supabase';

export type PickClient = { id: string; name: string };
export type PickSite = { id: string; name: string; client_id: string };
export type PickProject = { id: string; name: string; client_id: string; site_id: string | null; status: string };
export type PickTask = { id: string; title: string; project_id: string; status: string };

/** Listas para los selects de los formularios (clientes, sitios, proyectos, tareas). */
export function usePickers(opts: { tasks?: boolean } = {}) {
  const clients = shallowRef<PickClient[]>([]);
  const sites = shallowRef<PickSite[]>([]);
  const projects = shallowRef<PickProject[]>([]);
  const tasks = shallowRef<PickTask[]>([]);

  const ready = Promise.all([
    supabase.from('clients').select('id, name').order('name').then(({ data }) => (clients.value = (data as PickClient[]) ?? [])),
    supabase.from('sites').select('id, name, client_id').order('name').then(({ data }) => (sites.value = (data as PickSite[]) ?? [])),
    supabase
      .from('projects')
      .select('id, name, client_id, site_id, status')
      .order('name')
      .then(({ data }) => (projects.value = (data as PickProject[]) ?? [])),
    opts.tasks
      ? supabase
          .from('tasks')
          .select('id, title, project_id, status')
          .order('position')
          .then(({ data }) => (tasks.value = (data as PickTask[]) ?? []))
      : Promise.resolve(),
  ]);

  return { clients, sites, projects, tasks, ready };
}
