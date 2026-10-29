-- ===========================================================================
-- LOS PAPELES: QUIÉN VE QUÉ, Y QUE LA CONSULTA TERMINE A TIEMPO
--
-- Nace de un error que le costó días al hotel. La sincronización entera
-- devolvía «canceling statement due to statement timeout» y el CRM no subía
-- ni bajaba nada: ni los ajustes, ni la lista de usuarios, ni el catálogo.
-- Desde fuera se veía como «a mí me salen los datos bancarios y a Carmen no»,
-- y se persiguió cinco rondas por el lado equivocado.
--
-- La causa estaba en la política de lectura: ocho ramas, cada una llamando a
-- `crm_rol()`, cada `crm_rol()` llamando a `crm_yo()` hasta dos veces, y
-- `crm_yo()` buscando el correo con `lower(datos->>'correo')`, sin índice.
-- Postgres no guarda el resultado de una función `stable` dentro de un
-- predicado de fila: lo vuelve a calcular EN CADA FILA.
--
-- Este archivo cuida las dos mitades del arreglo:
--
--   1. QUE NADIE GANÓ NI PERDIÓ PERMISOS. Es el grupo de control y es lo que
--      de verdad importa: se reescribieron veintiséis expresiones de las
--      políticas, y ahí es justo donde un permiso se cambia sin que nadie se
--      entere. Un permiso de más no da error: da una ejecutiva viendo la
--      cartera de otra.
--
--   2. QUE LA CONSULTA SIGA SIENDO RÁPIDA con la tabla llena. Medido en esta
--      máquina al escribirlo: con 4 000 filas, antes 473 ms y ahora 6 ms. Si
--      alguien vuelve a meter una llamada sin envolver, lo dice esta prueba y
--      no un hotel que no puede trabajar.
--
-- Todo lo de aquí es inventado: el repositorio es público.
-- ===========================================================================
\set ON_ERROR_STOP on
-- `notice` y no `warning`: las aserciones de abajo se reportan con
-- `raise notice`, y subir el umbral las dejaría mudas —la prueba pasaría
-- en verde sin haber enseñado una sola línea—.
set client_min_messages = notice;

-- ---- La gente y sus papeles ------------------------------------------------
delete from public.crm_datos;

insert into public.crm_datos (id, tipo, datos, duenio) values
  ('usuarios:u1','usuarios','{"correo":"admin@ejemplo.example","nombre":"Admin","rol":"admin"}', null),
  ('usuarios:u2','usuarios','{"correo":"carmen@ejemplo.example","nombre":"Carmen","rol":"ejecutivo"}', null),
  ('usuarios:u3','usuarios','{"correo":"pedro@ejemplo.example","nombre":"Pedro","rol":"ejecutivo"}', null),
  ('usuarios:u4','usuarios','{"correo":"mar@ejemplo.example","nombre":"Mar","rol":"marketing"}', null),
  ('usuarios:u5','usuarios','{"correo":"ordenes@ejemplo.example","nombre":"Ordenes","rol":"odts"}', null),
  ('ajustes:global','ajustes','{"hotel":{}}', null),
  ('habitaciones:h1','habitaciones','{"nombre":"Deluxe King"}', null),
  -- La cartera: una de Carmen, una de Pedro y una sin dueño.
  ('clientes:c1','clientes','{"empresa":"DE CARMEN"}', 'Carmen'),
  ('clientes:c2','clientes','{"empresa":"DE PEDRO"}',  'Pedro'),
  ('clientes:c3','clientes','{"empresa":"SIN DUENIO"}', null),
  -- Documentos de cada área.
  ('convenios:v1','convenios','{}', 'Carmen'),
  ('eventos:e1','eventos','{}',     'Carmen'),
  ('campanas:k1','campanas','{}',   null),
  ('odts:o1','odts','{}',           null);

-- Quién dice ser quien pregunta.
create or replace function pg_temp.entra(correo text) returns void
language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('email', correo)::text, true)::void;
$$;

-- Cuántas filas de un tipo alcanza quien está conectado.
create or replace function pg_temp.cuantas(eltipo text) returns int
language sql stable as $$
  select count(*)::int from public.crm_datos where tipo = eltipo;
$$;

create or replace function pg_temp.afirma(que text, bien boolean) returns void
language plpgsql as $$
begin
  if bien then raise notice '   ok    %', que;
  else raise exception '   FALLA %', que;
  end if;
end $$;

\echo ''
\echo 'Los papeles ven lo mismo que antes:'

-- ---- 1 · La ejecutiva ------------------------------------------------------
begin;
set local role authenticated;
do $$ begin
  perform pg_temp.entra('carmen@ejemplo.example');
  -- Lo que todo el mundo necesita para armar un convenio.
  perform pg_temp.afirma('la ejecutiva lee los ajustes',       pg_temp.cuantas('ajustes') = 1);
  perform pg_temp.afirma('y el catálogo de habitaciones',      pg_temp.cuantas('habitaciones') = 1);
  perform pg_temp.afirma('y la lista de usuarios',             pg_temp.cuantas('usuarios') = 5);
  -- Su cartera: la suya y la que no tiene dueño. La de Pedro NO.
  perform pg_temp.afirma('SU cartera y la que no tiene dueño, no la de su compañero',
                         pg_temp.cuantas('clientes') = 2);
  perform pg_temp.afirma('no alcanza al cliente de Pedro',
                         not exists (select 1 from public.crm_datos
                                      where id = 'clientes:c2'));
  -- Ventas no ve banquetes ni marketing.
  perform pg_temp.afirma('no le bajan los eventos de banquetes', pg_temp.cuantas('eventos') = 0);
  perform pg_temp.afirma('ni las campañas',                      pg_temp.cuantas('campanas') = 0);
  perform pg_temp.afirma('ni las órdenes de trabajo',            pg_temp.cuantas('odts') = 0);
end $$;
rollback;

-- ---- 2 · Quien lleva las órdenes ------------------------------------------
begin;
set local role authenticated;
do $$ begin
  perform pg_temp.entra('ordenes@ejemplo.example');
  perform pg_temp.afirma('las órdenes ve su bandeja',       pg_temp.cuantas('odts') = 1);
  perform pg_temp.afirma('y los ajustes, que es de donde sale la lista de departamentos',
                         pg_temp.cuantas('ajustes') = 1);
  perform pg_temp.afirma('y la lista de usuarios',          pg_temp.cuantas('usuarios') = 5);
  perform pg_temp.afirma('PERO NI UN CLIENTE',              pg_temp.cuantas('clientes') = 0);
  perform pg_temp.afirma('ni un convenio',                  pg_temp.cuantas('convenios') = 0);
end $$;
rollback;

-- ---- 3 · Marketing ---------------------------------------------------------
begin;
set local role authenticated;
do $$ begin
  perform pg_temp.entra('mar@ejemplo.example');
  perform pg_temp.afirma('marketing ve sus campañas',  pg_temp.cuantas('campanas') = 1);
  perform pg_temp.afirma('y las órdenes de trabajo',   pg_temp.cuantas('odts') = 1);
  perform pg_temp.afirma('NO LA CARTERA',              pg_temp.cuantas('clientes') = 0);
  perform pg_temp.afirma('ni los convenios',           pg_temp.cuantas('convenios') = 0);
end $$;
rollback;

-- ---- 4 · La administración -------------------------------------------------
begin;
set local role authenticated;
do $$ begin
  perform pg_temp.entra('admin@ejemplo.example');
  perform pg_temp.afirma('la administración ve toda la cartera', pg_temp.cuantas('clientes') = 3);
  perform pg_temp.afirma('los eventos de banquetes',             pg_temp.cuantas('eventos') = 1);
  perform pg_temp.afirma('y las campañas',                       pg_temp.cuantas('campanas') = 1);
end $$;
rollback;

-- ---- 5 · Quien no está en la lista -----------------------------------------
-- El candado del que cuelga todo lo demás.
begin;
set local role authenticated;
do $$ begin
  perform pg_temp.entra('desconocido@ejemplo.example');
  perform pg_temp.afirma('QUIEN NO ESTÁ EN LA LISTA NO ALCANZA NADA',
                         (select count(*) from public.crm_datos) = 0);
end $$;
rollback;

-- ---- 6 · Escribir ----------------------------------------------------------
\echo ''
\echo 'Y escribir sigue igual de acotado:'
begin;
set local role authenticated;
do $$
declare pudo boolean;
begin
  perform pg_temp.entra('carmen@ejemplo.example');
  begin
    update public.crm_datos set datos = '{"hotel":{"banco":"MÍO"}}'
     where id = 'ajustes:global';
    pudo := found;
  exception when insufficient_privilege then pudo := false;
  end;
  perform pg_temp.afirma('una ejecutiva NO reescribe los ajustes', not pudo);
end $$;
rollback;

begin;
set local role authenticated;
do $$
declare pudo boolean;
begin
  perform pg_temp.entra('admin@ejemplo.example');
  update public.crm_datos set datos = '{"hotel":{"banco":"X"}}' where id = 'ajustes:global';
  pudo := found;
  perform pg_temp.afirma('y la administración SÍ', pudo);
end $$;
rollback;

-- ---- 7 · Que termine a tiempo ----------------------------------------------
-- La mitad que le costó los días al hotel. Se llena la tabla y se mide la
-- consulta que hace `bajar()`: todo lo que esa persona alcanza, ordenado.
\echo ''
\echo 'Y la consulta de bajada, con la tabla llena:'
insert into public.crm_datos (id, tipo, datos, duenio)
  select 'clientes:lleno' || g, 'clientes', '{"empresa":"RELLENO"}'::jsonb, 'Carmen'
    from generate_series(1, 4000) g;
analyze public.crm_datos;

begin;
set local role authenticated;
do $$
declare t0 timestamptz; ms numeric; filas int;
begin
  perform pg_temp.entra('carmen@ejemplo.example');
  t0 := clock_timestamp();
  select count(*) into filas from public.crm_datos;
  ms := extract(epoch from clock_timestamp() - t0) * 1000;
  perform pg_temp.afirma(format('le bajan sus %s filas', filas), filas > 4000);
  /* El umbral es generoso a propósito: medido aquí, la versión de antes
     tardaba 473 ms con estas mismas filas y la de ahora 6 ms. Cualquier cosa
     por encima de 200 ms quiere decir que alguien volvió a dejar una llamada
     sin envolver en `(select ...)`, o que el índice del correo se cayó. */
  perform pg_temp.afirma(format('Y TERMINA A TIEMPO: %s ms (el límite de Supabase son 8000)',
                                round(ms)), ms < 200);
end $$;
rollback;

delete from public.crm_datos;
\echo ''
