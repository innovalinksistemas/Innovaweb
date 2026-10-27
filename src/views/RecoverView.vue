<script setup lang="ts">
import { ref } from 'vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const email = ref('');
const busy = ref(false);
const sent = ref(false);

async function submit() {
  busy.value = true;
  const { error } = await auth.sendRecovery(email.value.trim().toLowerCase());
  if (error) console.error('[auth] resetPasswordForEmail:', error.message);
  // Mismo mensaje exista o no el correo, para no revelar qué cuentas existen.
  sent.value = true;
  busy.value = false;
}
</script>

<template>
  <AuthLayout subtitle="Recuperar contraseña">
    <p v-if="sent" class="mt-6 rounded-md bg-green-50 p-3 text-sm text-green-800">
      Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.
    </p>
    <form v-else class="mt-6 space-y-4" @submit.prevent="submit">
      <div>
        <label class="label" for="email">Correo</label>
        <input id="email" v-model="email" class="input" type="email" required autocomplete="email" />
      </div>
      <button class="btn w-full" type="submit" :disabled="busy">Enviarme el enlace</button>
    </form>
    <p class="mt-4 text-center text-sm"><RouterLink class="link" to="/login">Volver a iniciar sesión</RouterLink></p>
  </AuthLayout>
</template>
