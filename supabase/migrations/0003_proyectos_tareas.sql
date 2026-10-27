-- Etapa 2: proyectos, tareas (kanban) y seguimientos.
-- Ejecutar DESPUÉS de 0002, en Supabase → SQL Editor.

begin;

-- ---------------------------------------------------------------
-- Proyectos
-- ---------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  site_id       uuid references public.sites(id) on delete set null,
  name          text not null,
  description   text,
  status        text not null default 'planificacion'
                check (status in ('planificacion', 'en_curso', 'en_pausa', 'completado', 'cancelado')),
  start_date    date,
  due_date      date,
  budget        numeric(12,2) check (budget is null or budget >= 0),       -- Etapa 3
  hourly_rate   numeric(12,2) check (hourly_rate is null or hourly_rate >= 0), -- Etapa 3
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint projects_dates_ok check (due_date is null or start_date is null or due_date >= start_date)
);

create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists projects_site_id_idx on public.projects(site_id);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- El sitio del proyecto debe pertenecer al mismo cliente.
create or replace function public.projects_check_site()
returns trigger
language plpgsql
as $$
begin
  if new.site_id is not null and not exists (
    select 1 from public.sites where id = new.site_id and client_id = new.client_id
  ) then
    raise exception 'El sitio elegido no pertenece al cliente del proyecto.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_check_site on public.projects;
create trigger projects_check_site
  before insert or update of site_id, client_id on public.projects
  for each row execute function public.projects_check_site();

-- ---------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  description   text,
  status        text not null default 'pendiente'
                check (status in ('pendiente', 'en_progreso', 'en_revision', 'completada')),
  priority      text not null default 'media'
                check (priority in ('baja', 'media', 'alta', 'urgente')),
  assignee_id   uuid references public.team_members(id) on delete set null,
  due_date      date,
  position      double precision not null default extract(epoch from clock_timestamp()),
  completed_at  timestamptz,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tasks_project_status_idx on public.tasks(project_id, status, position);
create index if not exists tasks_assignee_idx on public.tasks(assignee_id) where status <> 'completada';

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Marca/desmarca la fecha de finalización según el estado.
create or replace function public.tasks_set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completada' and (tg_op = 'INSERT' or old.status <> 'completada') then
    new.completed_at := now();
  elsif new.status <> 'completada' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_completed_at on public.tasks;
create trigger tasks_set_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.tasks_set_completed_at();

-- Reordena una columna del tablero en una sola llamada (al arrastrar una tarjeta).
-- security invoker: respeta las reglas de RLS del usuario que la llama.
create or replace function public.reorder_tasks(p_project uuid, p_status text, p_ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.tasks t
  set status = p_status,
      position = x.ord
  from unnest(p_ids) with ordinality as x(id, ord)
  where t.id = x.id
    and t.project_id = p_project;
$$;

revoke execute on function public.reorder_tasks(uuid, text, uuid[]) from public, anon;
grant execute on function public.reorder_tasks(uuid, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------
-- Seguimientos (bitácora del proyecto)
--   nota · reunion · decision · importante (punto importante) · proximo_paso
-- ---------------------------------------------------------------
create table if not exists public.follow_ups (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  kind          text not null default 'nota'
                check (kind in ('nota', 'reunion', 'decision', 'importante', 'proximo_paso')),
  content       text not null check (length(trim(content)) > 0),
  pinned        boolean not null default false,
  due_date      date,                       -- para próximos pasos
  done          boolean not null default false,
  done_at       timestamptz,
  author_id     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists follow_ups_project_idx on public.follow_ups(project_id, created_at desc);
create index if not exists follow_ups_open_steps_idx on public.follow_ups(due_date)
  where kind = 'proximo_paso' and not done;

drop trigger if exists follow_ups_updated_at on public.follow_ups;
create trigger follow_ups_updated_at
  before update on public.follow_ups
  for each row execute function public.set_updated_at();

create or replace function public.follow_ups_set_done_at()
returns trigger
language plpgsql
as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists follow_ups_set_done_at on public.follow_ups;
create trigger follow_ups_set_done_at
  before insert or update of done on public.follow_ups
  for each row execute function public.follow_ups_set_done_at();

-- Nombre del autor visible en la bitácora (sin exponer auth.users).
create or replace view public.follow_ups_with_author
with (security_invoker = true) as
  select f.*, tm.full_name as author_name, tm.email as author_email
  from public.follow_ups f
  left join public.team_members tm on tm.user_id = f.author_id;

-- ---------------------------------------------------------------
-- Seguridad por filas: solo miembros activos del equipo.
-- ---------------------------------------------------------------
alter table public.projects   enable row level security;
alter table public.tasks      enable row level security;
alter table public.follow_ups enable row level security;

drop policy if exists "equipo gestiona proyectos" on public.projects;
create policy "equipo gestiona proyectos" on public.projects
  for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());

drop policy if exists "equipo gestiona tareas" on public.tasks;
create policy "equipo gestiona tareas" on public.tasks
  for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());

drop policy if exists "equipo gestiona seguimientos" on public.follow_ups;
create policy "equipo gestiona seguimientos" on public.follow_ups
  for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());

commit;
