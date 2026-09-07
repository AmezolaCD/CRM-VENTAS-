-- ===========================================================================
--  CRM CORE · Quartz Hotel & Spa
--  Tabla y permisos para compartir la cartera entre todo el equipo.
--
--  Cómo se usa: entra a tu proyecto de Supabase, abre "SQL Editor",
--  pega este archivo completo y presiona "Run". Se puede volver a correr
--  las veces que haga falta: no borra nada.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. La tabla
--
--    Una fila por registro: cada cliente, cada actividad, cada convenio y
--    cada huésped van por separado. Así dos personas pueden capturar al
--    mismo tiempo mientras no toquen el mismo registro; si todo viviera en
--    una sola fila, el último en guardar borraría el trabajo del otro.
--
--    El contenido va en "datos" como JSON, con la misma forma que ya tenía
--    la aplicación en el navegador. No se parte en columnas a propósito:
--    cuando se agregue un campo nuevo no habrá que migrar la base.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_datos (
  id              text primary key,             -- "clientes:c1", "ajustes:global"
  tipo            text not null,                -- clientes | actividades | convenios | huespedes | habitaciones | ajustes
  datos           jsonb not null default '{}'::jsonb,
  borrado         boolean not null default false,
  actualizado     timestamptz not null default now(),
  actualizado_por text
);

-- La aplicación pregunta "¿qué cambió desde tal fecha?" en cada sondeo.
create index if not exists crm_datos_actualizado_idx on public.crm_datos (actualizado);
create index if not exists crm_datos_tipo_idx        on public.crm_datos (tipo);

-- ---------------------------------------------------------------------------
-- 2. La marca de tiempo la pone el servidor
--
--    Si cada computadora mandara su propia hora, un reloj atrasado haría que
--    sus cambios parecieran viejos y los demás equipos nunca los bajarían.
-- ---------------------------------------------------------------------------
create or replace function public.crm_sella()
returns trigger
language plpgsql
as $$
begin
  new.actualizado := now();
  new.actualizado_por := coalesce(auth.jwt() ->> 'email', new.actualizado_por);
  return new;
end;
$$;

drop trigger if exists crm_datos_sella on public.crm_datos;
create trigger crm_datos_sella
  before insert or update on public.crm_datos
  for each row execute function public.crm_sella();

-- ---------------------------------------------------------------------------
-- 3. Permisos
--
--    Con RLS encendida, la llave pública que va dentro de la página no sirve
--    de nada por sí sola: hay que haber entrado con una cuenta. Todo el
--    equipo de ventas ve y edita lo mismo, que es justo lo que se pidió.
--    Nadie puede borrar filas: la aplicación marca "borrado" para que los
--    demás equipos se enteren de la baja.
-- ---------------------------------------------------------------------------
alter table public.crm_datos enable row level security;

drop policy if exists "equipo lee"     on public.crm_datos;
drop policy if exists "equipo inserta" on public.crm_datos;
drop policy if exists "equipo edita"   on public.crm_datos;

create policy "equipo lee"     on public.crm_datos for select to authenticated using (true);
create policy "equipo inserta" on public.crm_datos for insert to authenticated with check (true);
create policy "equipo edita"   on public.crm_datos for update to authenticated using (true) with check (true);
-- (a propósito no hay política de delete: sin ella, nadie borra filas)

-- ---------------------------------------------------------------------------
-- 4. Bitácora de quién tocó qué
--
--    No hace falta para que la aplicación funcione, pero cuando alguien
--    pregunte "¿quién le cambió la tarifa a este cliente?" la respuesta
--    está aquí. Sólo se puede leer.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_bitacora (
  n           bigserial primary key,
  id          text not null,
  tipo        text,
  datos       jsonb,
  borrado     boolean,
  quien       text,
  cuando      timestamptz not null default now()
);

create or replace function public.crm_apunta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_bitacora (id, tipo, datos, borrado, quien)
  values (new.id, new.tipo, new.datos, new.borrado, new.actualizado_por);
  return new;
end;
$$;

drop trigger if exists crm_datos_apunta on public.crm_datos;
create trigger crm_datos_apunta
  after insert or update on public.crm_datos
  for each row execute function public.crm_apunta();

alter table public.crm_bitacora enable row level security;
drop policy if exists "equipo lee bitacora" on public.crm_bitacora;
create policy "equipo lee bitacora" on public.crm_bitacora for select to authenticated using (true);
