-- ===========================================================================
--  ¿Puede un cliente firmar desde su enlace?
--
--  Esta prueba existe porque un cliente real NO pudo: leyó su convenio, lo
--  firmó con el dedo y al mandarlo le salió un error de base de datos en la
--  pantalla. La causa fue que la regla que lo deja depositar su firma no
--  estaba en el servidor —un .sql pegado a medias la tiró y no la recreó—.
--
--  Las reglas de fila no se prueban con un servidor de mentiras: se prueban
--  contra PostgreSQL. Esto hace justo eso.
-- ===========================================================================

insert into public.crm_datos (id, tipo, datos, borrado)
values ('convenios:v_prueba', 'convenios',
        '{"id":"v_prueba","folio":"CV-PRUEBA-1","tokenFirma":"laclavebuena"}'::jsonb, false)
on conflict (id) do update set datos = excluded.datos, borrado = false;

\echo ''
\echo '1. El buzón está montado (esto es lo que Ajustes pregunta ahora)'
select case when public.crm_buzon_ok() then '   ok' else '   FALLA' end as resultado;

\echo ''
\echo '2. El cliente puede LEER su convenio con su clave'
begin;
  set local role anon;
  select set_config('request.headers','{"x-firma-token":"laclavebuena"}',true) \g /dev/null
  select case when count(*) = 1 then '   ok' else '   FALLA' end as resultado
    from public.crm_datos where id = 'convenios:v_prueba';
commit;

\echo ''
\echo '3. Y puede DEPOSITAR su firma  <-- esto es lo que le falló al cliente'
begin;
  set local role anon;
  select set_config('request.headers','{"x-firma-token":"laclavebuena"}',true) \g /dev/null
  insert into public.crm_firmas (convenio_id, token, nombre, img)
  values ('v_prueba','laclavebuena','Cliente de prueba','data:image/png;base64,AAAA');
  \echo '   ok'
commit;

\echo ''
\echo '4. Sin nombre también entra: al cliente ya no se le exige escribirlo'
begin;
  set local role anon;
  select set_config('request.headers','{"x-firma-token":"laclavebuena"}',true) \g /dev/null
  insert into public.crm_firmas (convenio_id, token, nombre, img)
  values ('v_prueba','laclavebuena',null,'data:image/png;base64,AAAA');
  \echo '   ok'
commit;

\echo ''
\echo '5. Con una clave que no es la suya, NO entra'
begin;
  set local role anon;
  select set_config('request.headers','{"x-firma-token":"inventada"}',true) \g /dev/null
  savepoint s;
  do $$ begin
    insert into public.crm_firmas (convenio_id, token, nombre, img)
    values ('v_prueba','inventada','Intruso','x');
    raise exception 'FALLA: aceptó una clave inventada';
  exception when insufficient_privilege then
    raise notice '   ok';
  end $$;
commit;

\echo ''
\echo '6. Con el documento borrado, tampoco'
update public.crm_datos set borrado = true where id = 'convenios:v_prueba';
begin;
  set local role anon;
  select set_config('request.headers','{"x-firma-token":"laclavebuena"}',true) \g /dev/null
  do $$ begin
    insert into public.crm_firmas (convenio_id, token, nombre, img)
    values ('v_prueba','laclavebuena','Tarde','x');
    raise exception 'FALLA: aceptó una firma para un documento borrado';
  exception when insufficient_privilege then
    raise notice '   ok';
  end $$;
commit;
update public.crm_datos set borrado = false where id = 'convenios:v_prueba';

\echo ''
\echo '7. Y el que de verdad importa: un firmas.sql PEGADO A MEDIAS'
\echo '   no debe dejar el buzón peor de como estaba.'
\i /tmp/pruebasql/firmas_cortado.sql
select case when public.crm_buzon_ok() then '   ok · la regla sigue en pie'
            else '   FALLA · el pegado cortado cerró el buzón' end as resultado;
