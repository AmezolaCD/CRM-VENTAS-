-- ===========================================================================
--  EL CONSECUTIVO DE FOLIOS, DEL LADO DEL SERVIDOR
--
--  Qué resuelve: hasta ahora el siguiente folio se calculaba con los convenios
--  que ese equipo tiene bajados. Eso funciona mientras todos bajen todo, pero
--  se rompe en dos casos:
--
--   1. Con roles.sql corrido, un ejecutivo sólo recibe SUS convenios. Si él
--      lleva el CV-2026-003 y el hotel va en el CV-2026-015, su aplicación
--      propone el 004 —un folio que ya existe— y nadie se entera, porque la
--      renumeración automática también trabaja nada más con lo que ve.
--
--   2. Dos personas capturando al mismo tiempo toman el mismo número. Eso ya
--      se detectaba al sincronizar, pero sólo cuando ambas veían el convenio
--      de la otra.
--
--  Con esto, el consecutivo deja de salir de la copia local: se pide al
--  servidor, que es el único que los ve todos. Apartar un folio es una sola
--  operación indivisible, así que dos personas a la vez reciben números
--  distintos aunque le den al mismo segundo.
--
--  La tabla guarda NADA MÁS el número. No lleva cliente, ni tarifas, ni
--  importes: por eso la puede leer todo el equipo sin que eso abra la cartera
--  de nadie.
--
--  Se corre UNA VEZ en el SQL Editor de Supabase y se puede repetir. Sin
--  correrlo el CRM funciona como hasta ahora, contando con lo que tiene
--  bajado.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. La tabla
-- ---------------------------------------------------------------------------
create table if not exists public.crm_folios (
  tipo        text        not null,          -- 'convenios', 'contratos', 'eventos'…
  anio        int         not null,
  numero      int         not null,
  folio       text        not null,
  quien       text        default '',
  creado      timestamptz not null default now(),
  primary key (tipo, anio, numero)
);

alter table public.crm_folios enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Quién puede qué
--
--    Leer: todo el equipo. Es lo que permite que la aplicación enseñe el
--    consecutivo correcto al abrir el editor, aunque esa persona no alcance a
--    ver los convenios de los demás.
--
--    Escribir: nadie directamente. Los folios se apartan con la función de
--    abajo, que es la que garantiza que no se repitan. Sin esto, alguien
--    podría insertar un número a mano y saltarse la cuenta.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
--  ¿Quien pregunta es del equipo?
--
--  Este archivo tiene que poder correrse ANTES que roles.sql, y roles.sql es
--  el que crea crm_rol(). Escribir "public.crm_rol()" aquí directamente no
--  sirve: PostgreSQL resuelve el nombre al CREAR la regla, no al usarla, así
--  que truena con "function public.crm_rol() does not exist" aunque la línea
--  nunca se fuera a ejecutar. Por eso se busca la función a mano y se llama
--  con EXECUTE, que sí se resuelve hasta el momento de usarla.
--
--  Sin roles.sql corrido contesta que sí a todo el que haya entrado con su
--  cuenta, que es como trabajaba el CRM antes de que existieran los papeles.
--
--  Es la misma función en archivos.sql y en folios.sql, a propósito: cada
--  archivo se vale solo y no importa cuál se corra primero.
--
--  OJO: firmas.sql define esta MISMA función. Las dos versiones tienen que ser
--  idénticas palabra por palabra, porque "create or replace" hace que la última
--  que se corra gane. Si alguna vez hay que cambiarla, se cambia en los tres
--  archivos a la vez.
-- ---------------------------------------------------------------------------
create or replace function public.crm_del_equipo()
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare papel text;
begin
  if to_regprocedure('public.crm_rol()') is null then
    return true;  -- sin roles.sql corrido no hay papeles que mirar
  end if;
  execute 'select public.crm_rol()' into papel;
  return coalesce(papel, '') <> 'ninguno';
end;
$$;

grant execute on function public.crm_del_equipo() to authenticated;

drop policy if exists "folios lee" on public.crm_folios;
create policy "folios lee" on public.crm_folios for select to authenticated
using (public.crm_del_equipo());

-- ---------------------------------------------------------------------------
-- 3. Apartar el siguiente
--
--    Todo en una sola sentencia: se lee el máximo del año y se inserta el
--    siguiente sin soltar la tabla entre una cosa y la otra. Si dos personas
--    entran al mismo tiempo, la segunda espera a la primera y se lleva el
--    número de después, no el mismo.
--
--    El prefijo va como parámetro para que sirva igual a convenios (CV),
--    contratos (CT) y banquetes (EV / CB) sin tener una función por cada uno.
-- ---------------------------------------------------------------------------
create or replace function public.crm_aparta_folio(
  p_tipo text, p_anio int, p_prefijo text, p_quien text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num   int;
  v_folio text;
begin
  if not public.crm_del_equipo() then
    raise exception 'sin permiso';
  end if;

  -- El lock deja pasar de una en una a las que piden folio del mismo tipo y
  -- año. Es un candado por número, no sobre la tabla: dos áreas distintas
  -- —ventas y banquetes— no se esperan entre sí.
  perform pg_advisory_xact_lock(hashtext(p_tipo || ':' || p_anio));

  select coalesce(max(numero), 0) + 1 into v_num
    from public.crm_folios
   where tipo = p_tipo and anio = p_anio;

  v_folio := p_prefijo || '-' || p_anio::text || '-' || lpad(v_num::text, 3, '0');

  insert into public.crm_folios (tipo, anio, numero, folio, quien)
  values (p_tipo, p_anio, v_num, v_folio, coalesce(p_quien, ''));

  return v_folio;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Anotar uno que no salió de aquí
--
--    Los convenios que ya andaban firmados en papel traen su propio folio, y
--    alguien lo captura a mano. Si no se anotaran, el contador volvería a
--    repartir ese número. Se anota sin pelear: si ya estaba, se deja como
--    estaba.
-- ---------------------------------------------------------------------------
create or replace function public.crm_anota_folio(
  p_tipo text, p_anio int, p_numero int, p_folio text, p_quien text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.crm_del_equipo() then
    raise exception 'sin permiso';
  end if;

  insert into public.crm_folios (tipo, anio, numero, folio, quien)
  values (p_tipo, p_anio, p_numero, p_folio, coalesce(p_quien, ''))
  on conflict (tipo, anio, numero) do nothing;
end;
$$;

grant execute on function public.crm_aparta_folio(text, int, text, text) to authenticated;
grant execute on function public.crm_anota_folio(text, int, int, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Ponerlo al día con lo que ya existe
--
--    Al correrlo por primera vez la tabla está vacía, y si se dejara así el
--    contador arrancaría en 001 y repetiría todo lo del año. Esto la llena con
--    los folios que ya están en la cartera, de una vez.
--
--    Se lee de crm_datos con los permisos del que corre el SQL —la consola de
--    Supabase—, que los ve todos. Sólo toma los que tienen la forma que arma
--    la aplicación; los escritos a mano con otro formato no entran a la cuenta
--    y se quedan como están.
-- ---------------------------------------------------------------------------
--    Va dentro de un bloque con EXECUTE a propósito. La tabla crm_datos la crea
--    nube.sql, y si todavía no se ha corrido, nombrarla aquí directamente
--    tumbaría el archivo entero —PostgreSQL revisa los nombres al leer, no al
--    ejecutar— y el contador se quedaría sin crear. Así, si no está, lo dice y
--    sigue: el contador queda montado y arranca en 001.
do $relleno$
begin
  if to_regclass('public.crm_datos') is null then
    raise notice 'No se encontró la tabla crm_datos, así que el contador arranca vacío. %',
                 'Corre nube.sql y después este archivo otra vez para ponerlo al día.';
    return;
  end if;

  execute $sql$
    insert into public.crm_folios (tipo, anio, numero, folio, quien)
    select d.tipo,
           (m[2])::int                             as anio,
           (m[3])::int                             as numero,
           upper(d.datos ->> 'folio')              as folio,
           'al montar el contador'                 as quien
      from public.crm_datos d,
           lateral regexp_match(upper(coalesce(d.datos ->> 'folio', '')),
                                '^([A-Z]+)-(\d{4})-(\d+)$') as m
     where d.borrado = false
       and d.tipo in ('convenios', 'contratos', 'eventos')
       and m is not null
    on conflict (tipo, anio, numero) do nothing
  $sql$;
end;
$relleno$;

-- ---------------------------------------------------------------------------
-- 6. Para deshacer
--
--      drop function if exists public.crm_aparta_folio(text, int, text, text);
--      drop function if exists public.crm_anota_folio(text, int, int, text, text);
--      drop table if exists public.crm_folios;
--
--    El CRM vuelve solo a contar con lo que tiene bajado; no hay que tocarle
--    nada. Los convenios ya creados se quedan con su folio.
-- ---------------------------------------------------------------------------
