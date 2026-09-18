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
--  Quien entra con una cuenta que NO está en esa lista queda en el papel
--  'ninguno': no lee ni escribe un solo registro. Es a propósito —ya hay
--  cuentas en el servidor que no son de ventas, y no tienen por qué alcanzar
--  la cartera—, y es también por qué el alta en la lista no es opcional.
--
--  Se puede volver a correr cuantas veces haga falta: reemplaza lo que ya
--  estaba en lugar de acumularlo. Si agregaste gente o cambiaste papeles, no
--  hace falta correrlo otra vez —las reglas leen la lista viva—; sólo cuando
--  cambie este archivo.
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
      -- El `order by` no es de adorno: si el mismo correo quedó capturado dos
      -- veces con papeles distintos, sin él gana la fila que el servidor topa
      -- primero, y eso cambia de un día para otro —entre 'admin' y 'captura'
      -- va de verlo todo a no ver nada—. Con él siempre gana la misma.
      order by d.id
      limit 1),
    '{}'::jsonb);
$$;

-- Un correo que no aparece en la lista no es un ejecutivo al que se le olvidó
-- marcar la cartera: es alguien que no es de ventas —operación, recepción, una
-- cuenta vieja— y que entró al servidor por otra puerta. Ésos quedan en
-- 'ninguno', que abajo no alcanza nada. Quien sí está en la lista pero se quedó
-- sin papel sigue contando como ejecutivo, como siempre.
create or replace function public.crm_rol()
returns text
language sql
stable
as $$
  select case
           when public.crm_yo() = '{}'::jsonb then 'ninguno'
           else coalesce(public.crm_yo() ->> 'rol', 'ejecutivo')
         end;
$$;

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
--    · Administración y dirección ven todo lo demás.
--    · Cada gerencia ve el trabajo de todo su equipo; un ejecutivo ve lo suyo
--      y lo que todavía no tiene dueño.
--    · Ventas y banquetes comparten la cartera de clientes y la bitácora, pero
--      no los documentos del otro: los convenios, los contratos de hospedaje y
--      los huéspedes no le bajan a banquetes, y los eventos de banquetes no le
--      bajan a ventas.
--    · El papel 'captura' —la tableta del lobby— sólo levanta prospectos en
--      eventos: no lee ni escribe nada más, ni siquiera le baja la cartera.
--    · El papel 'ninguno' —quien no está en la lista— no alcanza nada: ni el
--      catálogo, ni la lista de usuarios, ni lo que todavía no tiene dueño.
--      Cero filas y ninguna escritura. Se dice en las tres reglas y no se deja
--      al 'else', porque el 'else' es justo el que reparte el catálogo y lo
--      que no tiene dueño.
--
--    Escribir sigue abierto a cualquiera que haya entrado, salvo los ajustes y
--    la lista de usuarios, que son del administrador. No se restringe más
--    porque quien puede ver un registro necesita poder corregirlo.
-- ---------------------------------------------------------------------------
-- Se tiran primero las de nube.sql y también las de este archivo, para que
-- volver a correrlo no truene con "policy already exists".
drop policy if exists "equipo lee"     on public.crm_datos;
drop policy if exists "equipo inserta" on public.crm_datos;
drop policy if exists "equipo edita"   on public.crm_datos;
drop policy if exists "lee lo suyo"    on public.crm_datos;
drop policy if exists "inserta"        on public.crm_datos;
drop policy if exists "edita"          on public.crm_datos;

create policy "lee lo suyo" on public.crm_datos for select to authenticated
using (
  case
    -- Quien no está en la lista de usuarios no alcanza nada.
    when public.crm_rol() = 'ninguno' then false

    -- La administración y la dirección lo ven todo. El departamento que
    -- escogen al entrar acota la pantalla, no el permiso: alcanzan los dos.
    when public.crm_rol() in ('admin','direccion') then true

    -- La tableta del lobby: los ajustes, la lista de usuarios y lo que ella
    -- misma capturó. Nada más.
    when public.crm_rol() = 'captura'
      then tipo in ('ajustes','usuarios')
        or (tipo = 'prospectos' and lower(coalesce(duenio,'')) = lower(public.crm_nombre()))

    -- Banquetes comparte la cartera con ventas, pero el hospedaje no es suyo.
    -- La cartera le baja entera a propósito: un evento cuelga de un cliente, y
    -- sin el cliente el evento no se puede ni abrir. La pantalla le sigue
    -- enseñando nada más los suyos.
    when public.crm_rol() in ('banquetes','gte_banquetes')
      then tipo not in ('convenios','contratos','huespedes')
       and (tipo in ('ajustes','habitaciones','usuarios','clientes')
            or public.crm_rol() = 'gte_banquetes'
            or duenio is null
            or lower(duenio) = lower(public.crm_nombre()))

    -- Ventas: todo menos los eventos de banquetes.
    else tipo <> 'eventos'
     and (tipo in ('ajustes','habitaciones','usuarios')
          or public.crm_rol() = 'gerente'
          or duenio is null
          or lower(duenio) = lower(public.crm_nombre()))
  end
);

create policy "inserta" on public.crm_datos for insert to authenticated
with check (
  case when public.crm_rol() = 'ninguno'
            then false
       when tipo in ('ajustes','usuarios','habitaciones')
            then public.crm_rol() = 'admin'
       when public.crm_rol() = 'captura'
            then tipo = 'prospectos'
       else true end
);

-- Escribir se deja más suelto que leer a propósito: un renglón que el servidor
-- no le entrega es un renglón que ese equipo nunca va a mandar, y una regla de
-- más aquí le tumbaría la subida entera por una fila que ni siquiera tiene.
create policy "edita" on public.crm_datos for update to authenticated
using (
  case when public.crm_rol() = 'ninguno'
       then false
       when public.crm_rol() = 'captura'
       then tipo = 'prospectos' and lower(coalesce(duenio,'')) = lower(public.crm_nombre())
       else tipo in ('ajustes','habitaciones','usuarios')
            or public.crm_rol() in ('admin','direccion','gerente','gte_banquetes')
            or duenio is null
            or lower(duenio) = lower(public.crm_nombre())
  end
)
with check (
  case when public.crm_rol() = 'ninguno'
            then false
       when tipo in ('ajustes','usuarios','habitaciones')
            then public.crm_rol() = 'admin'
       when public.crm_rol() = 'captura'
            then tipo = 'prospectos'
       else true end
);

-- ---------------------------------------------------------------------------
-- 4. La bitácora, sólo para quien manda
-- ---------------------------------------------------------------------------
drop policy if exists "equipo lee bitacora"   on public.crm_bitacora;
drop policy if exists "gerencia lee bitacora" on public.crm_bitacora;
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
--      drop function if exists public.crm_rol();
--      drop function if exists public.crm_nombre();
--      drop function if exists public.crm_yo();
--
--    Las tres funciones se van con las políticas, y no es limpieza de adorno:
--    el buzón de firmas de firmas.sql también pregunta el papel, y lo pregunta
--    por su cuenta. Si se tiran nada más las políticas de aquí, crm_rol() se
--    queda viva contestando 'ninguno' a todo el que no esté en la lista, y el
--    buzón sigue cerrado para el equipo entero sin un solo aviso: el CRM lo
--    revisa, lo encuentra vacío y no reporta nada, así que las firmas de los
--    clientes se quedan ahí sin que nadie se entere. Sin crm_rol(), el buzón
--    se vuelve a abrir solo; no hay que correr firmas.sql otra vez.
--
--    La columna `duenio` sí se queda. No estorba —la aplicación trabaja igual
--    con ella y sin ella— y borrarla tiraría el dueño de cada registro, que es
--    trabajo de volver a subir todo.
-- ---------------------------------------------------------------------------
