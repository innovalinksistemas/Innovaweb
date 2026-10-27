import { supabase } from '@/lib/supabase';
import { isoInDays } from '@/lib/utils';

export interface DailyRow {
  site_id: string;
  date: string;
  active_users: number;
  new_users: number;
  sessions: number;
  engaged_sessions: number;
  page_views: number;
  avg_session_duration: number;
  bounce_rate: number;
  key_events: number;
}

export interface BreakdownRow {
  site_id: string;
  dimension: 'page' | 'channel' | 'device' | 'country';
  value: string;
  active_users: number;
  sessions: number;
  page_views: number;
  period_start: string;
  period_end: string;
}

export type MetricKey = 'active_users' | 'sessions' | 'page_views' | 'engagement_rate' | 'avg_session_duration' | 'key_events';

export const METRICS: { key: MetricKey; label: string; upIsGood: boolean; format: (v: number) => string }[] = [
  { key: 'active_users', label: 'Usuarios', upIsGood: true, format: (v) => compact(v) },
  { key: 'sessions', label: 'Sesiones', upIsGood: true, format: (v) => compact(v) },
  { key: 'page_views', label: 'Vistas de página', upIsGood: true, format: (v) => compact(v) },
  { key: 'engagement_rate', label: 'Tasa de interacción', upIsGood: true, format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: 'avg_session_duration', label: 'Duración media', upIsGood: true, format: (v) => duration(v) },
  { key: 'key_events', label: 'Conversiones', upIsGood: true, format: (v) => compact(v) },
];

const n = (v: unknown) => Number(v ?? 0);

/** 1234 → "1,2 mil"; 1250000 → "1,3 M" */
export function compact(v: number): string {
  return new Intl.NumberFormat('es', { notation: v >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(v);
}

export function duration(seconds: number): string {
  const s = Math.round(seconds);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

/** Suma un rango de días. Las tasas y promedios se ponderan por sesiones. */
export function summarize(rows: DailyRow[]): Record<MetricKey, number> {
  const sessions = rows.reduce((s, r) => s + n(r.sessions), 0);
  return {
    active_users: rows.reduce((s, r) => s + n(r.active_users), 0),
    sessions,
    page_views: rows.reduce((s, r) => s + n(r.page_views), 0),
    engagement_rate: sessions ? rows.reduce((s, r) => s + n(r.engaged_sessions), 0) / sessions : 0,
    avg_session_duration: sessions ? rows.reduce((s, r) => s + n(r.avg_session_duration) * n(r.sessions), 0) / sessions : 0,
    key_events: rows.reduce((s, r) => s + n(r.key_events), 0),
  };
}

/** Valor diario de una métrica (para gráficos). */
export function dailyValue(r: DailyRow, key: MetricKey): number {
  if (key === 'engagement_rate') return n(r.sessions) ? n(r.engaged_sessions) / n(r.sessions) : 0;
  return n(r[key]);
}

/** Cambio relativo; null si no hay base para comparar. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}

/** Divide filas en periodo actual (últimos `days`) y anterior (los `days` previos), rellenando días sin datos. */
export function splitPeriods(rows: DailyRow[], days: number, siteId = '') {
  const end = isoInDays(0);
  const start = isoInDays(-(days - 1));
  const prevStart = isoInDays(-(2 * days - 1));
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const current: DailyRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = isoInDays(-i);
    current.push(byDate.get(date) ?? emptyDay(siteId, date));
  }
  const previous = rows.filter((r) => r.date >= prevStart && r.date < start);
  return { current, previous, start, end };
}

function emptyDay(site_id: string, date: string): DailyRow {
  return { site_id, date, active_users: 0, new_users: 0, sessions: 0, engaged_sessions: 0, page_views: 0, avg_session_duration: 0, bounce_rate: 0, key_events: 0 };
}

export type SyncResult = { site_id: string; name: string; ok: boolean; days?: number; error?: string };

/** Llama a la Edge Function. Devuelve resultados o un error entendible. */
export async function syncGa4(body: { site_id?: string; days?: number; action?: 'info' } = {}) {
  const { data, error } = await supabase.functions.invoke('sync-ga4', { body });
  if (error) {
    // El cuerpo de la respuesta trae el mensaje de la función, si lo hay.
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        message = (await ctx.json()).error ?? message;
      } catch {
        /* sin cuerpo */
      }
    }
    if (/Failed to send|not found|404/i.test(message)) {
      message = 'La función sync-ga4 aún no está desplegada en Supabase. Sigue la guía de configuración.';
    }
    return { error: message, results: [] as SyncResult[], service_account_email: null as string | null };
  }
  return {
    error: (data?.error as string) ?? null,
    results: (data?.results ?? []) as SyncResult[],
    service_account_email: (data?.service_account_email as string) ?? null,
  };
}
