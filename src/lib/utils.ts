/** Crea valores de formulario a partir de un registro (null → ''). */
export function toForm<K extends string>(fields: readonly K[], source: Partial<Record<K, unknown>> = {}) {
  const out = {} as Record<K, string>;
  for (const f of fields) out[f] = source[f] == null ? '' : String(source[f]);
  return out;
}

/** Convierte valores de formulario en registro para la base ('' → null). */
export function toRecord<K extends string>(values: Record<K, string>) {
  const out = {} as Record<K, string | null>;
  for (const k in values) {
    const v = values[k].trim();
    out[k] = v === '' ? null : v;
  }
  return out;
}

/** Días desde hoy hasta la fecha (negativo si ya pasó). */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function daysLabel(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return `venció hace ${-days} días`;
  if (days === 0) return 'vence hoy';
  return `en ${days} días`;
}

/** Clase de color según cuántos días faltan para un vencimiento. */
export function expiryTone(days: number | null): string {
  if (days === null) return 'text-slate-400';
  if (days < 0) return 'text-red-700 font-semibold';
  if (days <= 30) return 'text-amber-700 font-semibold';
  return 'text-slate-700';
}

/** Fecha (yyyy-mm-dd) de hoy + n días, en la hora local del navegador (no UTC). */
export function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
