begin;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('Caminé', 'Troté', 'Corrí')),
  met numeric not null check (met > 0),
  weight_kg numeric not null check (weight_kg > 0 and weight_kg <= 300),
  duration_seconds integer not null check (duration_seconds >= 0),
  weather text check (weather in ('Soleado', 'Nublado', 'Lluvioso', 'Frío')),
  terrain text check (terrain in ('Plano', 'Destapado', 'Subida')),
  inclination_percent numeric not null default 0 check (inclination_percent between 0 and 15),
  kcal_burned numeric not null check (kcal_burned >= 0),
  bpm_manual integer check (bpm_manual between 30 and 220),
  bpm_camera integer check (bpm_camera between 30 and 220),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_recorded_at_idx
  on public.activity_logs (user_id, recorded_at desc);

alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;

drop policy if exists activity_logs_select_own on public.activity_logs;
create policy activity_logs_select_own on public.activity_logs
for select to authenticated using (user_id = auth.uid());

drop policy if exists activity_logs_insert_own on public.activity_logs;
create policy activity_logs_insert_own on public.activity_logs
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists activity_logs_update_own on public.activity_logs;
create policy activity_logs_update_own on public.activity_logs
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists activity_logs_delete_own on public.activity_logs;
create policy activity_logs_delete_own on public.activity_logs
for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.activity_logs to authenticated;

commit;
