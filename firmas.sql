-- ===========================================================================
--  CRM CORE · Firma del cliente desde un enlace
--
--  Permite que un cliente —que no tiene cuenta ni tiene por qué tenerla— abra
--  el enlace que le mandó su ejecutivo, lea SU convenio y lo firme.
--
--  Córrelo después de nube.sql. Se puede repetir sin borrar nada.
--
--  Cómo está pensado, que es lo que importa:
--
--  · El visitante puede leer UN convenio: aquel cuya clave venga en el
--    enlace. Sin clave no ve nada, y con una clave no puede ver otros.
--  · No escribe sobre el convenio. Deja su firma en un buzón aparte, donde
--    puede depositar pero no leer ni corregir. El CRM la recoge de ahí.
--  · La clave deja de servir en cuanto se firma, porque el CRM la borra del
--    convenio al cerrarlo.
--  · Del buzón recoge el EQUIPO DE VENTAS, no cualquiera que haya entrado al
--    servidor: quien no está en la lista de Ajustes → Usuarios y permisos no
--    lee ni corrige una sola firma. Abajo, en el punto 3, está el porqué.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. El buzón
-- ---------------------------------------------------------------------------
create table if not exists public.crm_firmas (
  id          bigserial primary key,
  convenio_id text not null,
  token       text not null,
  nombre      text,
  puesto      text,
  celular     text,
  img         text,
  aplicada    boolean not null default false,
  creado      timestamptz not null default now()
);
create index if not exists crm_firmas_pend_idx on public.crm_firmas (aplicada) where aplicada = false;

alter table public.crm_firmas enable row level security;

-- ---------------------------------------------------------------------------
-- 2. ¿La clave corresponde a ese convenio?
--
--    Va como security definer porque el visitante no puede leer la tabla de
--    convenios por su cuenta: sólo se le deja hacer esta pregunta concreta,
--    que se contesta con sí o no y no revela nada más.
-- ---------------------------------------------------------------------------
create or replace function public.crm_token_ok(p_convenio text, p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_datos d
     where d.id = 'convenios:' || p_convenio
       and d.borrado = false
       and coalesce(d.datos ->> 'tokenFirma', '') <> ''
       and d.datos ->> 'tokenFirma' = p_token);
$$;

-- La clave viaja en un encabezado de la petición, no en la dirección: así no
-- queda escrita en los registros del servidor ni en el historial del navegador.
create or replace function public.crm_token_pedido()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-firma-token', '');
$$;

-- ---------------------------------------------------------------------------
-- 3. ¿Quien pregunta es del equipo?
--
--    El buzón no es grave por lo que guarda, sino por lo que abre: junto a la
--    firma va la CLAVE del convenio, que es la misma que sirve para leerlo
--    entero desde el enlace. Dejarlo abierto a «cualquiera que haya entrado»
--    era regalarle esa clave a cuentas que no son de ventas —intendencia,
--    recepción, alguien dado de baja que conserva su acceso—, y con ella el
--    convenio completo. Peor todavía: podían sustituir la firma del cliente
--    antes de que el CRM la recogiera, o marcarla como atendida para que se
--    perdiera. Por eso el buzón pregunta el papel, igual que roles.sql.
--
--    Va por esta función y no por `public.crm_rol()` a secas para que este
--    archivo se siga pudiendo correr solo:
--
--    · Si TODAVÍA NO se ha corrido roles.sql, no existe el papel de nadie y el
--      buzón se queda como estaba —lo recoge todo el equipo—, que es justo el
--      comportamiento de siempre. No truena ni deja a nadie sin firmar.
--    · En cuanto se corra roles.sql, la guarda empieza a valer sola: no hace
--      falta volver a correr este archivo. Por eso la pregunta se arma en el
--      momento (`execute`) y no al crear la función.
--    · Ojo con un roles.sql VIEJO, de los de antes del papel 'ninguno': ahí
--      crm_rol() contesta 'ejecutivo' a cualquiera que entre, aunque no esté
--      en la lista, así que esta guarda lo deja pasar y el buzón se queda tan
--      abierto como estaba. No truena, pero tampoco protege: los dos archivos
--      tienen que ser de la misma tanda. Se comprueba en un renglón —quien no
--      esté en la lista debe dar 'ninguno':
--
--        select public.crm_rol();
--
--    · Y al revés, si se corre el «Para deshacer» de roles.sql: ahí crm_rol()
--      desaparece y el buzón vuelve a abrirse solo, que es justo lo que se
--      quiere de un deshacer. Por eso ese deshacer tira también la función.
--
--    El cliente sin cuenta no pasa por aquí: él deposita con su clave, y eso
--    no cambia.
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

-- ---------------------------------------------------------------------------
-- 4. Lo que puede hacer un visitante sin cuenta
-- ---------------------------------------------------------------------------
drop policy if exists "cliente lee su convenio" on public.crm_datos;
create policy "cliente lee su convenio" on public.crm_datos for select to anon
using (
  tipo = 'convenios'
  and borrado = false
  and public.crm_token_pedido() is not null
  and datos ->> 'tokenFirma' = public.crm_token_pedido()
);

drop policy if exists "cliente deja su firma" on public.crm_firmas;
create policy "cliente deja su firma" on public.crm_firmas for insert to anon
with check (public.crm_token_ok(convenio_id, token) and aplicada = false);

-- El equipo recoge del buzón y lo marca como aplicado. El papel se pregunta en
-- las dos cláusulas: el `using` decide cuáles filas alcanza a tocar, y el
-- `with check` cómo pueden quedar. Si sólo se pusiera en el `using`, bastaría
-- con que otra regla dejara la fila a la vista para poder escribirle encima.
drop policy if exists "equipo lee firmas"  on public.crm_firmas;
drop policy if exists "equipo marca firmas" on public.crm_firmas;
create policy "equipo lee firmas"   on public.crm_firmas for select to authenticated
  using (public.crm_del_equipo());
create policy "equipo marca firmas" on public.crm_firmas for update to authenticated
  using (public.crm_del_equipo()) with check (public.crm_del_equipo());

-- ---------------------------------------------------------------------------
-- 5. Para deshacer
--
--      drop policy if exists "cliente lee su convenio" on public.crm_datos;
--      drop table if exists public.crm_firmas;
--      drop function if exists public.crm_token_ok(text, text);
--      drop function if exists public.crm_token_pedido();
--      drop function if exists public.crm_del_equipo();
--
--    Los convenios ya firmados se quedan como están: la firma vive dentro del
--    convenio, no en el buzón.
-- ---------------------------------------------------------------------------
