begin;

create table if not exists public.ruta_pilares_progreso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pilar_id text not null,
  tarea_id text not null,
  completada boolean not null default false,
  fecha date not null default current_date,
  puntos integer not null default 0 check (puntos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ruta_pilares_progreso_user_task_unique unique (user_id, pilar_id, tarea_id)
);

create index if not exists ruta_pilares_progreso_user_fecha_idx
  on public.ruta_pilares_progreso(user_id, fecha desc);

create index if not exists ruta_pilares_progreso_user_pilar_idx
  on public.ruta_pilares_progreso(user_id, pilar_id);

drop trigger if exists ruta_pilares_progreso_set_updated_at on public.ruta_pilares_progreso;
create trigger ruta_pilares_progreso_set_updated_at
before update on public.ruta_pilares_progreso
for each row execute function public.set_updated_at();

alter table public.ruta_pilares_progreso enable row level security;
alter table public.ruta_pilares_progreso force row level security;

drop policy if exists ruta_pilares_progreso_select_own on public.ruta_pilares_progreso;
create policy ruta_pilares_progreso_select_own on public.ruta_pilares_progreso
for select to authenticated
using (user_id = auth.uid());

drop policy if exists ruta_pilares_progreso_insert_own on public.ruta_pilares_progreso;
create policy ruta_pilares_progreso_insert_own on public.ruta_pilares_progreso
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists ruta_pilares_progreso_update_own on public.ruta_pilares_progreso;
create policy ruta_pilares_progreso_update_own on public.ruta_pilares_progreso
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists ruta_pilares_progreso_delete_own on public.ruta_pilares_progreso;
create policy ruta_pilares_progreso_delete_own on public.ruta_pilares_progreso
for delete to authenticated
using (user_id = auth.uid());

commit;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'ruta_pilares_progreso';

select policyname
from pg_policies
where schemaname = 'public'
  and tablename = 'ruta_pilares_progreso'
order by policyname;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ruta_pilares_progreso'
order by ordinal_position;

select 'migration_complete' as status;
