-- ===========================================================================
--  CRM CORE · Permisos de verdad
--
--  Lo que se configura en Ajustes → Usuarios y permisos acomoda lo que cada
--  quien ve en pantalla, pero los datos siguen bajando completos a cada
--  equipo. Este archivo hace que el servidor mismo los niegue: un ejecutivo
--  ya no puede recibir la cartera de otro ni sabiendo dónde buscar.
--
--  CÓRRELO DESPUÉS de nube.sql, y no antes de haber dado de alta a todo el
--  equipo en Ajustes → Usuarios y permisos: las reglas de aquí leen esa misma
--  lista, así que si está vacía nadie vería nada.
--
--  Antes de correrlo, saca un respaldo: Exportar → Respaldo completo (JSON).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. De quién es cada registro
--
--    Lo llena la aplicación al subir: el nombre del ejecutivo del cliente al
--    que pertenece la fila. Las filas viejas se quedan en nulo y las ve todo
--    el mundo, que es lo prudente mientras se completan.
-- ---------------------------------------------------------------------------
alter table public.crm_datos add column if not exists duenio text;
create index if not exists crm_datos_duenio_idx on public.crm_datos (duenio);

-- ---------------------------------------------------------------------------
-- 2. Quién es quien pregunta
--
--    Los usuarios viven en la misma tabla, una fila por persona, que es lo que
--    administra el CRM en Ajustes. Se leen de ahí para no tener dos listas que
--    mantener a mano y que acaben diciendo cosas distintas.
-- ---------------------------------------------------------------------------
create or replace function public.crm_yo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select d.datos
       from public.crm_datos d
      where d.tipo = 'usuarios'
        and d.borrado = false
        and lower(d.datos ->> 'correo') = lower(auth.jwt() ->> 'email')
      limit 1),
    '{}'::jsonb);
$$;

create or replace function public.crm_rol()
returns text
language sql
stable
as $$ select coalesce(public.crm_yo() ->> 'rol', 'ejecutivo'); $$;

create or replace function public.crm_nombre()
returns text
language sql
stable
as $$ select coalesce(public.crm_yo() ->> 'nombre', ''); $$;

-- ---------------------------------------------------------------------------
-- 3. Las reglas
--
--    · El catálogo, los textos y la lista de usuarios los necesita todo el
--      mundo para poder armar un convenio: se leen siempre.
--    · Administración y gerencia ven todo lo demás.
--    · Un ejecutivo ve lo suyo, y lo que todavía no tiene dueño.
--
--    Escribir sigue abierto a cualquiera que haya entrado, salvo los ajustes y
--    la lista de usuarios, que son del administrador. No se restringe más
--    porque quien puede ver un registro necesita poder corregirlo.
-- ---------------------------------------------------------------------------
drop policy if exists "equipo lee"     on public.crm_datos;
drop policy if exists "equipo inserta" on public.crm_datos;
drop policy if exists "equipo edita"   on public.crm_datos;

create policy "lee lo suyo" on public.crm_datos for select to authenticated
using (
  tipo in ('ajustes','habitaciones','usuarios')
  or public.crm_rol() in ('admin','gerente')
  or duenio is null
  or lower(duenio) = lower(public.crm_nombre())
);

create policy "inserta" on public.crm_datos for insert to authenticated
with check (
  case when tipo in ('ajustes','usuarios','habitaciones')
       then public.crm_rol() = 'admin'
       else true end
);

create policy "edita" on public.crm_datos for update to authenticated
using (
  tipo in ('ajustes','habitaciones','usuarios')
  or public.crm_rol() in ('admin','gerente')
  or duenio is null
  or lower(duenio) = lower(public.crm_nombre())
)
with check (
  case when tipo in ('ajustes','usuarios','habitaciones')
       then public.crm_rol() = 'admin'
       else true end
);

-- ---------------------------------------------------------------------------
-- 4. La bitácora, sólo para quien manda
-- ---------------------------------------------------------------------------
drop policy if exists "equipo lee bitacora" on public.crm_bitacora;
create policy "gerencia lee bitacora" on public.crm_bitacora for select to authenticated
using (public.crm_rol() in ('admin','gerente'));

-- ---------------------------------------------------------------------------
-- 5. Para deshacer
--
--    Si algo sale mal y hay que volver a como estaba —todos ven todo—, corre
--    esto y vuelve a correr nube.sql:
--
--      drop policy if exists "lee lo suyo" on public.crm_datos;
--      drop policy if exists "inserta"     on public.crm_datos;
--      drop policy if exists "edita"       on public.crm_datos;
--      drop policy if exists "gerencia lee bitacora" on public.crm_bitacora;
-- ---------------------------------------------------------------------------
