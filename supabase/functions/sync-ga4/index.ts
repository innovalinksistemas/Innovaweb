// Edge Function: sincroniza métricas de Google Analytics 4 → Supabase.
//
// Cómo se llama:
//   • Desde el panel (botón "Sincronizar"): POST con la sesión del usuario.
//       body: { site_id?: string, days?: number }   (sin site_id = todos los sitios)
//       body: { action: "info" } → devuelve el correo de la cuenta de servicio.
//   • Desde pg_cron (diario): POST con el header  x-cron-secret: <CRON_SECRET>.
//
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   GA4_SERVICE_ACCOUNT  JSON completo de la cuenta de servicio de Google Cloud.
//   CRON_SECRET          Texto aleatorio; solo si usas la sincronización diaria.
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
//
// Desplegar con "Enforce JWT verification" DESACTIVADO (la función valida sola quién llama):
//   npx supabase functions deploy sync-ga4 --no-verify-jwt

type ServiceAccount = { client_email: string; private_key: string };
type Site = { id: string; name: string; ga4_property_id: string };
type GaRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type GaReport = { rows?: GaRow[] };

const DAILY_METRICS = [
  'activeUsers',
  'newUsers',
  'sessions',
  'engagedSessions',
  'screenPageViews',
  'averageSessionDuration',
  'bounceRate',
  'keyEvents',
] as const;

const BREAKDOWNS = [
  { dimension: 'page', gaDimension: 'pagePath', orderBy: 'screenPageViews' },
  { dimension: 'channel', gaDimension: 'sessionDefaultChannelGroup', orderBy: 'sessions' },
  { dimension: 'device', gaDimension: 'deviceCategory', orderBy: 'sessions' },
  { dimension: 'country', gaDimension: 'country', orderBy: 'activeUsers' },
] as const;

const BREAKDOWN_METRICS = ['activeUsers', 'sessions', 'screenPageViews'] as const;
const FIRST_SYNC_DAYS = 90;
const OVERLAP_DAYS = 3; // GA4 termina de procesar los datos en ~48-72 h
const TOP_N = 15;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
export function env(name: string): string | undefined {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  return g.Deno?.env?.get(name) ?? g.process?.env?.[name];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** "20261027" → "2026-10-27" */
export function gaDateToIso(v: string): string {
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Mensaje claro para los errores más comunes de Google. */
export function explainGoogleError(message: string, serviceEmail: string): string {
  if (/sufficient permissions|PERMISSION_DENIED/i.test(message)) {
    return `Sin permiso en esta propiedad. En GA4 → Administrar → Gestión de acceso a la propiedad, agrega ${serviceEmail} como "Lector".`;
  }
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(message)) {
    return 'La "Google Analytics Data API" no está habilitada en tu proyecto de Google Cloud. Habilítala en APIs y servicios → Biblioteca.';
  }
  if (/not found|NOT_FOUND|INVALID_ARGUMENT.*propert/i.test(message)) {
    return 'No se encontró la propiedad. Revisa que el ID de GA4 sea el de la propiedad (solo números), no el ID de medición (G-XXXX).';
  }
  return message;
}

// ---------------------------------------------------------------------------
// Google: token de acceso con la cuenta de servicio (JWT firmado RS256)
// ---------------------------------------------------------------------------
export async function getGoogleToken(sa: ServiceAccount, fetchFn: typeof fetch = fetch): Promise<string> {
  const pem = sa.private_key.replace(/\\n/g, '\n');
  const der = Uint8Array.from(
    atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${b64url(signature)}`;

  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`No se pudo autenticar con Google: ${body.error_description ?? body.error ?? res.status}`);
  }
  return body.access_token as string;
}

// ---------------------------------------------------------------------------
// GA4 Data API: un solo batchRunReports por sitio (diario + 4 tops)
// ---------------------------------------------------------------------------
export function buildBatchRequest(startDate: string, endDate: string, topStart: string) {
  return {
    requests: [
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: DAILY_METRICS.map((name) => ({ name })),
        limit: 1000,
        keepEmptyRows: true,
      },
      ...BREAKDOWNS.map((b) => ({
        dateRanges: [{ startDate: topStart, endDate }],
        dimensions: [{ name: b.gaDimension }],
        metrics: BREAKDOWN_METRICS.map((name) => ({ name })),
        orderBys: [{ metric: { metricName: b.orderBy }, desc: true }],
        limit: TOP_N,
      })),
    ],
  };
}

const int = (v: string | undefined) => Math.round(Number(v ?? 0));
const dec = (v: string | undefined) => Number(Number(v ?? 0).toFixed(4));

export function parseDaily(report: GaReport, siteId: string) {
  return (report.rows ?? []).map((r) => {
    const m = r.metricValues ?? [];
    return {
      site_id: siteId,
      date: gaDateToIso(r.dimensionValues?.[0]?.value ?? ''),
      active_users: int(m[0]?.value),
      new_users: int(m[1]?.value),
      sessions: int(m[2]?.value),
      engaged_sessions: int(m[3]?.value),
      page_views: int(m[4]?.value),
      avg_session_duration: Number(Number(m[5]?.value ?? 0).toFixed(2)),
      bounce_rate: dec(m[6]?.value),
      key_events: Number(Number(m[7]?.value ?? 0).toFixed(2)),
      synced_at: new Date().toISOString(),
    };
  });
}

export function parseBreakdown(report: GaReport, siteId: string, dimension: string, periodStart: string, periodEnd: string) {
  return (report.rows ?? [])
    .map((r) => ({
      site_id: siteId,
      dimension,
      value: (r.dimensionValues?.[0]?.value ?? '').slice(0, 500) || '(sin dato)',
      active_users: int(r.metricValues?.[0]?.value),
      sessions: int(r.metricValues?.[1]?.value),
      page_views: int(r.metricValues?.[2]?.value),
      period_start: periodStart,
      period_end: periodEnd,
      synced_at: new Date().toISOString(),
    }))
    // GA4 puede repetir "(not set)"; la clave primaria exige valores únicos.
    .filter((row, i, all) => all.findIndex((x) => x.value === row.value) === i);
}

// ---------------------------------------------------------------------------
// Supabase (REST con la clave de servicio)
// ---------------------------------------------------------------------------
function db(fetchFn: typeof fetch) {
  const url = env('SUPABASE_URL')!;
  const key = env('SUPABASE_SERVICE_ROLE_KEY')!;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  async function call(path: string, init: RequestInit = {}) {
    const res = await fetchFn(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  }

  return {
    sites: (siteId?: string): Promise<Site[]> =>
      call(`sites?select=id,name,ga4_property_id&ga4_property_id=not.is.null&status=neq.archivado${siteId ? `&id=eq.${encodeURIComponent(siteId)}` : ''}`),
    lastDate: async (siteId: string): Promise<string | null> => {
      const rows = await call(`analytics_daily?select=date&site_id=eq.${siteId}&order=date.desc&limit=1`);
      return rows?.[0]?.date ?? null;
    },
    upsert: (table: string, rows: unknown[], onConflict: string) =>
      rows.length
        ? call(`${table}?on_conflict=${onConflict}`, {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(rows),
          })
        : Promise.resolve(null),
    remove: (path: string) => call(path, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    insert: (table: string, row: unknown) =>
      call(table, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }),
    patch: (path: string, row: unknown) =>
      call(path, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) }),
  };
}

// ---------------------------------------------------------------------------
// Sincronizar un sitio
// ---------------------------------------------------------------------------
export async function syncSite(
  site: Site,
  token: string,
  opts: { days?: number; trigger: 'manual' | 'cron'; serviceEmail: string; today?: string },
  fetchFn: typeof fetch = fetch,
) {
  const store = db(fetchFn);
  const today = opts.today ?? isoDate(new Date());
  const [run] = await store.insert('analytics_sync_runs', { site_id: site.id, trigger: opts.trigger });

  try {
    const last = opts.days ? null : await store.lastDate(site.id);
    const startDate = last
      ? addDays(last, -OVERLAP_DAYS)
      : addDays(today, -Math.min(Math.max(opts.days ?? FIRST_SYNC_DAYS, 1), 730) + 1);
    const topStart = addDays(today, -29);

    const res = await fetchFn(`https://analyticsdata.googleapis.com/v1beta/properties/${site.ga4_property_id}:batchRunReports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBatchRequest(startDate, today, topStart)),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(explainGoogleError(body.error?.message ?? `Error ${res.status}`, opts.serviceEmail));

    const reports: GaReport[] = body.reports ?? [];
    const daily = parseDaily(reports[0] ?? {}, site.id);
    await store.upsert('analytics_daily', daily, 'site_id,date');

    await store.remove(`analytics_breakdowns?site_id=eq.${site.id}`);
    const tops = BREAKDOWNS.flatMap((b, i) => parseBreakdown(reports[i + 1] ?? {}, site.id, b.dimension, topStart, today));
    await store.upsert('analytics_breakdowns', tops, 'site_id,dimension,value');

    await store.patch(`sites?id=eq.${site.id}`, { ga4_last_sync_at: new Date().toISOString(), ga4_last_error: null });
    await store.patch(`analytics_sync_runs?id=eq.${run.id}`, { finished_at: new Date().toISOString(), ok: true, days: daily.length });
    return { site_id: site.id, name: site.name, ok: true, days: daily.length, from: startDate, to: today };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await store.patch(`sites?id=eq.${site.id}`, { ga4_last_error: error }).catch(() => {});
    await store.patch(`analytics_sync_runs?id=eq.${run.id}`, { finished_at: new Date().toISOString(), ok: false, error }).catch(() => {});
    return { site_id: site.id, name: site.name, ok: false, error };
  }
}

// ---------------------------------------------------------------------------
// Quién llama: cron (secreto) o un miembro del equipo (su sesión de Supabase)
// ---------------------------------------------------------------------------
async function authorize(req: Request, fetchFn: typeof fetch): Promise<'cron' | 'manual' | null> {
  const cronSecret = env('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return 'cron';

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const res = await fetchFn(`${env('SUPABASE_URL')}/rest/v1/rpc/is_team_member`, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_ANON_KEY') ?? env('SUPABASE_SERVICE_ROLE_KEY')!,
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  return res.ok && (await res.json()) === true ? 'manual' : null;
}

export async function handler(req: Request, fetchFn: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);

  const trigger = await authorize(req, fetchFn);
  if (!trigger) return json({ error: 'No autorizado' }, 401);

  const raw = env('GA4_SERVICE_ACCOUNT');
  if (!raw) return json({ error: 'Falta el secreto GA4_SERVICE_ACCOUNT en Supabase → Edge Functions → Secrets.' }, 500);
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) throw new Error();
  } catch {
    return json({ error: 'GA4_SERVICE_ACCOUNT no es un JSON válido de cuenta de servicio (debe tener client_email y private_key).' }, 500);
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === 'info') return json({ service_account_email: sa.client_email });

  try {
    const token = await getGoogleToken(sa, fetchFn);
    const sites = await db(fetchFn).sites(typeof body.site_id === 'string' ? body.site_id : undefined);
    const results = [];
    for (const site of sites) {
      results.push(await syncSite(site, token, { days: Number(body.days) || undefined, trigger, serviceEmail: sa.client_email }, fetchFn));
    }
    return json({ service_account_email: sa.client_email, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

// deno-lint-ignore no-explicit-any
const deno = (globalThis as any).Deno;
if (deno?.serve) deno.serve((req: Request) => handler(req));
