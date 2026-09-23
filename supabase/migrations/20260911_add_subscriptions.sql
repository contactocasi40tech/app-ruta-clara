begin;

-- Estado de acceso comercial resumido para autorizar rápidamente la aplicación.
-- Se usa una política fail-closed: nadie queda activo hasta que exista una
-- suscripción vigente confirmada por el backend/webhook.
alter table public.users
  add column if not exists estado_suscripcion text not null default 'bloqueado',
  add column if not exists estado_suscripcion_actualizado_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_estado_suscripcion_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_estado_suscripcion_check
      check (estado_suscripcion in ('activo', 'bloqueado'));
  end if;
end
$$;

create table if not exists public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  proveedor text not null default 'hotmart'
    check (proveedor in ('hotmart')),
  referencia_externa text not null,
  producto_id text,
  oferta_id text,
  transaccion_id text,
  email_comprador text not null,
  estado text not null default 'pendiente'
    check (
      estado in (
        'pendiente',
        'activo',
        'atrasado',
        'cancelado',
        'expirado',
        'reembolsado',
        'contracargo',
        'bloqueado'
      )
    ),
  fecha_inicio timestamptz,
  vigente_hasta timestamptz,
  cancelada_at timestamptz,
  ultimo_evento_id text,
  ultimo_evento_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suscripciones_proveedor_referencia_unique
    unique (proveedor, referencia_externa)
);

comment on table public.suscripciones is
  'Suscripciones externas que controlan el acceso comercial a Ruta Clara.';
comment on column public.suscripciones.referencia_externa is
  'Identificador estable de la suscripción o compra en el proveedor.';
comment on column public.suscripciones.email_comprador is
  'Correo normalizado usado para vincular una compra con un usuario de Supabase.';
comment on column public.users.estado_suscripcion is
  'Estado de autorización comercial: activo o bloqueado.';

create index if not exists suscripciones_user_estado_idx
  on public.suscripciones(user_id, estado);
create index if not exists suscripciones_email_lower_idx
  on public.suscripciones(lower(email_comprador));
create index if not exists suscripciones_transaccion_idx
  on public.suscripciones(transaccion_id)
  where transaccion_id is not null;
create index if not exists users_estado_suscripcion_idx
  on public.users(estado_suscripcion);

drop trigger if exists suscripciones_set_updated_at on public.suscripciones;
create trigger suscripciones_set_updated_at
before update on public.suscripciones
for each row execute function public.set_updated_at();

-- Mantiene public.users.estado_suscripcion sincronizado con la fuente de verdad.
create or replace function public.recalcular_estado_suscripcion_usuario(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  update public.users as u
  set
    estado_suscripcion = case
      when exists (
        select 1
        from public.suscripciones as s
        where s.user_id = p_user_id
          and s.estado = 'activo'
          and (s.vigente_hasta is null or s.vigente_hasta > now())
      ) then 'activo'
      else 'bloqueado'
    end,
    estado_suscripcion_actualizado_at = now()
  where u.id = p_user_id;
end;
$$;

create or replace function public.sync_estado_suscripcion_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_estado_suscripcion_usuario(old.user_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.recalcular_estado_suscripcion_usuario(old.user_id);
  end if;

  perform public.recalcular_estado_suscripcion_usuario(new.user_id);
  return new;
end;
$$;

drop trigger if exists suscripciones_sync_user_status on public.suscripciones;
create trigger suscripciones_sync_user_status
after insert or update or delete on public.suscripciones
for each row execute function public.sync_estado_suscripcion_usuario();

-- Backfill seguro para usuarios existentes.
update public.users as u
set
  estado_suscripcion = case
    when exists (
      select 1
      from public.suscripciones as s
      where s.user_id = u.id
        and s.estado = 'activo'
        and (s.vigente_hasta is null or s.vigente_hasta > now())
    ) then 'activo'
    else 'bloqueado'
  end,
  estado_suscripcion_actualizado_at = now();

alter table public.suscripciones enable row level security;
alter table public.suscripciones force row level security;

drop policy if exists suscripciones_select_own on public.suscripciones;
create policy suscripciones_select_own on public.suscripciones
for select to authenticated
using (user_id = auth.uid());

-- El navegador solo puede leer su propia suscripción. Las escrituras quedan
-- reservadas al backend con service_role para impedir autoactivaciones.
revoke all on public.suscripciones from anon, authenticated;
grant select on public.suscripciones to authenticated;
grant all on public.suscripciones to service_role;

-- La política existente permite actualizar el perfil propio. Restringimos el
-- privilegio por columna para que el cliente no pueda editar el estado comercial.
revoke update on public.users from authenticated;
grant update (nombre) on public.users to authenticated;

revoke all on function public.recalcular_estado_suscripcion_usuario(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_estado_suscripcion_usuario()
  from public, anon, authenticated;
grant execute on function public.recalcular_estado_suscripcion_usuario(uuid)
  to service_role;
grant execute on function public.sync_estado_suscripcion_usuario()
  to service_role;

commit;
