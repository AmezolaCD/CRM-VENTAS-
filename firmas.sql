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
-- 3. Lo que puede hacer un visitante sin cuenta
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

-- El equipo recoge del buzón y lo marca como aplicado.
drop policy if exists "equipo lee firmas"  on public.crm_firmas;
drop policy if exists "equipo marca firmas" on public.crm_firmas;
create policy "equipo lee firmas"   on public.crm_firmas for select to authenticated using (true);
create policy "equipo marca firmas" on public.crm_firmas for update to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 4. Para deshacer
--
--      drop policy if exists "cliente lee su convenio" on public.crm_datos;
--      drop table if exists public.crm_firmas;
--      drop function if exists public.crm_token_ok(text, text);
--      drop function if exists public.crm_token_pedido();
--
--    Los convenios ya firmados se quedan como están: la firma vive dentro del
--    convenio, no en el buzón.
-- ---------------------------------------------------------------------------
