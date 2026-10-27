-- Etapa 0 + 1: equipo, clientes y sitios.
-- Ejecutar en Supabase → SQL Editor (o con `npx supabase db push`).

-- ---------------------------------------------------------------
-- Equipo: solo estos correos pueden leer/escribir datos.
-- ---------------------------------------------------------------
create table if not exists public.team_members (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  full_name     text,
  hourly_cost   numeric(12,2),          -- se usará en la Etapa 3 (costeo)
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where active and lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Mantiene updated_at al día.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  tax_id        text,                   -- RUC / RFC / NIT
  status        text not null default 'activo'
                check (status in ('activo', 'pausado', 'inactivo')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Sitios
-- ---------------------------------------------------------------
create table if not exists public.sites (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients(id) on delete cascade,
  name                  text not null,
  url                   text not null,
  platform              text not null default 'wordpress'
                        check (platform in ('astro', 'wordpress', 'otro')),
  status                text not null default 'activo'
                        check (status in ('activo', 'desarrollo', 'mantenimiento', 'pausado', 'archivado')),
  -- Hosting
  hosting_provider      text,
  hosting_panel_url     text,
  hosting_renewal_date  date,
  -- Dominio
  domain_registrar      text,
  domain_expiry_date    date,
  -- Accesos rápidos (nunca contraseñas: solo enlaces)
  admin_url             text,           -- wp-admin, CMS, etc.
  repo_url              text,           -- GitHub
  deploy_url            text,           -- Vercel / Netlify
  credentials_url       text,           -- enlace al gestor de contraseñas
  -- Analítica (Etapa 4)
  ga4_property_id       text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists sites_client_id_idx on public.sites(client_id);

create trigger sites_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Seguridad por filas: solo miembros activos del equipo.
-- ---------------------------------------------------------------
alter table public.team_members enable row level security;
alter table public.clients      enable row level security;
alter table public.sites        enable row level security;

create policy "equipo lee equipo" on public.team_members
  for select to authenticated using (public.is_team_member());

create policy "equipo gestiona clientes" on public.clients
  for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());

create policy "equipo gestiona sitios" on public.sites
  for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());

-- ---------------------------------------------------------------
-- IMPORTANTE: agrega tu correo (y el de tu equipo) después de correr esto:
--   insert into public.team_members (email, full_name) values ('tu@correo.com', 'Tu Nombre');
-- ---------------------------------------------------------------
