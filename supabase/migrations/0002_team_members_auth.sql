-- Relaciona team_members con los usuarios de Supabase Auth (auth.users).
-- Ejecutar DESPUÉS de 0001_base_inventario.sql, en Supabase → SQL Editor.
--
-- Qué garantiza a nivel de base de datos:
--   1. No se puede agregar a team_members un correo que no exista en Authentication → Users.
--   2. Cada miembro queda enlazado por ID (user_id), no solo por texto del correo.
--   3. Si se borra el usuario en Authentication, se borra su acceso automáticamente.
--   4. Si el usuario cambia su correo en Authentication, team_members se actualiza solo.
--   5. El permiso se verifica con auth.uid() (el ID del token), que no se puede falsificar.
--
-- Todo va en una transacción: si algo falla, no se aplica nada.

begin;

-- ---------------------------------------------------------------
-- 1. Columna user_id con llave foránea a auth.users
-- ---------------------------------------------------------------
alter table public.team_members
  add column if not exists user_id uuid unique references auth.users(id) on delete cascade;

-- Enlazar los miembros que ya existían, por correo.
update public.team_members tm
set user_id = u.id,
    email   = lower(u.email)
from auth.users u
where tm.user_id is null
  and lower(u.email) = lower(tm.email);

-- Si quedó algún correo sin usuario en Authentication, detenemos la migración
-- con un mensaje claro (no se borra nada).
do $$
declare
  orphans text;
begin
  select string_agg(email, ', ') into orphans
  from public.team_members
  where user_id is null;

  if orphans is not null then
    raise exception 'Estos correos de team_members no tienen usuario en Authentication: %. Créalos en Authentication → Users (o bórralos de team_members) y vuelve a ejecutar esta migración.', orphans;
  end if;
end;
$$;

alter table public.team_members alter column user_id set not null;

-- ---------------------------------------------------------------
-- 2. Al crear/editar un miembro: buscar su usuario en Authentication
-- ---------------------------------------------------------------
create or replace function public.team_members_link_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
begin
  new.email := lower(trim(new.email));

  select id into uid from auth.users where lower(email) = new.email;

  if uid is null then
    raise exception 'No existe un usuario en Authentication con el correo "%". Créalo primero en Authentication → Users.', new.email
      using errcode = 'foreign_key_violation';
  end if;

  new.user_id := uid;
  return new;
end;
$$;

drop trigger if exists team_members_link_user on public.team_members;
create trigger team_members_link_user
  before insert or update of email, user_id on public.team_members
  for each row execute function public.team_members_link_user();

-- ---------------------------------------------------------------
-- 3. Si el usuario cambia su correo en Authentication, sincronizarlo
-- ---------------------------------------------------------------
create or replace function public.sync_team_member_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.team_members
  set email = lower(new.email)
  where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_team_member_email();

-- ---------------------------------------------------------------
-- 4. Verificar membresía por ID del usuario autenticado
-- ---------------------------------------------------------------
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where active and user_id = auth.uid()
  );
$$;

-- Solo usuarios con sesión pueden consultar la función.
revoke execute on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

-- Las funciones de los triggers no deben poder llamarse directamente.
revoke execute on function public.team_members_link_user() from public, anon, authenticated;
revoke execute on function public.sync_team_member_email() from public, anon, authenticated;

commit;

-- ---------------------------------------------------------------
-- Consulta útil para revisar el equipo:
--   select tm.email, tm.full_name, tm.active, u.last_sign_in_at, u.email_confirmed_at
--   from public.team_members tm join auth.users u on u.id = tm.user_id;
-- ---------------------------------------------------------------
