-- ===========================================================================
--  CRM CORE · La liga pública de registro
--
--  Permite que alguien que vio un anuncio —y que no tiene cuenta ni tiene por
--  qué tenerla— abra una liga, deje sus datos y caiga en el CRM sabiendo de
--  qué campaña vino.
--
--  Córrelo después de nube.sql. Se puede repetir sin borrar nada.
--
--  Cómo está pensado, que es lo que importa:
--
--  · El visitante NO lee nada. La liga no le enseña un solo dato del hotel:
--    sólo le pone un formulario enfrente. No hay manera de sacarle la cartera
--    a esta liga porque no tiene permiso de leer ninguna tabla.
--  · Deposita en un buzón aparte, igual que el cliente que firma. El CRM lo
--    recoge de ahí y crea el prospecto.
--  · La clave de la liga es del hotel, no de una persona, y va en la dirección
--    porque es una liga pública: se pega en un anuncio. Lo único que abre es
--    el derecho a DEPOSITAR, así que si alguien la copia, lo peor que puede
--    hacer es mandar registros de mentira —que se borran de un clic—.
--  · Del buzón recoge el EQUIPO, no cualquiera que haya entrado al servidor.
--
--  Sin correrlo, el CRM funciona igual: el formulario de prospección de
--  adentro sigue trabajando, y las ligas con UTMs se pueden armar apuntando a
--  la página del hotel. Lo único que falta es el registro desde fuera.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. El buzón
--
--    Guarda lo mismo que pide el formulario, más de dónde vino. Nada de esto
--    es delicado por sí solo, pero son datos de una persona: por eso el buzón
--    no lo lee nadie más que el equipo.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_altas (
  id          bigserial primary key,
  token       text not null,
  nombre      text,
  apellido    text,
  email       text,
  telefono    text,
  compania    text,
  interes     text,
  utm         jsonb   not null default '{}'::jsonb,
  aplicada    boolean not null default false,
  creado      timestamptz not null default now()
);
create index if not exists crm_altas_pend_idx on public.crm_altas (aplicada) where aplicada = false;

alter table public.crm_altas enable row level security;

-- ---------------------------------------------------------------------------
-- 2. ¿La clave es la del hotel?
--
--    Va como security definer porque el visitante no puede leer los ajustes
--    por su cuenta: sólo se le deja hacer esta pregunta concreta, que se
--    contesta con sí o no y no revela nada más.
--
--    La clave la genera el CRM y vive en los ajustes. Cambiarla desde Ajustes
--    invalida las ligas viejas, que es justo lo que se quiere si alguna se
--    llenó de registros basura.
-- ---------------------------------------------------------------------------
create or replace function public.crm_alta_token_ok(p_token text)
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
       and coalesce(d.datos -> 'hotel' ->> 'tokenAlta', '') <> ''
       and d.datos -> 'hotel' ->> 'tokenAlta' = p_token);
$$;

-- ---------------------------------------------------------------------------
-- 3. ¿Quien pregunta es del equipo?
--
--    La misma de firmas.sql, archivos.sql y folios.sql, palabra por palabra:
--    "create or replace" hace que gane la última que se corra, así que las
--    cuatro tienen que decir exactamente lo mismo. Si alguna vez hay que
--    cambiarla, se cambia en los cuatro archivos a la vez.
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
--
--    Una sola cosa: dejar su registro, con la clave buena y sin marcarlo como
--    atendido. No lee, no corrige, no borra. Ni siquiera puede ver lo que él
--    mismo acaba de dejar.
-- ---------------------------------------------------------------------------
drop policy if exists "visitante deja su registro" on public.crm_altas;
create policy "visitante deja su registro" on public.crm_altas for insert to anon
with check (public.crm_alta_token_ok(token) and aplicada = false);

-- El equipo recoge del buzón y lo marca como atendido. El papel se pregunta en
-- las dos cláusulas: el `using` decide cuáles filas alcanza a tocar, y el
-- `with check` cómo pueden quedar. Si sólo se pusiera en el `using`, bastaría
-- con que otra regla dejara la fila a la vista para poder escribirle encima.
drop policy if exists "equipo lee altas"   on public.crm_altas;
drop policy if exists "equipo marca altas" on public.crm_altas;
drop policy if exists "equipo borra altas" on public.crm_altas;
create policy "equipo lee altas"   on public.crm_altas for select to authenticated
  using (public.crm_del_equipo());
create policy "equipo marca altas" on public.crm_altas for update to authenticated
  using (public.crm_del_equipo()) with check (public.crm_del_equipo());
-- Borrar sirve para la basura: una liga que se filtró y se llenó de registros
-- falsos se limpia desde el CRM sin tener que entrar a Supabase.
create policy "equipo borra altas" on public.crm_altas for delete to authenticated
  using (public.crm_del_equipo());

-- ---------------------------------------------------------------------------
-- 5. Para deshacer
--
--      drop table if exists public.crm_altas;
--      drop function if exists public.crm_alta_token_ok(text);
--
--    Los prospectos que ya se recogieron se quedan: viven en la cartera, no en
--    el buzón. Lo único que se pierde es la posibilidad de registrarse desde
--    fuera, y la liga deja de funcionar.
--
--    La función crm_del_equipo() NO se tira aquí: la comparten firmas.sql,
--    archivos.sql y folios.sql, y tirarla les quitaría la guarda a esos.
-- ---------------------------------------------------------------------------
