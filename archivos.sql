-- ===========================================================================
--  EL ALMACÉN DE ESCANEADOS
--
--  Qué resuelve: los convenios, contratos y cotizaciones que se suben ya
--  firmados se guardaban DENTRO del propio registro, en texto. Eso viaja a la
--  nube sin problema, pero también se queda en el navegador de cada equipo, y
--  ahí el tope son unos 5 MB: con tres documentos escaneados ya no cabía nada
--  más y el CRM avisaba que se estaba quedando sin lugar.
--
--  Con esto, los archivos van a un depósito aparte del mismo proyecto de
--  Supabase —1 GB en el plan gratuito, contra 5 MB del navegador— y del
--  registro cuelga nada más la ruta. El navegador deja de cargar con ellos.
--
--  Se corre UNA VEZ, en el SQL Editor de Supabase, y se puede repetir sin
--  hacer daño. No hace falta correrlo para que el CRM funcione: sin él, los
--  escaneados siguen guardándose como hasta ahora, con su aviso de que ya
--  casi no cabe.
--
--  Después de correrlo, en el CRM: Ajustes → Nube y equipo → "Mover los
--  escaneados al almacén". Eso sube los que ya estaban dentro de los
--  registros y libera el navegador de todo el equipo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. El depósito
--
--    Privado: nada de ligas públicas. Un escaneado de un convenio trae el
--    nombre del cliente, sus tarifas y dos firmas; no tiene por qué poder
--    abrirlo cualquiera que adivine la dirección.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('escaneados', 'escaneados', false, 20971520)   -- 20 MB por archivo
on conflict (id) do update
  set public = false,
      file_size_limit = 20971520;

-- ---------------------------------------------------------------------------
-- 2. Quién puede qué
--
--    Las mismas reglas de siempre, en corto: quien entró con su cuenta y está
--    en la lista de usuarios trabaja con los escaneados; quien no, no.
--
--    No se reparte por dueño como en crm_datos. Un escaneado no dice de quién
--    es —es un archivo suelto con un nombre al azar— y la ruta sólo la conoce
--    quien ya recibió el registro que la trae. Repartirlo de nuevo aquí sería
--    dar una seguridad que no es: el que tiene el registro tiene la ruta.
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

-- Se tiran primero, para que volver a correrlo no truene.
drop policy if exists "escaneados lee"    on storage.objects;
drop policy if exists "escaneados sube"   on storage.objects;
drop policy if exists "escaneados cambia" on storage.objects;
drop policy if exists "escaneados borra"  on storage.objects;

create policy "escaneados lee" on storage.objects for select to authenticated
using (
  bucket_id = 'escaneados'
  and public.crm_del_equipo()
);

create policy "escaneados sube" on storage.objects for insert to authenticated
with check (
  bucket_id = 'escaneados'
  and public.crm_del_equipo()
);

create policy "escaneados cambia" on storage.objects for update to authenticated
using (
  bucket_id = 'escaneados'
  and public.crm_del_equipo()
);

create policy "escaneados borra" on storage.objects for delete to authenticated
using (
  bucket_id = 'escaneados'
  and public.crm_del_equipo()
);

-- ---------------------------------------------------------------------------
-- 3. Para deshacer
--
--    Si algo sale mal y hay que volver a como estaba, corre esto. Los
--    escaneados que ya se hayan mudado al depósito dejarían de abrirse, así
--    que antes de deshacerlo saca un respaldo desde el CRM
--    (Exportar → Respaldo completo).
--
--      drop policy if exists "escaneados lee"    on storage.objects;
--      drop policy if exists "escaneados sube"   on storage.objects;
--      drop policy if exists "escaneados cambia" on storage.objects;
--      drop policy if exists "escaneados borra"  on storage.objects;
--
--    El depósito y los archivos se quedan; para tirarlos también, desde el
--    panel de Storage de Supabase, a mano y con cuidado.
-- ---------------------------------------------------------------------------
