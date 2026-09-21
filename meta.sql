-- ===========================================================================
--  CRM CORE · Lo que Meta nos cuenta de los anuncios
--
--  Qué resuelve: hoy el gasto de las campañas se captura a mano, mes por mes.
--  Funciona, pero se teclea tarde, se teclea redondeado y a veces no se
--  teclea. Con esto, el gasto, las impresiones, los clics y los leads bajan
--  solos de Meta, todos los días, ya desglosados por día y por campaña.
--
--  Se corre UNA VEZ en el SQL Editor de Supabase y se puede repetir.
--
--  ---------------------------------------------------------------------------
--  TRES COSAS QUE NO SE DEBEN TOCAR SIN PENSARLO DOS VECES
--  ---------------------------------------------------------------------------
--
--  1. AQUÍ NADIE ESCRIBE DESDE EL NAVEGADOR. No hay una sola regla de insert
--     ni de update: estas tablas las llena únicamente la función meta-sync,
--     que corre en el servidor de Supabase con la llave de servicio y por eso
--     pasa por encima de las reglas. Si algún día se agrega un permiso de
--     escritura "para arreglar un dato a mano", cualquiera con una sesión del
--     CRM podría inventarse el gasto de una campaña —y el retorno con él—.
--
--  2. ESTAS TABLAS NO SON DEL CRM. El CRM sincroniza su cartera contra
--     crm_datos; esto vive aparte y sólo se lee. Es a propósito: son cifras de
--     Meta, no documentos del hotel, y meterlas al mismo costal haría que cada
--     equipo intentara subirlas de regreso.
--
--  3. LA LLAVE PRIMARIA ES (nivel, objeto, fecha). De ahí sale que volver a
--     bajar los mismos días no duplique nada, y eso es lo que permite releer
--     siempre los últimos siete días: Meta CORRIGE sus cifras días después
--     —atribución tardía, cargos que entran al rato— y si sólo se bajara "lo
--     nuevo desde la última vez", el hotel se quedaría para siempre con la
--     primera versión, que casi nunca es la buena.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. El catálogo: qué es cada id de Meta
--
--    Meta trabaja con ids como "120210000000000123". El nombre de la campaña
--    se guarda aquí para que, al enlazar una campaña del CRM, la persona
--    escoja de una lista con nombres y no teclee un número de dieciocho
--    dígitos —que es una manera segura de amarrar la campaña equivocada—.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_meta_objetos (
  nivel      text not null,                      -- 'campana', 'conjunto', 'anuncio'
  objeto     text not null,                      -- el id de Meta
  nombre     text not null default '',
  padre      text not null default '',           -- el id del nivel de arriba
  estado     text not null default '',           -- ACTIVE, PAUSED…
  cuenta     text not null default '',           -- act_XXXXXXXX
  visto      timestamptz not null default now(), -- la última vez que Meta lo mencionó
  primary key (nivel, objeto)
);

-- ---------------------------------------------------------------------------
-- 2. Las cifras, un renglón por objeto y por día
--
--    Por día y no por mes a propósito: un mes es la suma de sus días, pero de
--    un mes ya sumado no se saca una semana. Y el tablero pregunta por rangos
--    que no empiezan en día primero.
--
--    El gasto viene en la moneda de la cuenta publicitaria, que se guarda tal
--    cual en 'moneda'. No se convierte nada: el CRM ya tiene un campo de tipo
--    de cambio que es texto libre, y adivinar una conversión sería inventarse
--    un número que después alguien lee como si fuera cierto.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_meta_metricas (
  nivel        text not null,
  objeto       text not null,
  fecha        date not null,
  cuenta       text not null default '',
  gasto        numeric(14,2) not null default 0,
  impresiones  bigint  not null default 0,
  alcance      bigint  not null default 0,
  clics        bigint  not null default 0,
  leads        integer not null default 0,
  moneda       text    not null default '',
  actualizado  timestamptz not null default now(),
  primary key (nivel, objeto, fecha)
);

create index if not exists crm_meta_metricas_fecha_idx
  on public.crm_meta_metricas (fecha);

-- ---------------------------------------------------------------------------
-- 3. La bitácora de la conexión
--
--    Es lo único de todo esto que le sirve a una persona no técnica: dice si
--    la conexión con Meta sigue viva, cuándo fue la última vez que trajo algo
--    y, si falló, por qué. Sin esto, el día que el acceso caduque las cifras
--    simplemente se congelarían y nadie se enteraría hasta la junta.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_meta_sync (
  id      bigserial primary key,
  cuando  timestamptz not null default now(),
  quien   text not null default '',      -- el correo de quien la disparó
  cuenta  text not null default '',
  desde   date,
  hasta   date,
  filas   integer not null default 0,
  ok      boolean not null default true,
  detalle text not null default ''
);

create index if not exists crm_meta_sync_cuando_idx
  on public.crm_meta_sync (cuando desc);

alter table public.crm_meta_objetos  enable row level security;
alter table public.crm_meta_metricas enable row level security;
alter table public.crm_meta_sync     enable row level security;

-- ---------------------------------------------------------------------------
-- 4. ¿Quien pregunta es del equipo?
--
--    La misma de firmas.sql, archivos.sql, folios.sql y prospectos.sql,
--    palabra por palabra: "create or replace" hace que gane la última que se
--    corra, así que todas tienen que decir exactamente lo mismo. Si alguna vez
--    hay que cambiarla, se cambia en los cinco archivos a la vez.
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
-- 5. ¿Y le toca ver lo de marketing?
--
--    Las cifras de los anuncios son del área de marketing, de la dirección y
--    de la administración. Un ejecutivo de ventas no tiene por qué saber
--    cuánto se gastó en anuncios este mes, igual que marketing no ve los
--    contratos.
--
--    Se busca crm_rol() a mano y se llama con EXECUTE por lo mismo de siempre:
--    PostgreSQL resuelve los nombres al CREAR la regla, no al usarla, así que
--    nombrarla derecho tumbaría este archivo cuando se corre antes que
--    roles.sql. Sin roles.sql corrido le abre a cualquiera que haya entrado
--    con su cuenta, que es como trabajaba el CRM antes de los papeles.
-- ---------------------------------------------------------------------------
create or replace function public.crm_ve_marketing()
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare papel text;
begin
  if to_regprocedure('public.crm_rol()') is null then
    return true;
  end if;
  execute 'select public.crm_rol()' into papel;
  return coalesce(papel, '') in ('admin', 'direccion', 'marketing', 'gte_marketing');
end;
$$;

grant execute on function public.crm_ve_marketing() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Quién puede qué
--
--    Leer: marketing, dirección y administración.
--    Escribir: NADIE con una sesión del navegador. Ni una regla de insert, de
--    update o de delete, a propósito (ver el punto 1 de arriba). La función
--    meta-sync escribe con la llave de servicio, que no pasa por estas reglas.
-- ---------------------------------------------------------------------------
--    Primero los permisos de tabla, que son la reja de afuera. Supabase le da
--    permiso de todo sobre cada tabla nueva a quien entra con su cuenta, y lo
--    que hoy impide que escriba es que no exista una regla que se lo permita.
--    Eso basta, pero es una sola línea de defensa: aquí se le quita también el
--    permiso, para que escribir no dependa nada más de que nadie agregue una
--    regla por descuido. Se hace preguntando si el papel existe, porque este
--    archivo también se corre contra un PostgreSQL pelón al probarlo.
do $permisos$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format(
        'revoke all on public.crm_meta_objetos, public.crm_meta_metricas, '
        'public.crm_meta_sync from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.crm_meta_objetos, public.crm_meta_metricas, '
            'public.crm_meta_sync to authenticated';
  end if;
end;
$permisos$;

drop policy if exists "meta objetos lee"  on public.crm_meta_objetos;
drop policy if exists "meta metricas lee" on public.crm_meta_metricas;
drop policy if exists "meta sync lee"     on public.crm_meta_sync;

create policy "meta objetos lee"  on public.crm_meta_objetos  for select to authenticated
  using (public.crm_ve_marketing());
create policy "meta metricas lee" on public.crm_meta_metricas for select to authenticated
  using (public.crm_ve_marketing());
create policy "meta sync lee"     on public.crm_meta_sync     for select to authenticated
  using (public.crm_ve_marketing());

-- ---------------------------------------------------------------------------
-- 7. La limpieza
--
--    Meta guarda sus cifras por años; el hotel no las necesita tan atrás. Esto
--    borra lo que pase de dos años y las anotaciones de la bitácora de más de
--    noventa días. No se corre solo: se llama cuando alguien quiera, y sirve
--    sobre todo para que el proyecto gratuito no se llene con el tiempo.
--
--      select public.crm_meta_limpia();
-- ---------------------------------------------------------------------------
create or replace function public.crm_meta_limpia()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_met int;
  v_bit int;
begin
  if not public.crm_ve_marketing() then
    raise exception 'Sin permiso.';
  end if;

  delete from public.crm_meta_metricas where fecha < current_date - 730;
  get diagnostics v_met = row_count;
  delete from public.crm_meta_sync where cuando < now() - interval '90 days';
  get diagnostics v_bit = row_count;

  return format('Se borraron %s días de cifras viejas y %s anotaciones de la bitácora.',
                v_met, v_bit);
end;
$$;

revoke all on function public.crm_meta_limpia() from public;
grant execute on function public.crm_meta_limpia() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Para deshacer
--
--      drop function if exists public.crm_meta_limpia();
--      drop table if exists public.crm_meta_metricas;
--      drop table if exists public.crm_meta_objetos;
--      drop table if exists public.crm_meta_sync;
--      drop function if exists public.crm_ve_marketing();
--
--    El CRM vuelve solo a contar únicamente con el gasto capturado a mano, y
--    lo dice en la pantalla de campañas. No se pierde nada del hotel: aquí no
--    vive un solo dato propio, todo esto es copia de lo que Meta ya tiene.
--
--    La función crm_del_equipo() NO se tira aquí: la comparten firmas.sql,
--    archivos.sql, folios.sql y prospectos.sql.
-- ---------------------------------------------------------------------------
