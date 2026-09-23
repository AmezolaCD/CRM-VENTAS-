-- ===========================================================================
--  CRM CORE · Los mensajes de WhatsApp que entran por un anuncio
--
--  Qué resuelve: los anuncios del hotel son de MENSAJES. La gente da clic y
--  escribe por WhatsApp, y eso hasta hoy no dejaba rastro en el CRM: o alguien
--  lo capturaba a mano, o se perdía. Por eso los conjuntos de anuncios salen
--  con inversión y con cero leads.
--
--  Con esto, el proveedor de WhatsApp —360dialog— le avisa al servidor cada
--  vez que entra un mensaje, y el CRM lo vuelve un lead. Y cuando el mensaje
--  viene de un anuncio de clic-a-WhatsApp, TRAE EL ID DEL ANUNCIO: de ahí se
--  sube al conjunto y del conjunto a la campaña, así que el lead cae ya
--  amarrado a lo que lo trajo.
--
--  Se corre UNA VEZ en el SQL Editor de Supabase y se puede repetir.
--
--  ---------------------------------------------------------------------------
--  TRES COSAS QUE NO SE DEBEN TOCAR SIN PENSARLO DOS VECES
--  ---------------------------------------------------------------------------
--
--  1. AQUÍ NADIE ESCRIBE DESDE EL NAVEGADOR. No hay una sola regla de insert:
--     este buzón lo llena únicamente la función wa-hook, que corre en el
--     servidor de Supabase con la llave de servicio y por eso pasa por encima
--     de las reglas. Si algún día se agrega un permiso de escritura "para
--     probar", cualquiera con una sesión del CRM podría inventarse leads —y un
--     CRM con leads inventados es peor que uno vacío, porque se actúa sobre
--     ellos—.
--
--  2. `mensaje_id` ES ÚNICO, y eso no es de adorno. Meta y 360dialog REINTENTAN
--     cuando no reciben un 200 a tiempo. Sin esta restricción, un reintento
--     crearía un segundo renglón del mismo mensaje y el CRM levantaría dos
--     leads de la misma persona. Con ella, el reintento choca y se ignora, que
--     es exactamente lo que debe pasar.
--
--  3. AQUÍ HAY DATOS DE PERSONAS —teléfonos, nombres y lo que escribieron—, así
--     que el buzón no lo lee nadie más que el equipo. Es la misma regla que ya
--     usan el buzón de firmas y el de altas.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. El buzón
--
--    Se guarda el mensaje tal como llega y el `referral` completo en crudo. En
--    crudo a propósito: Meta le agrega campos a ese objeto cada tanto, y
--    desarmarlo aquí obligaría a volver a correr este archivo cada vez que
--    aparezca uno nuevo. El CRM lee lo que entiende y lo demás se queda
--    guardado por si algún día sirve.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_wa (
  id         bigserial primary key,
  mensaje_id text not null,                      -- el de Meta: wamid.XXXX
  telefono   text not null default '',
  perfil     text not null default '',           -- el nombre que trae su WhatsApp
  texto      text not null default '',
  tipo       text not null default '',           -- text, image, audio…
  referral   jsonb not null default '{}'::jsonb, -- de qué anuncio llegó, tal cual
  /* De qué conjunto y de qué campaña del CRM es. LO RESUELVE LA FUNCIÓN, no el
     navegador, y por una razón concreta: el catálogo de Meta sólo lo puede
     leer marketing, y las campañas no le bajan a ventas. Si la cuenta que
     sincroniza fuera de ventas, no tendría con qué resolverlo y el lead se
     quedaría sin campaña para siempre —el mensaje ya se marcó como atendido—.
     La función tiene la llave de servicio y lo ve todo: lo resuelve una vez,
     bien, y a cualquiera que recoja le llega ya amarrado. */
  conjunto   text not null default '',
  campana_id text not null default '',
  recibido   timestamptz not null default now(),
  aplicada   boolean not null default false
);

-- Único de verdad, no un índice cualquiera: es lo que hace que un reintento no
-- levante un segundo lead de la misma persona.
create unique index if not exists crm_wa_mensaje_idx on public.crm_wa (mensaje_id);
create index if not exists crm_wa_pend_idx on public.crm_wa (aplicada) where aplicada = false;

alter table public.crm_wa enable row level security;

-- ---------------------------------------------------------------------------
-- 2. La bitácora de la conexión
--
--    Lo único de todo esto que le sirve a una persona no técnica: dice si el
--    webhook sigue vivo y cuándo entró el último mensaje. Sin esto, el día que
--    se caiga los leads simplemente dejarían de llegar y nadie se enteraría
--    hasta preguntarse por qué ya nadie escribe.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_wa_log (
  id      bigserial primary key,
  cuando  timestamptz not null default now(),
  evento  text not null default '',     -- mensaje, acuse, rechazado, error
  ok      boolean not null default true,
  detalle text not null default ''
);
create index if not exists crm_wa_log_cuando_idx on public.crm_wa_log (cuando desc);

alter table public.crm_wa_log enable row level security;

-- ---------------------------------------------------------------------------
-- 3. ¿Quien pregunta es del equipo?
--
--    La misma de firmas.sql, archivos.sql, folios.sql, prospectos.sql y
--    meta.sql, palabra por palabra: "create or replace" hace que gane la última
--    que se corra, así que todas tienen que decir exactamente lo mismo. Si
--    alguna vez hay que cambiarla, se cambia en los seis archivos a la vez.
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
-- 4. Quién puede qué
--
--    Leer y marcar: el equipo. Borrar: también, porque una conexión mal puesta
--    puede llenar el buzón de basura y eso se limpia desde el CRM sin tener que
--    entrar a Supabase.
--
--    Escribir: NADIE con una sesión del navegador. Ni una regla de insert, a
--    propósito (ver el punto 1 de arriba). La función wa-hook escribe con la
--    llave de servicio, que no pasa por estas reglas.
-- ---------------------------------------------------------------------------
--    Primero los permisos de tabla, que son la reja de afuera. Supabase le da
--    permiso de todo sobre cada tabla nueva a quien entra con su cuenta, y lo
--    que hoy impide que escriba es que no exista una regla que se lo permita.
--    Eso basta, pero es una sola línea de defensa: aquí se le quita también el
--    permiso de insertar, para que no dependa nada más de que nadie agregue una
--    regla por descuido.
do $permisos$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.crm_wa, public.crm_wa_log from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, update, delete on public.crm_wa to authenticated';
    execute 'grant select on public.crm_wa_log to authenticated';
  end if;
end;
$permisos$;

drop policy if exists "equipo lee wa"    on public.crm_wa;
drop policy if exists "equipo marca wa"  on public.crm_wa;
drop policy if exists "equipo borra wa"  on public.crm_wa;
drop policy if exists "equipo lee wa log" on public.crm_wa_log;

-- El papel se pregunta en las dos cláusulas del update: el `using` decide
-- cuáles filas alcanza a tocar, y el `with check` cómo pueden quedar. Si sólo
-- se pusiera en el `using`, bastaría con que otra regla dejara la fila a la
-- vista para poder escribirle encima.
create policy "equipo lee wa"   on public.crm_wa for select to authenticated
  using (public.crm_del_equipo());
create policy "equipo marca wa" on public.crm_wa for update to authenticated
  using (public.crm_del_equipo()) with check (public.crm_del_equipo());
create policy "equipo borra wa" on public.crm_wa for delete to authenticated
  using (public.crm_del_equipo());
create policy "equipo lee wa log" on public.crm_wa_log for select to authenticated
  using (public.crm_del_equipo());

-- ---------------------------------------------------------------------------
-- 5. La limpieza
--
--    Los mensajes ya convertidos en lead no hacen falta en el buzón: el lead
--    vive en la cartera. Esto borra los aplicados de más de treinta días y las
--    anotaciones de la bitácora de más de noventa. No se corre solo.
--
--      select public.crm_wa_limpia();
-- ---------------------------------------------------------------------------
create or replace function public.crm_wa_limpia()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg int;
  v_bit int;
begin
  if not public.crm_del_equipo() then
    raise exception 'Sin permiso.';
  end if;

  delete from public.crm_wa
   where aplicada = true and recibido < now() - interval '30 days';
  get diagnostics v_msg = row_count;
  delete from public.crm_wa_log where cuando < now() - interval '90 days';
  get diagnostics v_bit = row_count;

  return format('Se borraron %s mensajes ya atendidos y %s anotaciones de la bitácora.',
                v_msg, v_bit);
end;
$$;

revoke all on function public.crm_wa_limpia() from public;
grant execute on function public.crm_wa_limpia() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Para deshacer
--
--      drop function if exists public.crm_wa_limpia();
--      drop table if exists public.crm_wa;
--      drop table if exists public.crm_wa_log;
--
--    El CRM vuelve solo a que los leads de WhatsApp se capturen a mano, con el
--    botón que ya está en la pestaña Leads, y lo dice en la pantalla. Los leads
--    que ya se crearon NO se pierden: viven en la cartera, no aquí.
--
--    La función crm_del_equipo() NO se tira aquí: la comparten firmas.sql,
--    archivos.sql, folios.sql, prospectos.sql y meta.sql.
--
--    Y acuérdate de quitar el webhook en el Hub de 360dialog, o el proveedor
--    seguirá tocando una puerta que ya no abre nadie.
-- ---------------------------------------------------------------------------
