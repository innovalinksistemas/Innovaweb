<script setup lang="ts">
defineProps<{ serviceEmail?: string | null; compact?: boolean }>();
</script>

<template>
  <div class="card text-sm text-slate-700">
    <p class="font-medium text-slate-900">Conectar Google Analytics 4</p>
    <ol class="mt-2 list-decimal space-y-1.5 pl-5">
      <li>
        En <a class="link" href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud</a>: crea un proyecto,
        habilita <strong>Google Analytics Data API</strong> y crea una <strong>cuenta de servicio</strong> con una clave JSON.
      </li>
      <li>En Supabase → Edge Functions → Secrets: crea <code class="rounded bg-slate-100 px-1">GA4_SERVICE_ACCOUNT</code> y pega el JSON completo.</li>
      <li>Despliega la función <code class="rounded bg-slate-100 px-1">sync-ga4</code> (pasos en el README).</li>
      <li>
        En cada propiedad de GA4 → Administrar → Gestión de acceso: agrega
        <strong v-if="serviceEmail" class="break-all">{{ serviceEmail }}</strong>
        <span v-else>el correo de la cuenta de servicio</span> como <strong>Lector</strong>.
      </li>
      <li v-if="!compact">En cada sitio del panel, completa el <strong>ID de propiedad GA4</strong> (solo números, en GA4 → Administrar → Detalles de la propiedad).</li>
    </ol>
  </div>
</template>
