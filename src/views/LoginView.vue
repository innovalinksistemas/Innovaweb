<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { AuthError, useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const busy = ref(false);
const errorCode = ref<string | null>((route.query.error as string) ?? null);
const errorDetail = ref<string | null>(null);

const messages: Record<string, string> = {
  credenciales: 'Correo o contraseña incorrectos.',
  'sin-confirmar': 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada.',
  'no-autorizado': 'Tu cuenta no tiene acceso al panel. Pide que te agreguen al equipo.',
};
const errorText = computed(() => {
  if (!errorCode.value) return null;
  return messages[errorCode.value] ?? `No se pudo iniciar sesión: ${errorDetail.value ?? 'error desconocido'}`;
});

/** Solo rutas internas, para evitar redirecciones a otros sitios. */
function nextPath() {
  const next = route.query.next;
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

async function submit() {
  busy.value = true;
  errorCode.value = null;
  try {
    await auth.signIn(email.value.trim().toLowerCase(), password.value);
    await router.replace(nextPath());
  } catch (e) {
    errorCode.value = e instanceof AuthError ? e.code : 'otro';
    errorDetail.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AuthLayout subtitle="Iniciar sesión">
    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <div>
        <label class="label" for="email">Correo</label>
        <input id="email" v-model="email" class="input" type="email" required autocomplete="email" />
      </div>
      <div>
        <label class="label" for="password">Contraseña</label>
        <input id="password" v-model="password" class="input" type="password" required autocomplete="current-password" />
      </div>
      <p v-if="errorText" class="text-sm text-red-700">{{ errorText }}</p>
      <p v-else-if="route.query.actualizada" class="text-sm text-green-700">Contraseña actualizada. Ya puedes entrar.</p>
      <button class="btn w-full" type="submit" :disabled="busy">{{ busy ? 'Entrando…' : 'Entrar' }}</button>
      <p class="text-center text-sm"><RouterLink class="link" to="/recuperar">¿Olvidaste tu contraseña?</RouterLink></p>
    </form>
  </AuthLayout>
</template>
