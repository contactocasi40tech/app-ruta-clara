begin;

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sesiones_ruta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  fecha timestamptz not null default now(),
  motivo_consulta text not null default '',
  contexto_medicion_json jsonb not null default '{}'::jsonb,
  resumen_privado_json jsonb not null default '{}'::jsonb,
  plan_accion text not null default '',
  progreso smallint not null default 0 check (progreso between 0 and 100),
  completada boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.mediciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  sesion_id uuid references public.sesiones_ruta(id) on delete cascade,
  valor numeric,
  unidad text not null default 'mg/dL',
  origen_dato text not null default '',
  fecha date,
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mediciones_sesion_unique unique (sesion_id)
);

create table if not exists public.planes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  sesion_id uuid references public.sesiones_ruta(id) on delete cascade,
  fecha_inicio date not null default current_date,
  accion_elegida text not null default '',
  estado text not null default 'activo' check (estado in ('activo', 'completado', 'pausado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planes_sesion_unique unique (sesion_id)
);

create index if not exists sesiones_ruta_user_fecha_idx on public.sesiones_ruta(user_id, fecha desc);
create index if not exists mediciones_user_fecha_idx on public.mediciones(user_id, fecha desc);
create index if not exists planes_user_fecha_idx on public.planes(user_id, fecha_inicio desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sesiones_ruta_set_updated_at on public.sesiones_ruta;
create trigger sesiones_ruta_set_updated_at
before update on public.sesiones_ruta
for each row execute function public.set_updated_at();

drop trigger if exists mediciones_set_updated_at on public.mediciones;
create trigger mediciones_set_updated_at
before update on public.mediciones
for each row execute function public.set_updated_at();

drop trigger if exists planes_set_updated_at on public.planes;
create trigger planes_set_updated_at
before update on public.planes
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set nombre = excluded.nombre,
        email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

insert into public.users (id, nombre, email)
select
  id,
  coalesce(raw_user_meta_data ->> 'nombre', raw_user_meta_data ->> 'full_name', ''),
  coalesce(email, '')
from auth.users
on conflict (id) do update
set nombre = excluded.nombre,
    email = excluded.email;

alter table public.users enable row level security;
alter table public.sesiones_ruta enable row level security;
alter table public.mediciones enable row level security;
alter table public.planes enable row level security;

alter table public.users force row level security;
alter table public.sesiones_ruta force row level security;
alter table public.mediciones force row level security;
alter table public.planes force row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select to authenticated
using (id = auth.uid());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists sesiones_select_own on public.sesiones_ruta;
create policy sesiones_select_own on public.sesiones_ruta
for select to authenticated
using (user_id = auth.uid());

drop policy if exists sesiones_insert_own on public.sesiones_ruta;
create policy sesiones_insert_own on public.sesiones_ruta
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists sesiones_update_own on public.sesiones_ruta;
create policy sesiones_update_own on public.sesiones_ruta
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists sesiones_delete_own on public.sesiones_ruta;
create policy sesiones_delete_own on public.sesiones_ruta
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists mediciones_select_own on public.mediciones;
create policy mediciones_select_own on public.mediciones
for select to authenticated
using (user_id = auth.uid());

drop policy if exists mediciones_insert_own on public.mediciones;
create policy mediciones_insert_own on public.mediciones
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists mediciones_update_own on public.mediciones;
create policy mediciones_update_own on public.mediciones
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists mediciones_delete_own on public.mediciones;
create policy mediciones_delete_own on public.mediciones
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists planes_select_own on public.planes;
create policy planes_select_own on public.planes
for select to authenticated
using (user_id = auth.uid());

drop policy if exists planes_insert_own on public.planes;
create policy planes_insert_own on public.planes
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists planes_update_own on public.planes;
create policy planes_update_own on public.planes
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists planes_delete_own on public.planes;
create policy planes_delete_own on public.planes
for delete to authenticated
using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on public.sesiones_ruta to authenticated;
grant select, insert, update, delete on public.mediciones to authenticated;
grant select, insert, update, delete on public.planes to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

commit;
