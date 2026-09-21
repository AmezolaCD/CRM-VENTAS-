-- ===========================================================================
--  CRM CORE · Lo que marketing puede saber del dinero
--
--  Qué resuelve: el tablero de marketing tiene que decir cuánto dejó cada
--  campaña. Pero marketing NO alcanza la cartera —así lo decidió el hotel, y
--  roles.sql lo hace valer: sólo recibe ajustes, usuarios, campañas y
--  prospectos—. El dinero vive en convenios, contratos y eventos, que no ve.
--
--  La salida es que marketing vea NÚMEROS, no renglones. Esta función suma del
--  lado del servidor —el único que ve los documentos de todas las áreas— y
--  devuelve el resultado, nunca los insumos. Mismo patrón que crm_aparta_folio.
--
--  Se corre UNA VEZ en el SQL Editor y se puede repetir. Sin correrlo, el
--  tablero enseña leads y conversión, y dice por qué falta el dinero.
--
--  ---------------------------------------------------------------------------
--  DOS COSAS QUE NO SE DEBEN TOCAR SIN PENSARLO DOS VECES
--  ---------------------------------------------------------------------------
--
--  1. LO QUE DEVUELVE. Seis columnas: campaña, mes, y cuatro cuentas. Ni el
--     nombre del cliente, ni el folio, ni el id del documento, ni el monto de
--     un documento suelto, ni la tarifa, ni el ejecutivo, ni una fecha más fina
--     que el mes.
--
--     Algún día alguien va a querer agregar "el nombre del cliente, nomás para
--     depurar". Ahí se acaba todo el modelo de accesos, porque esta función
--     corre como dueña y pasa por encima de las reglas. Si hace falta depurar,
--     se depura con una cuenta de administración, que ya lo ve todo.
--
--  2. LA SUPRESIÓN. Un agregado NO es automáticamente anónimo.
--
--     Marketing sí ve los prospectos, con nombre y correo. Si una campaña trajo
--     un prospecto y ése fue el único que cerró, entonces "el ingreso de la
--     campaña" ES el monto del contrato de esa persona. El número no dice el
--     nombre, pero lo señala con el dedo.
--
--     Por eso, a quien no alcanza la cartera se le oculta el dinero mientras la
--     campaña tenga menos de CIERRES_MINIMOS cierres. Las CUENTAS nunca se
--     ocultan —leads, conversión y costo por lead funcionan desde el primer
--     día—; lo único que espera es el peso.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0. Lo que tiene que estar antes
-- ---------------------------------------------------------------------------
do $revision$
begin
  if to_regclass('public.crm_datos') is null then
    raise exception E'Falta correr nube.sql primero.\n\n'
      'Esta función suma sobre la tabla crm_datos, y esa tabla no existe en '
      'este proyecto.\n\n'
      'Dos cosas que revisar:\n'
      '  1. Que sea el proyecto correcto. Arriba a la izquierda del tablero de '
      'Supabase se cambia de proyecto, y es fácil acabar en otro.\n'
      '  2. Si es el correcto, corre nube.sql y luego éste.';
  end if;
end;
$revision$;

-- ---------------------------------------------------------------------------
-- 1. El ingreso por campaña
--
--    De dónde sale cada cosa:
--
--      prospecto.campanaId → cliente.campanaId → sus contratos y eventos
--
--    Ese primer eslabón lo escribe el CRM al pasar un prospecto a la cartera.
--    El segundo es el clienteId que ya traen los documentos.
--
--    El IMPORTE no se calcula aquí. El CRM lo sella dentro de cada documento
--    al guardarlo (campo 'total'), porque el cálculo —IVA del 8%, cargo por
--    servicio renglón por renglón, impuestos de hospedaje— vive en JavaScript.
--    Volverlo a escribir en SQL sería tener la misma regla en dos idiomas, y el
--    día que cambie una tasa se separarían sin que nadie lo note.
--
--    Se cuentan sólo los documentos CERRADOS: un evento 'confirmado' o un
--    contrato 'aceptado'. Una cotización todavía no es dinero.
--
--    La fecha que manda es la del evento o la de la estancia, no la de la
--    firma: es cuando el hotel cobra. Es el mismo criterio que usa Reportes.
-- ---------------------------------------------------------------------------
create or replace function public.crm_ingresos_campana(
  p_desde date default null,
  p_hasta date default null)
returns table (
  campana_id text,
  mes        text,      -- 'AAAA-MM'
  clientes   int,       -- clientes atribuidos a la campaña
  cierres    int,       -- documentos cerrados de esos clientes
  ingreso    numeric,   -- pesos. NULL cuando se suprime
  suprimido  boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- Cuántos cierres hacen falta para que el dinero deje de señalar a una
  -- persona. Es la única perilla de todo esto; moverla es una decisión del
  -- hotel, no del código.
  CIERRES_MINIMOS constant int := 3;
  v_rol  text := 'admin';
  v_todo boolean;
begin
  -- El papel se pregunta aquí dentro y no sólo con un GRANT: esta función pasa
  -- por encima de las reglas de fila, así que un permiso de ejecución mal dado
  -- abriría todo.
  if to_regprocedure('public.crm_rol()') is not null then
    execute 'select public.crm_rol()' into v_rol;
  end if;
  if coalesce(v_rol, '') not in
     ('admin','direccion','gerente','marketing','gte_marketing') then
    raise exception 'Sin permiso.';
  end if;

  -- Quien ya alcanza la cartera no necesita que se le esconda nada: lo puede
  -- ver renglón por renglón de todos modos.
  v_todo := v_rol in ('admin','direccion','gerente');

  return query
  with docs as (
    -- Eventos de banquetes y contratos de hospedaje, en una sola lista.
    select c.datos ->> 'campanaId'                       as camp,
           to_char((d.datos ->> 'fecha')::date, 'YYYY-MM') as mes,
           c.id                                          as cliente,
           coalesce((d.datos ->> 'total')::numeric, 0)   as importe
      from public.crm_datos d
      join public.crm_datos c
        on c.id = 'clientes:' || (d.datos ->> 'clienteId')
       and c.tipo = 'clientes'
       and c.borrado = false
     where d.borrado = false
       and d.tipo in ('contratos','eventos')
       and coalesce(c.datos ->> 'campanaId', '') <> ''
       and (d.datos ->> 'fecha') ~ '^\d{4}-\d{2}-\d{2}$'
       and (p_desde is null or (d.datos ->> 'fecha')::date >= p_desde)
       and (p_hasta is null or (d.datos ->> 'fecha')::date <= p_hasta)
       and ((d.tipo = 'contratos' and d.datos ->> 'estado' = 'aceptado')
         or (d.tipo = 'eventos'   and d.datos ->> 'estado' = 'confirmado'))
       -- Un contrato de banquetes manda sobre la cotización de la que salió:
       -- si no, el mismo evento se contaría dos veces.
       and not exists (
             select 1 from public.crm_datos x
              where x.tipo = 'eventos' and x.borrado = false
                and x.datos ->> 'cotizacionId' = substring(d.id from 9))
  )
  select g.camp,
         g.mes,
         count(distinct g.cliente)::int,
         count(*)::int,
         case when v_todo or count(*) >= CIERRES_MINIMOS
              then round(sum(g.importe), 2) end,
         not (v_todo or count(*) >= CIERRES_MINIMOS)
    from docs g
   group by g.camp, g.mes;
end;
$$;

revoke all on function public.crm_ingresos_campana(date, date) from public;
grant execute on function public.crm_ingresos_campana(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Para deshacer
--
--      drop function if exists public.crm_ingresos_campana(date, date);
--
--    El tablero de marketing vuelve solo a enseñar nada más leads y conversión,
--    y lo dice. No se pierde un solo dato: esta función no guarda nada, sólo
--    suma lo que ya está en la cartera.
-- ---------------------------------------------------------------------------
