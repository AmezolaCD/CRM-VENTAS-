-- ===========================================================================
--  CRM CORE · Las órdenes de trabajo de marketing (ODTs)
--
--  Qué resuelve: marketing recibe sus encargos en papel. Dos hojas —Solicitud
--  Audiovisual y Solicitud Diseño Gráfico— que el jefe del área que pide llena
--  a mano, firma, y persigue por el hotel hasta juntar las demás firmas. No hay
--  cómo saber cuántas hay abiertas, quién las trabaja, ni dónde quedó el
--  archivo terminado.
--
--  Con esto, el jefe solicitante llena y firma la orden desde un enlace, el
--  director la firma desde otro, la coordinadora la reparte, y el producto
--  terminado queda colgado de la orden.
--
--  Se corre UNA VEZ en el SQL Editor de Supabase y se puede repetir.
--
--  ---------------------------------------------------------------------------
--  TRES COSAS QUE NO SE DEBEN TOCAR SIN PENSARLO DOS VECES
--  ---------------------------------------------------------------------------
--
--  1. EL VISITANTE TIENE UN SOLO PERMISO EN TODO EL SERVIDOR: insertar un
--     renglón en este buzón. No lee nada —ni siquiera lo que él mismo acaba de
--     dejar—, no corrige, no borra, y no toca el almacén. Por eso los archivos
--     que adjunta viajan DENTRO del renglón, como texto, y es el CRM quien los
--     muda al almacén al recogerlos. Darle permiso de escribir en el almacén
--     para ahorrarse ese paso sería abrirle una puerta que hoy no tiene.
--
--  2. LA CLAVE ES PROPIA, no la de la liga del lobby. Esa va pegada en los
--     anuncios de Facebook y la ve cualquiera: no tiene por qué servir para
--     levantar órdenes de trabajo. Son dos públicos distintos y dos claves
--     distintas, y así revocar una no tumba la otra.
--
--  3. EL `check` DEL TAMAÑO ES LA ÚNICA DEFENSA DEL SERVIDOR. El navegador
--     limita cada adjunto a 5 MB, pero el navegador se puede saltar: quien
--     conozca la clave puede mandar el renglón que quiera con curl. Sin este
--     check, un renglón de 400 MB se traga el disco del proyecto.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. El buzón
--
--    Los campos de la hoja van en `datos` como jsonb y no como columnas, a
--    propósito: son dos hojas distintas —una pregunta por la duración del
--    video, la otra por las medidas del diseño— y van a seguir cambiando. El
--    CRM lee lo que entiende; lo que no, se queda guardado.
--
--    `adjuntos` trae los archivos de referencia EN CRUDO, en base64, y sólo de
--    paso: en cuanto el CRM recoge la orden los sube al almacén y deja aquí el
--    renglón marcado como atendido. No es el lugar donde viven los archivos,
--    es el camión que los trae.
-- ---------------------------------------------------------------------------
/* ---------------------------------------------------------------------------
   TODO ESTE ARCHIVO VA EN UNA SOLA TRANSACCIÓN.

   Si el pegado se corta a la mitad —pasa, y ya pasó en este proyecto— la base
   de datos se queda EXACTAMENTE como estaba, en vez de a medio camino. Antes,
   un archivo cortado podía dejar tirada una regla y no volver a crearla: el
   sistema quedaba peor que si no se hubiera corrido nada, y sin avisar.

   Si al correrlo no aparece «COMMIT» al final, no se aplicó nada: vuelva a
   copiar el archivo COMPLETO y a correrlo.
   --------------------------------------------------------------------------- */
begin;
-- @tabla
create table if not exists public.crm_odts (
  id        bigserial primary key,
  token     text not null,
  tipo      text not null default '',              -- audiovisual | diseno
  datos     jsonb   not null default '{}'::jsonb,  -- los campos de la hoja
  firma     jsonb   not null default '{}'::jsonb,  -- la del jefe que la pide
  adjuntos  jsonb   not null default '[]'::jsonb,  -- [{nombre, tipoMime, tam, b64}]
  aplicada  boolean not null default false,
  creado    timestamptz not null default now(),
  -- 20 MB deja lugar a los tres adjuntos de 5 MB que permite el formulario:
  -- base64 infla alrededor de un 37%. Ver el punto 3 de arriba. Éstos viajan
  -- DENTRO del renglón porque el visitante no puede escribir en el almacén,
  -- así que el tope no lo pone el plan de Supabase sino lo que es razonable
  -- meter en una sola petición.
  constraint crm_odts_cabe check (octet_length(adjuntos::text) <= 20000000)
);
-- @fin-tabla
create index if not exists crm_odts_pend_idx on public.crm_odts (aplicada) where aplicada = false;

alter table public.crm_odts enable row level security;

-- Por si el archivo se corrió antes de que existiera el check. Se tira y se
-- vuelve a poner en vez de preguntar si ya estaba: así son dos renglones
-- sueltos que se pueden correr solos, y no un bloque que hay que mandar
-- entero. El editor de Supabase corre lo que uno tenga seleccionado, y media
-- instrucción de varios renglones no significa nada.
alter table public.crm_odts drop constraint if exists crm_odts_cabe;
alter table public.crm_odts
  add constraint crm_odts_cabe check (octet_length(adjuntos::text) <= 20000000);

-- ---------------------------------------------------------------------------
-- 2. ¿La clave es la del hotel?
--
--    Va como security definer porque el visitante no puede leer los ajustes
--    por su cuenta: sólo se le deja hacer esta pregunta concreta, que se
--    contesta con sí o no y no revela nada más.
--
--    Es la gemela de crm_alta_token_ok, pero mira OTRA clave: `tokenOdt` en
--    vez de `tokenAlta` (ver el punto 2 de arriba). Cambiarla desde Ajustes
--    invalida las ligas viejas, que es justo lo que se quiere el día que una
--    se filtre.
-- ---------------------------------------------------------------------------
create or replace function public.crm_odt_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_datos d
     where d.id = 'ajustes:global'
       and d.borrado = false
       and coalesce(d.datos -> 'hotel' ->> 'tokenOdt', '') <> ''
       and d.datos -> 'hotel' ->> 'tokenOdt' = p_token);
$$;

-- ---------------------------------------------------------------------------
-- 2b. ¿Quién firma por cada departamento?
--
--    Ésta es la ÚNICA función de todo el proyecto que se puede llamar sin
--    tener cuenta, y por eso va explicado. No es un descuido: es la manera de
--    que el jefe de área vea la lista de departamentos en el formulario.
--
--    El formulario corre en el teléfono de alguien que nunca ha entrado al
--    CRM. No baja nada del servidor —su única petición es dejar la orden—, así
--    que la lista que el administrador edita en Ajustes no le llegaría jamás.
--    Las salidas eran tres: dejar la lista escrita dentro del programa (y
--    entonces el administrador no la puede cambiar, que es justo lo que pidió),
--    abrirle los ajustes enteros a cualquiera (no), o esto.
--
--    Lo que la hace aceptable:
--
--      · Pide la clave. Sin la clave buena contesta una lista vacía.
--      · Devuelve UNA cosa: el arreglo de pares departamento/jefe. El recorte
--        se hace AQUÍ DENTRO, no en el navegador, así que ni el nombre fiscal
--        ni la clave del lobby ni nada más de ajustes:global sale por aquí.
--      · Es exactamente lo que esa persona va a ver en pantalla dos segundos
--        después. No revela nada que no fuera a ver de todos modos.
--
--    Si la clave se filtra se cambia desde Ajustes, igual que la de la liga, y
--    esto deja de contestar con las viejas.
-- ---------------------------------------------------------------------------
create or replace function public.crm_odt_jefes(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select d.datos -> 'hotel' -> 'jefes'
       from public.crm_datos d
      where d.id = 'ajustes:global'
        and d.borrado = false
        and coalesce(d.datos -> 'hotel' ->> 'tokenOdt', '') <> ''
        and d.datos -> 'hotel' ->> 'tokenOdt' = p_token),
    '[]'::jsonb);
$$;

revoke all on function public.crm_odt_jefes(text) from public;
grant execute on function public.crm_odt_jefes(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. ¿Quien pregunta es del equipo?
--
--    La misma de firmas.sql, archivos.sql, folios.sql, prospectos.sql,
--    meta.sql y whatsapp.sql, palabra por palabra: "create or replace" hace
--    que gane la última que se corra, así que todas tienen que decir
--    exactamente lo mismo. Si alguna vez hay que cambiarla, se cambia en los
--    siete archivos a la vez.
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

-- ---------------------------------------------------------------------------
-- 4. Lo que puede hacer un jefe de área sin cuenta en el CRM
--
--    Una sola cosa: dejar su orden, con la clave buena y sin marcarla como
--    atendida. No lee, no corrige, no borra. Ni siquiera puede ver la que él
--    mismo acaba de dejar.
-- ---------------------------------------------------------------------------
--    Primero los permisos de tabla, que son la reja de afuera. Supabase le da
--    permiso de todo sobre cada tabla nueva a quien entra con su cuenta, y a
--    `anon` le deja lo suyo; lo que hoy impide que alguien lea es que no exista
--    una regla que se lo permita. Eso basta, pero es una sola línea de defensa.
--    Van como instrucciones sueltas y no dentro de un bloque que pregunte si
--    el papel existe: en Supabase `anon` y `authenticated` existen siempre, la
--    pregunta nunca servía de nada, y un bloque de varios renglones falla si
--    el editor manda nada más un pedazo —que es lo que hace cuando uno deja
--    texto seleccionado—. Cada renglón de aquí se puede correr solo.
revoke all on public.crm_odts from anon, authenticated;
grant insert on public.crm_odts to anon;
grant usage, select on sequence public.crm_odts_id_seq to anon;
grant select, update, delete on public.crm_odts to authenticated;

drop policy if exists "jefe deja su orden" on public.crm_odts;
create policy "jefe deja su orden" on public.crm_odts for insert to anon
with check (public.crm_odt_token_ok(token) and aplicada = false);

-- El equipo recoge del buzón y lo marca como atendido. El papel se pregunta en
-- las dos cláusulas del update: el `using` decide cuáles filas alcanza a tocar,
-- y el `with check` cómo pueden quedar. Si sólo se pusiera en el `using`,
-- bastaría con que otra regla dejara la fila a la vista para escribirle encima.
drop policy if exists "equipo lee odts"   on public.crm_odts;
drop policy if exists "equipo marca odts" on public.crm_odts;
drop policy if exists "equipo borra odts" on public.crm_odts;
create policy "equipo lee odts"   on public.crm_odts for select to authenticated
  using (public.crm_del_equipo());
create policy "equipo marca odts" on public.crm_odts for update to authenticated
  using (public.crm_del_equipo()) with check (public.crm_del_equipo());
-- Borrar sirve para la basura: una liga que se filtró y se llenó de órdenes
-- falsas se limpia desde el CRM sin tener que entrar a Supabase.
create policy "equipo borra odts" on public.crm_odts for delete to authenticated
  using (public.crm_del_equipo());

-- ---------------------------------------------------------------------------
-- 5. El almacén de las ODT
--
--    Aparte del de `escaneados`, a propósito. Ahí viven convenios firmados con
--    las tarifas y las firmas de los clientes; aquí, archivos de referencia que
--    manda gente de otras áreas y los productos que entrega marketing. Son dos
--    cosas con dueños distintos y conviene poder abrirle una a alguien sin
--    abrirle la otra.
--
--    Privado: la portada de un video promocional que todavía no sale al aire no
--    tiene por qué poder verla cualquiera que adivine la dirección.
-- ---------------------------------------------------------------------------
--    EL TOPE POR ARCHIVO, y por qué es éste:
--
--    En el plan gratuito de Supabase ningún archivo puede pasar de 50 MB, y con
--    ese tope un video de verdad no cabía: por eso el CRM ofrece pegarlo por
--    enlace. Con el plan Pro el tope sube muchísimo —hasta cientos de GB— así
--    que el video YA CABE y se puede ver sin salir del CRM.
--
--    200 MB es un punto intermedio a propósito, no el máximo: alcanza de sobra
--    para un spot de un minuto en buena calidad, y evita que alguien suba por
--    error el archivo de edición de 4 GB y se coma el espacio de todos. Subirlo
--    es cambiar este número y el de index.html (MAX_ENTREGA_ODT).
--
--    OJO: además hay un tope GLOBAL en Storage → Settings del proyecto, y
--    ningún balde puede pasarlo. Si está en 50 MB, hay que subirlo ahí primero
--    o este número no sirve de nada.
insert into storage.buckets (id, name, public, file_size_limit)
values ('odts', 'odts', false, 209715200)   -- 200 MB por archivo
on conflict (id) do update
  set public = false,
      file_size_limit = 209715200;

-- Se tiran primero, para que volver a correrlo no truene.
drop policy if exists "odts lee"    on storage.objects;
drop policy if exists "odts sube"   on storage.objects;
drop policy if exists "odts cambia" on storage.objects;
drop policy if exists "odts borra"  on storage.objects;

create policy "odts lee" on storage.objects for select to authenticated
using (
  bucket_id = 'odts'
  and public.crm_del_equipo()
);

create policy "odts sube" on storage.objects for insert to authenticated
with check (
  bucket_id = 'odts'
  and public.crm_del_equipo()
);

-- Cambiar hace falta de verdad: al recoger una orden dos veces —cosa que pasa
-- si se corta la luz entre subir el archivo y marcar el renglón— el CRM vuelve
-- a subir el adjunto a LA MISMA ruta. Sin este permiso, ese reintento fallaría
-- y la orden se quedaría sin su archivo de referencia.
create policy "odts cambia" on storage.objects for update to authenticated
using (
  bucket_id = 'odts'
  and public.crm_del_equipo()
);

create policy "odts borra" on storage.objects for delete to authenticated
using (
  bucket_id = 'odts'
  and public.crm_del_equipo()
);

-- ---------------------------------------------------------------------------
-- 6. La limpieza
--
--    Las órdenes ya recogidas no hacen falta en el buzón: la orden vive en el
--    CRM y sus adjuntos en el almacén. Esto borra las atendidas de más de
--    treinta días. No se corre solo.
--
--      select public.crm_odts_limpia();
-- ---------------------------------------------------------------------------
create or replace function public.crm_odts_limpia()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if not public.crm_del_equipo() then
    raise exception 'Sin permiso.';
  end if;

  delete from public.crm_odts
   where aplicada = true and creado < now() - interval '30 days';
  get diagnostics v_n = row_count;

  return format('Se borraron %s orden(es) ya recogidas.', v_n);
end;
$$;

revoke all on function public.crm_odts_limpia() from public;
grant execute on function public.crm_odts_limpia() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Para deshacer
--
--      drop function if exists public.crm_odts_limpia();
--      drop function if exists public.crm_odt_token_ok(text);
--      drop function if exists public.crm_odt_jefes(text);
--      drop table if exists public.crm_odts;
--
--    Las órdenes que ya se recogieron NO se pierden: viven en el CRM, no aquí.
--    Lo que se pierde es la posibilidad de levantarlas desde fuera, y la liga
--    deja de funcionar. El CRM lo dice en la pantalla en vez de fallar callado.
--
--    Para tirar también los archivos hay que vaciar el bucket `odts` desde
--    Storage y luego borrarlo; borrar el bucket con archivos dentro no se
--    puede. Eso SÍ se lleva los productos entregados.
--
--    La función crm_del_equipo() NO se tira aquí: la comparten firmas.sql,
--    archivos.sql, folios.sql, prospectos.sql, meta.sql y whatsapp.sql.
-- ---------------------------------------------------------------------------

commit;

-- ---------------------------------------------------------------------------
--  LA PRUEBA DE QUE LLEGÓ COMPLETO
--
--  Si al correrlo el panel de resultados dice «Success. No rows returned», el
--  pegado SE CORTÓ y no se aplicó nada: esta línea nunca llegó. Tiene que
--  aparecer un renglón con el mensaje de abajo.
--
--  Esto no es paranoia: ya pasó dos veces en este proyecto, las dos cortado a
--  los 100 renglones exactos, y las dos veces el editor contestó «Success».
-- ---------------------------------------------------------------------------
select 'LISTO · odts.sql aplicado: las órdenes de trabajo' as resultado;
