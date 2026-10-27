import { shallowRef } from 'vue';
import { supabase } from '@/lib/supabase';
import type { TeamMember } from '@/lib/types';

// Lista del equipo compartida por toda la app (se carga una sola vez).
const team = shallowRef<TeamMember[]>([]);
let loading: Promise<void> | null = null;

export function useTeam() {
  loading ??= (async () => {
    const { data } = await supabase
      .from('team_members')
      .select('id, user_id, email, full_name, active')
      .eq('active', true)
      .order('full_name');
    team.value = (data as TeamMember[] | null) ?? [];
  })();
  const byId = (id: string | null) => team.value.find((m) => m.id === id) ?? null;
  return { team, byId, ready: loading };
}

/** Al cerrar sesión, olvidamos la lista para no mostrarla a otro usuario. */
export function resetTeam() {
  team.value = [];
  loading = null;
}
