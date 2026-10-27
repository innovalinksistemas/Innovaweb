<script setup lang="ts">
import { label } from '@/lib/labels';

defineProps<{ value: string }>();

const tones: Record<string, string> = {
  // Clientes / sitios
  activo: 'bg-green-100 text-green-800',
  desarrollo: 'bg-blue-100 text-blue-800',
  mantenimiento: 'bg-amber-100 text-amber-800',
  pausado: 'bg-slate-200 text-slate-700',
  inactivo: 'bg-slate-200 text-slate-700',
  archivado: 'bg-slate-200 text-slate-500',
  astro: 'bg-orange-100 text-orange-800',
  wordpress: 'bg-sky-100 text-sky-800',
  dominio: 'bg-violet-100 text-violet-800',
  hosting: 'bg-teal-100 text-teal-800',
  // Proyectos
  planificacion: 'bg-slate-100 text-slate-700',
  en_curso: 'bg-blue-100 text-blue-800',
  en_pausa: 'bg-amber-100 text-amber-800',
  completado: 'bg-green-100 text-green-800',
  cancelado: 'bg-slate-200 text-slate-500',
  // Tareas
  pendiente: 'bg-slate-100 text-slate-700',
  en_progreso: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-violet-100 text-violet-800',
  completada: 'bg-green-100 text-green-800',
  // Prioridad
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-sky-100 text-sky-800',
  alta: 'bg-amber-100 text-amber-800',
  urgente: 'bg-red-100 text-red-800',
  // Seguimientos
  nota: 'bg-slate-100 text-slate-700',
  reunion: 'bg-sky-100 text-sky-800',
  decision: 'bg-violet-100 text-violet-800',
  importante: 'bg-amber-100 text-amber-800',
  proximo_paso: 'bg-indigo-100 text-indigo-800',
  // Gastos
  plugin: 'bg-pink-100 text-pink-800',
  licencia: 'bg-cyan-100 text-cyan-800',
  suscripcion: 'bg-fuchsia-100 text-fuchsia-800',
  servicio: 'bg-lime-100 text-lime-800',
  unica: 'bg-slate-100 text-slate-700',
  mensual: 'bg-blue-100 text-blue-800',
  anual: 'bg-violet-100 text-violet-800',
  // Facturas
  borrador: 'bg-slate-100 text-slate-600',
  emitida: 'bg-blue-100 text-blue-800',
  anulada: 'bg-slate-200 text-slate-500 line-through',
  parcial: 'bg-amber-100 text-amber-800',
  pagada: 'bg-green-100 text-green-800',
  vencida: 'bg-red-100 text-red-800',
};
</script>

<template>
  <span class="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" :class="tones[value] ?? 'bg-slate-100 text-slate-700'">
    {{ label(value) }}
  </span>
</template>
