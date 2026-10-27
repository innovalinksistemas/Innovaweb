-- Etapa 3: costeo — horas trabajadas, gastos, facturas y pagos.
-- Ejecutar DESPUÉS de 0003, en Supabase → SQL Editor.

begin;

-- ---------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------

-- ID de team_members del usuario con sesión (null si no es del equipo).
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.team_members where user_id = auth.uid() and active;
$$;

revoke execute on function public.current_member_id() from public, anon;
grant execute on function public.current_member_id() to authenticated;

-- Editar nombre y costo/hora de un miembro (sin poder tocar correo, usuario ni estado).
create or replace function public.update_team_member(p_id uuid, p_full_name text, p_hourly_cost numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_member() then
    raise exception 'Sin permiso' using errcode = 'insufficient_privilege';
  end if;
  if p_hourly_cost is not null and p_hourly_cost < 0 then
    raise exception 'El costo por hora no puede ser negativo.' using errcode = 'check_violation';
  end if;
  update public.team_members
  set full_name = nullif(trim(p_full_name), ''),
      hourly_cost = p_hourly_cost
  where id = p_id;
end;
$$;

revoke execute on function public.update_team_member(uuid, text, numeric) from public, anon;
grant execute on function public.update_team_member(uuid, text, numeric) to authenticated;

-- Cuántas veces se ha cobrado un gasto entre su inicio y `p_until` (incluido).
create or replace function public.expense_occurrences(p_start date, p_frequency text, p_end date, p_until date)
returns integer
language sql
immutable
as $$
  with lim as (select least(p_until, coalesce(p_end, p_until)) as u)
  select case
    when p_start > (select u from lim) then 0
    when p_frequency = 'unica' then 1
    when p_frequency = 'mensual' then
      (extract(year from age((select u from lim), p_start)) * 12
       + extract(month from age((select u from lim), p_start)))::int + 1
    when p_frequency = 'anual' then
      extract(year from age((select u from lim), p_start))::int + 1
    else 0
  end;
$$;

-- Próximo cobro de un gasto a partir de `p_from` (null si ya no habrá más).
create or replace function public.expense_next_due(p_start date, p_frequency text, p_end date, p_from date)
returns date
language plpgsql
immutable
as $$
declare
  step interval := case p_frequency when 'mensual' then interval '1 month' when 'anual' then interval '1 year' end;
  n int;
  candidate date;
begin
  if p_start >= p_from then
    candidate := p_start;
  elsif p_frequency = 'unica' then
    return null;
  else
    n := public.expense_occurrences(p_start, p_frequency, null, p_from) - 1;
    candidate := (p_start + step * n)::date;
    if candidate < p_from then
      candidate := (p_start + step * (n + 1))::date;
    end if;
  end if;
  if p_end is not null and candidate > p_end then
    return null;
  end if;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------
-- Horas trabajadas (con cronómetro)
--   Cronómetro en marcha: started_at con valor y hours = null.
-- ---------------------------------------------------------------
create table if not exists public.time_entries (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete set null,
  member_id     uuid references public.team_members(id) on delete set null,
  entry_date    date not null default current_date,
  hours         numeric(6,2),
  description   text,
  billable      boolean not null default true,
  cost_rate     numeric(12,2),               -- costo/hora del miembro al registrar
  started_at    timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint time_entries_hours_ok check (
    (hours is null and started_at is not null) or (hours > 0 and hours <= 24)
  )
);

create index if not exists time_entries_project_idx on public.time_entries(project_id, entry_date desc);
create index if not exists time_entries_member_idx on public.time_entries(member_id, entry_date desc);
-- Un solo cronómetro en marcha por persona.
create unique index if not exists time_entries_one_running_idx on public.time_entries(member_id) where hours is null;

drop trigger if exists time_entries_updated_at on public.time_entries;
create trigger time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

create or replace function public.time_entries_prepare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.member_id := coalesce(new.member_id, public.current_member_id());
  end if;

  if new.task_id is not null and not exists (
    select 1 from public.tasks where id = new.task_id and project_id = new.project_id
  ) then
    raise exception 'La tarea no pertenece al proyecto.' using errcode = 'check_violation';
  end if;

  -- Congela el costo/hora vigente del miembro (si cambia después, no altera lo ya registrado).
  if tg_op = 'INSERT' or new.member_id is distinct from old.member_id then
    select hourly_cost into new.cost_rate from public.team_members where id = new.member_id;
  end if;
  return new;
end;
$$;

drop trigger if exists time_entries_prepare on public.time_entries;
create trigger time_entries_prepare
  before insert or update on public.time_entries
  for each row execute function public.time_entries_prepare();

-- Inicia el cronómetro del usuario actual (detiene el anterior si había uno).
create or replace function public.start_timer(p_project uuid, p_task uuid default null, p_description text default null)
returns public.time_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  entry public.time_entries;
begin
  perform public.stop_timer();
  insert into public.time_entries (project_id, task_id, description, started_at, entry_date)
  values (p_project, p_task, nullif(trim(p_description), ''), now(), current_date)
  returning * into entry;
  return entry;
end;
$$;

-- Detiene el cronómetro del usuario actual y calcula las horas.
create or replace function public.stop_timer()
returns public.time_entries
language sql
security invoker
set search_path = public
as $$
  update public.time_entries
  set hours = least(24, greatest(0.01, round((extract(epoch from now() - started_at) / 3600.0)::numeric, 2))),
      ended_at = now()
  where member_id = public.current_member_id()
    and hours is null
  returning *;
$$;

revoke execute on function public.start_timer(uuid, uuid, text) from public, anon;
revoke execute on function public.stop_timer() from public, anon;
grant execute on function public.start_timer(uuid, uuid, text) to authenticated;
grant execute on function public.stop_timer() to authenticated;

-- ---------------------------------------------------------------
-- Gastos (únicos o recurrentes)
-- ---------------------------------------------------------------
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  site_id       uuid references public.sites(id) on delete set null,
  project_id    uuid references public.projects(id) on delete set null,
  concept       text not null check (length(trim(concept)) > 0),
  category      text not null default 'otro'
                check (category in ('hosting', 'dominio', 'plugin', 'licencia', 'suscripcion', 'servicio', 'otro')),
  provider      text,
  amount        numeric(12,2) not null check (amount >= 0),
  frequency     text not null default 'unica' check (frequency in ('unica', 'mensual', 'anual')),
  start_date    date not null default current_date,
  end_date      date,
  rebillable    boolean not null default false,    -- se le cobra al cliente
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint expenses_dates_ok check (end_date is null or end_date >= start_date)
);

create index if not exists expenses_site_idx on public.expenses(site_id);
create index if not exists expenses_project_idx on public.expenses(project_id);
create index if not exists expenses_client_idx on public.expenses(client_id);

drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- El cliente se deduce del proyecto o del sitio, y todo debe coincidir.
create or replace function public.expenses_check_links()
returns trigger
language plpgsql
as $$
declare
  project_client uuid;
  site_client uuid;
  derived uuid;
begin
  if new.project_id is not null then
    select client_id into project_client from public.projects where id = new.project_id;
  end if;
  if new.site_id is not null then
    select client_id into site_client from public.sites where id = new.site_id;
  end if;

  if project_client is not null and site_client is not null and project_client <> site_client then
    raise exception 'El sitio y el proyecto pertenecen a clientes distintos.' using errcode = 'check_violation';
  end if;

  derived := coalesce(project_client, site_client);
  if derived is not null and new.client_id is not null and new.client_id <> derived then
    raise exception 'El cliente del gasto no coincide con el de su sitio o proyecto.' using errcode = 'check_violation';
  end if;

  new.client_id := coalesce(derived, new.client_id);
  return new;
end;
$$;

drop trigger if exists expenses_check_links on public.expenses;
create trigger expenses_check_links
  before insert or update on public.expenses
  for each row execute function public.expenses_check_links();

-- ---------------------------------------------------------------
-- Facturas y pagos
-- ---------------------------------------------------------------
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete set null,
  number        text,
  concept       text,
  issue_date    date not null default current_date,
  due_date      date,
  subtotal      numeric(12,2) not null check (subtotal >= 0),
  tax_rate      numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  total         numeric(12,2) generated always as (round(subtotal * (1 + tax_rate / 100), 2)) stored,
  status        text not null default 'emitida' check (status in ('borrador', 'emitida', 'anulada')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint invoices_dates_ok check (due_date is null or due_date >= issue_date)
);

create unique index if not exists invoices_number_idx on public.invoices(lower(number)) where number is not null;
create index if not exists invoices_client_idx on public.invoices(client_id);
create index if not exists invoices_project_idx on public.invoices(project_id);

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create or replace function public.invoices_check_project()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects where id = new.project_id and client_id = new.client_id
  ) then
    raise exception 'El proyecto no pertenece al cliente de la factura.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_check_project on public.invoices;
create trigger invoices_check_project
  before insert or update of project_id, client_id on public.invoices
  for each row execute function public.invoices_check_project();

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices(id) on delete cascade,
  paid_date     date not null default current_date,
  amount        numeric(12,2) not null check (amount > 0),
  method        text,                       -- transferencia, efectivo, tarjeta…
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists payments_invoice_idx on public.payments(invoice_id);

-- No se puede pagar de más ni pagar facturas en borrador o anuladas.
create or replace function public.payments_check()
returns trigger
language plpgsql
as $$
declare
  inv public.invoices;
  already numeric;
begin
  select * into inv from public.invoices where id = new.invoice_id for update;
  if inv.status <> 'emitida' then
    raise exception 'Solo se pueden registrar pagos en facturas emitidas.' using errcode = 'check_violation';
  end if;
  select coalesce(sum(amount), 0) into already
  from public.payments
  where invoice_id = new.invoice_id and id <> new.id;
  if already + new.amount > inv.total then
    raise exception 'El pago supera el saldo pendiente (%).', inv.total - already using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_check on public.payments;
create trigger payments_check
  before insert or update on public.payments
  for each row execute function public.payments_check();

-- No se puede bajar el total de una factura por debajo de lo ya pagado.
create or replace function public.invoices_check_paid()
returns trigger
language plpgsql
as $$
declare
  paid numeric;
begin
  select coalesce(sum(amount), 0) into paid from public.payments where invoice_id = new.id;
  if paid > 0 and new.total < paid then
    raise exception 'El total no puede ser menor a lo ya pagado (%).', paid using errcode = 'check_violation';
  end if;
  if paid > 0 and new.status <> 'emitida' then
    raise exception 'La factura tiene pagos: elimínalos antes de pasarla a borrador o anularla.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_check_paid on public.invoices;
create trigger invoices_check_paid
  after update on public.invoices
  for each row execute function public.invoices_check_paid();

-- ---------------------------------------------------------------
-- Vistas de resumen (respetan RLS: security_invoker)
-- ---------------------------------------------------------------
create or replace view public.expenses_overview
with (security_invoker = true) as
  select
    e.*,
    case e.frequency when 'mensual' then e.amount when 'anual' then round(e.amount / 12, 2) end as monthly_equivalent,
    public.expense_next_due(e.start_date, e.frequency, e.end_date, current_date) as next_due,
    public.expense_occurrences(e.start_date, e.frequency, e.end_date, current_date) as occurrences,
    e.amount * public.expense_occurrences(e.start_date, e.frequency, e.end_date, current_date) as total_to_date
  from public.expenses e;

create or replace view public.invoices_overview
with (security_invoker = true) as
  select
    i.*,
    coalesce(p.paid, 0) as paid,
    case when i.status = 'emitida' then i.total - coalesce(p.paid, 0) else 0 end as balance,
    p.last_paid_date,
    case
      when i.status = 'anulada' then 'anulada'
      when i.status = 'borrador' then 'borrador'
      when coalesce(p.paid, 0) >= i.total then 'pagada'
      when i.due_date < current_date then 'vencida'
      when coalesce(p.paid, 0) > 0 then 'parcial'
      else 'pendiente'
    end as payment_status
  from public.invoices i
  left join lateral (
    select sum(amount) as paid, max(paid_date) as last_paid_date
    from public.payments where invoice_id = i.id
  ) p on true;

create or replace view public.project_financials
with (security_invoker = true) as
  select
    p.id as project_id,
    p.client_id,
    p.name,
    p.status,
    p.budget,
    p.hourly_rate,
    coalesce(t.hours, 0)          as hours,
    coalesce(t.billable_hours, 0) as billable_hours,
    coalesce(t.labor_cost, 0)     as labor_cost,
    t.missing_cost_hours,
    coalesce(e.expenses, 0)       as expenses_cost,
    coalesce(t.labor_cost, 0) + coalesce(e.expenses, 0) as total_cost,
    coalesce(t.billable_hours, 0) * coalesce(p.hourly_rate, 0) as billable_value,
    coalesce(i.invoiced, 0)       as invoiced,        -- con impuestos
    coalesce(i.invoiced_net, 0)   as invoiced_net,    -- sin impuestos (ingreso real)
    coalesce(i.collected, 0)      as collected,
    coalesce(i.invoiced, 0) - coalesce(i.collected, 0) as receivable
  from public.projects p
  left join lateral (
    select
      sum(hours) as hours,
      sum(hours) filter (where billable) as billable_hours,
      sum(hours * coalesce(cost_rate, 0)) as labor_cost,
      sum(hours) filter (where cost_rate is null) as missing_cost_hours
    from public.time_entries
    where project_id = p.id and hours is not null
  ) t on true
  left join lateral (
    select sum(amount * public.expense_occurrences(start_date, frequency, end_date, current_date)) as expenses
    from public.expenses
    where project_id = p.id
  ) e on true
  left join lateral (
    select sum(total) as invoiced, sum(subtotal) as invoiced_net, sum(paid) as collected
    from public.invoices_overview
    where project_id = p.id and status = 'emitida'
  ) i on true;

-- ---------------------------------------------------------------
-- Seguridad por filas
-- ---------------------------------------------------------------
alter table public.time_entries enable row level security;
alter table public.expenses     enable row level security;
alter table public.invoices     enable row level security;
alter table public.payments     enable row level security;

drop policy if exists "equipo gestiona horas" on public.time_entries;
create policy "equipo gestiona horas" on public.time_entries
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());

drop policy if exists "equipo gestiona gastos" on public.expenses;
create policy "equipo gestiona gastos" on public.expenses
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());

drop policy if exists "equipo gestiona facturas" on public.invoices;
create policy "equipo gestiona facturas" on public.invoices
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());

drop policy if exists "equipo gestiona pagos" on public.payments;
create policy "equipo gestiona pagos" on public.payments
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());

commit;
