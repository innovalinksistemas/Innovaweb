import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { User } from '@supabase/supabase-js';
import type { TeamMember } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { resetTeam } from '@/lib/useTeam';

export class AuthError extends Error {
  constructor(public code: 'credenciales' | 'sin-confirmar' | 'no-autorizado' | 'otro', message: string) {
    super(message);
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  /** Fila de team_members del usuario (null si no es del equipo o está inactivo). */
  const member = ref<TeamMember | null>(null);
  const isMember = computed(() => member.value !== null);
  const isAuthenticated = computed(() => !!user.value && isMember.value);
  let ready: Promise<void> | null = null;

  /** Guarda el usuario y busca su fila activa en team_members (RLS solo la deja ver a miembros). */
  async function load(next: User | null) {
    user.value = next;
    if (!next) {
      member.value = null;
      resetTeam();
      return;
    }
    const { data } = await supabase
      .from('team_members')
      .select('id, user_id, email, full_name, active')
      .eq('user_id', next.id)
      .eq('active', true)
      .maybeSingle();
    member.value = (data as TeamMember | null) ?? null;
  }

  /** Se llama una vez: recupera la sesión guardada y escucha cambios. */
  function init() {
    ready ??= (async () => {
      const { data } = await supabase.auth.getSession();
      await load(data.session?.user ?? null);

      supabase.auth.onAuthStateChange((event, session) => {
        // No llamar a Supabase dentro del callback (puede bloquearse): diferimos.
        setTimeout(() => {
          if (event === 'SIGNED_OUT') void load(null);
          else if (session?.user && session.user.id !== user.value?.id) void load(session.user);
          else if (session?.user) user.value = session.user;
        }, 0);
      });
    })();
    return ready;
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'email_not_confirmed') throw new AuthError('sin-confirmar', error.message);
      if (error.code === 'invalid_credentials') throw new AuthError('credenciales', error.message);
      throw new AuthError('otro', error.message);
    }
    await load(data.user);
    if (!isMember.value) {
      await signOut();
      throw new AuthError('no-autorizado', 'Sin acceso al panel');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    await load(null);
  }

  async function sendRecovery(email: string) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });
  }

  async function updatePassword(password: string) {
    return supabase.auth.updateUser({ password });
  }

  return { user, member, isMember, isAuthenticated, init, signIn, signOut, sendRecovery, updatePassword };
});
