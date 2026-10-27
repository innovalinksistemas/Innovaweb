<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { useAuthStore } from '@/stores/auth';

// Se llega con sesión activa: desde el menú o desde el enlace de recuperación.
const auth = useAuthStore();
const router = useRouter();
const password = ref('');
const confirm = ref('');
const error = ref<string | null>(null);
const busy = ref(false);

async function submit() {
  error.value = null;
  if (password.value.length < 8) return (error.value = 'La contraseña debe tener al menos 8 caracteres.');
  if (password.value !== confirm.value) return (error.value = 'Las contraseñas no coinciden.');

  busy.value = true;
  const { error: updateError } = await auth.updatePassword(password.value);
  busy.value = false;
  if (updateError) return (error.value = updateError.message);

  await auth.signOut();
  await router.replace({ path: '/login', query: { actualizada: '1' } });
}
</script>

<template>
  <AuthLayout subtitle="Nueva contraseña">
    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <p class="text-sm text-slate-600">Cuenta: {{ auth.user?.email }}</p>
      <div>
        <label class="label" for="password">Nueva contraseña</label>
        <input id="password" v-model="password" class="input" type="password" minlength="8" required autocomplete="new-password" />
      </div>
      <div>
        <label class="label" for="confirm">Repite la contraseña</label>
        <input id="confirm" v-model="confirm" class="input" type="password" minlength="8" required autocomplete="new-password" />
      </div>
      <p v-if="error" class="text-sm text-red-700">{{ error }}</p>
      <button class="btn w-full" type="submit" :disabled="busy">Guardar contraseña</button>
      <p class="text-center text-sm"><RouterLink class="link" to="/">Volver al panel</RouterLink></p>
    </form>
  </AuthLayout>
</template>
