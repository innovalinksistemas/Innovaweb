/** Texto visible para los valores guardados en la base. */
export const LABELS: Record<string, string> = {
  // Proyectos
  planificacion: 'Planificación',
  en_curso: 'En curso',
  en_pausa: 'En pausa',
  completado: 'Completado',
  cancelado: 'Cancelado',
  // Tareas
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  en_revision: 'En revisión',
  completada: 'Completada',
  // Prioridad
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
  // Seguimientos
  nota: 'Nota',
  reunion: 'Reunión',
  decision: 'Decisión',
  importante: 'Punto importante',
  proximo_paso: 'Próximo paso',
  // Gastos
  hosting: 'Hosting',
  dominio: 'Dominio',
  plugin: 'Plugin',
  licencia: 'Licencia',
  suscripcion: 'Suscripción',
  servicio: 'Servicio',
  otro: 'Otro',
  unica: 'Único',
  mensual: 'Mensual',
  anual: 'Anual',
  // Facturas
  borrador: 'Borrador',
  emitida: 'Emitida',
  anulada: 'Anulada',
  parcial: 'Pago parcial',
  pagada: 'Pagada',
  vencida: 'Vencida',
};

export const label = (value: string) => LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);

/** Nombre corto de un miembro del equipo. */
export const memberName = (m: { full_name: string | null; email: string } | null | undefined) =>
  m ? m.full_name || m.email.split('@')[0] : 'Sin asignar';
