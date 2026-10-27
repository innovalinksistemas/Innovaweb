const currency = import.meta.env.VITE_CURRENCY || 'USD';
const formatter = new Intl.NumberFormat('es', { style: 'currency', currency, minimumFractionDigits: 2 });

/** Formatea un monto en la moneda configurada (VITE_CURRENCY). */
export function money(value: number | string | null | undefined, empty = '—'): string {
  if (value === null || value === undefined || value === '') return empty;
  return formatter.format(Number(value));
}

export function hours(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString('es', { maximumFractionDigits: 2 })} h`;
}

export function percent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)}%`;
}

/** Convierte números que Supabase devuelve como texto (numeric) a number. */
export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
