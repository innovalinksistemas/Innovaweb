-- Etapa 4: analítica GA4.
-- Ejecutar DESPUÉS de 0004, en Supabase → SQL Editor.
--
-- Los datos los escribe la Edge Function `sync-ga4` (con la clave de servicio, que
-- salta RLS). El equipo solo los lee.

begin;

-- ---------------------------------------------------------------
-- Estado de la sincronización en cada sitio
-- ---------------------------------------------------------------
alter table public.sites add column if not exists ga4_last_sync_at timestamptz;
alter table public.sites add column if not exists ga4_last_error text;

-- Acepta "123456789" o "properties/123456789" y guarda solo el número.
create or replace function public.sites_normalize_ga4()
returns trigger
language plpgsql
as $$
begin
  if new.ga4_property_id is not null then
    new.ga4_property_id := nullif(regexp_replace(trim(new.ga4_property_id), '^properties/', ''), '');
    if new.ga4_property_id !~ '^[0-9]+$' then
      raise exception 'El ID de propiedad GA4 debe ser solo números (ej. 412345678). Lo encuentras en GA4 → Administrar → Detalles de la propiedad.'
        using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.ga4_property_id is distinct from old.ga4_property_id then
    new.ga4_last_sync_at := null;
    new.ga4_last_error := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sites_normalize_ga4 on public.sites;
create trigger sites_normalize_ga4
  before insert or update of ga4_property_id on public.sites
  for each row execute function public.sites_normalize_ga4();

-- ---------------------------------------------------------------
-- Métricas por día
-- ---------------------------------------------------------------
create table if not exists public.analytics_daily (
  site_id               uuid not null references public.sites(id) on delete cascade,
  date                  date not null,
  active_users          integer not null default 0,
  new_users             integer not null default 0,
  sessions              integer not null default 0,
  engaged_sessions      integer not null default 0,
  page_views            integer not null default 0,
  avg_session_duration  numeric(10,2) not null default 0,   -- segundos
  bounce_rate           numeric(6,4) not null default 0,     -- 0..1
  key_events            numeric(12,2) not null default 0,    -- conversiones
  synced_at             timestamptz not null default now(),
  primary key (site_id, date)
);

-- ---------------------------------------------------------------
-- Tops de los últimos 30 días (páginas, canales, dispositivos, países)
-- Se reemplazan completos en cada sincronización.
-- ---------------------------------------------------------------
create table if not exists public.analytics_breakdowns (
  site_id       uuid not null references public.sites(id) on delete cascade,
  dimension     text not null check (dimension in ('page', 'channel', 'device', 'country')),
  value         text not null,
  active_users  integer not null default 0,
  sessions      integer not null default 0,
  page_views    integer not null default 0,
  period_start  date not null,
  period_end    date not null,
  synced_at     timestamptz not null default now(),
  primary key (site_id, dimension, value)
);

-- ---------------------------------------------------------------
-- Historial de sincronizaciones (para revisar errores)
-- ---------------------------------------------------------------
create table if not exists public.analytics_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid references public.sites(id) on delete cascade,
  trigger       text not null default 'manual' check (trigger in ('manual', 'cron')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean,
  days          integer,
  error         text
);

create index if not exists analytics_sync_runs_site_idx on public.analytics_sync_runs(site_id, started_at desc);

-- ---------------------------------------------------------------
-- Seguridad: el equipo lee; solo la Edge Function (service role) escribe.
-- ---------------------------------------------------------------
alter table public.analytics_daily      enable row level security;
alter table public.analytics_breakdowns enable row level security;
alter table public.analytics_sync_runs  enable row level security;

drop policy if exists "equipo lee analitica" on public.analytics_daily;
create policy "equipo lee analitica" on public.analytics_daily
  for select to authenticated using (public.is_team_member());

drop policy if exists "equipo lee tops" on public.analytics_breakdowns;
create policy "equipo lee tops" on public.analytics_breakdowns
  for select to authenticated using (public.is_team_member());

drop policy if exists "equipo lee sincronizaciones" on public.analytics_sync_runs;
create policy "equipo lee sincronizaciones" on public.analytics_sync_runs
  for select to authenticated using (public.is_team_member());

commit;
