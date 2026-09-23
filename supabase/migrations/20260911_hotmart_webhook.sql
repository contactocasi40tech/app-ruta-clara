begin;

-- Registro mínimo de eventos para idempotencia y auditoría sin guardar el
-- payload completo ni datos personales innecesarios.
create table if not exists public.hotmart_eventos (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_name text not null,
  event_at timestamptz not null,
  referencia_externa text not null,
  resultado text not null default 'recibido'
    check (resultado in ('recibido', 'procesado', 'duplicado', 'obsoleto')),
  created_at timestamptz not null default now()
);

create index if not exists hotmart_eventos_event_at_idx
  on public.hotmart_eventos(event_at desc);
create index if not exists hotmart_eventos_referencia_idx
  on public.hotmart_eventos(referencia_externa);

alter table public.hotmart_eventos enable row level security;
alter table public.hotmart_eventos force row level security;
revoke all on public.hotmart_eventos from public, anon, authenticated;
grant all on public.hotmart_eventos to service_role;

-- Procesa cada evento en una sola transacción. Solo service_role puede invocarla.
-- El evento se registra primero para neutralizar reintentos de Hotmart y la fila
-- de suscripción solo acepta eventos iguales o posteriores al último aplicado.
create or replace function public.process_hotmart_event(
  p_event_id text,
  p_event_name text,
  p_event_at timestamptz,
  p_referencia_externa text,
  p_product_id text,
  p_offer_id text,
  p_transaction_id text,
  p_buyer_email text,
  p_estado text,
  p_fecha_inicio timestamptz,
  p_vigente_hasta timestamptz,
  p_cancelada_at timestamptz,
  p_metadata_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_row_id uuid;
  v_user_id uuid;
  v_subscription_id uuid;
  v_latest_event_at timestamptz;
  v_email text;
begin
  if nullif(trim(p_event_id), '') is null
    or nullif(trim(p_event_name), '') is null
    or p_event_at is null
    or nullif(trim(p_referencia_externa), '') is null
    or nullif(trim(p_product_id), '') is null
    or nullif(trim(p_buyer_email), '') is null
  then
    raise exception 'missing required Hotmart event fields';
  end if;

  if p_estado not in (
    'pendiente', 'activo', 'atrasado', 'cancelado', 'expirado',
    'reembolsado', 'contracargo', 'bloqueado'
  ) then
    raise exception 'invalid subscription state';
  end if;

  v_email := lower(trim(p_buyer_email));

  insert into public.hotmart_eventos (
    event_id, event_name, event_at, referencia_externa, resultado
  ) values (
    p_event_id, p_event_name, p_event_at, p_referencia_externa, 'recibido'
  )
  on conflict (event_id) do nothing
  returning id into v_event_row_id;

  if v_event_row_id is null then
    return jsonb_build_object('status', 'duplicate', 'event_id', p_event_id);
  end if;

  select s.id, s.ultimo_evento_at
  into v_subscription_id, v_latest_event_at
  from public.suscripciones as s
  where s.proveedor = 'hotmart'
    and s.referencia_externa = p_referencia_externa
  for update;

  if v_latest_event_at is not null and p_event_at < v_latest_event_at then
    update public.hotmart_eventos
    set resultado = 'obsoleto'
    where id = v_event_row_id;

    return jsonb_build_object('status', 'stale', 'event_id', p_event_id);
  end if;

  select u.id
  into v_user_id
  from public.users as u
  where lower(trim(u.email)) = v_email
  order by u.created_at asc
  limit 1;

  insert into public.suscripciones (
    user_id,
    proveedor,
    referencia_externa,
    producto_id,
    oferta_id,
    transaccion_id,
    email_comprador,
    estado,
    fecha_inicio,
    vigente_hasta,
    cancelada_at,
    ultimo_evento_id,
    ultimo_evento_at,
    metadata_json
  ) values (
    v_user_id,
    'hotmart',
    p_referencia_externa,
    p_product_id,
    p_offer_id,
    p_transaction_id,
    v_email,
    p_estado,
    p_fecha_inicio,
    p_vigente_hasta,
    p_cancelada_at,
    p_event_id,
    p_event_at,
    coalesce(p_metadata_json, '{}'::jsonb)
  )
  on conflict (proveedor, referencia_externa) do update
  set
    user_id = coalesce(public.suscripciones.user_id, excluded.user_id),
    producto_id = excluded.producto_id,
    oferta_id = excluded.oferta_id,
    transaccion_id = coalesce(excluded.transaccion_id, public.suscripciones.transaccion_id),
    email_comprador = excluded.email_comprador,
    estado = excluded.estado,
    fecha_inicio = coalesce(public.suscripciones.fecha_inicio, excluded.fecha_inicio),
    vigente_hasta = excluded.vigente_hasta,
    cancelada_at = excluded.cancelada_at,
    ultimo_evento_id = excluded.ultimo_evento_id,
    ultimo_evento_at = excluded.ultimo_evento_at,
    metadata_json = excluded.metadata_json
  returning id into v_subscription_id;

  update public.hotmart_eventos
  set resultado = 'procesado'
  where id = v_event_row_id;

  return jsonb_build_object(
    'status', 'processed',
    'event_id', p_event_id,
    'subscription_id', v_subscription_id,
    'user_linked', v_user_id is not null
  );
end;
$$;

revoke all on function public.process_hotmart_event(
  text, text, timestamptz, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.process_hotmart_event(
  text, text, timestamptz, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, jsonb
) to service_role;

-- Si la compra llega antes del registro, vincula suscripciones pendientes al
-- crear o actualizar la cuenta con el mismo correo normalizado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := lower(trim(coalesce(new.email, '')));

  insert into public.users (id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set nombre = excluded.nombre,
        email = excluded.email;

  if v_email <> '' then
    update public.suscripciones
    set user_id = new.id
    where user_id is null
      and lower(trim(email_comprador)) = v_email;
  end if;

  return new;
end;
$$;

commit;
