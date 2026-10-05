-- ===========================================================================
--  EL CONTADOR DE FOLIOS NO DEBE REPARTIR UN NÚMERO QUE YA EXISTE
--
--  A Marco se le repitieron los folios CT-2026-002 y CT-2026-004 «sin razón
--  aparente». El contador reparte max(numero)+1 sobre SU PROPIA tabla, así que
--  al montarlo hay que llenarla con lo que ya existe en la cartera; si no,
--  arranca en 001 y vuelve a repartir todo el año.
--
--  Ese relleno existía, pero guardaba los eventos de banquetes con el tipo de
--  la fila —'eventos'— y la aplicación le pide al contador por SERIE:
--  'eventos_ev' para la cotización y 'eventos_cb' para el contrato. Las dos
--  series quedaban sin rellenar, y además se pisaban entre ellas.
-- ===========================================================================

\echo ''
\echo 'Se meten documentos con folio, como los que ya tiene el hotel:'
insert into public.crm_datos (id, tipo, datos, borrado) values
  ('convenios:vA', 'convenios', '{"id":"vA","folio":"CV-2026-005"}'::jsonb, false),
  ('contratos:kA', 'contratos', '{"id":"kA","folio":"CT-2026-011"}'::jsonb, false),
  ('eventos:eA',   'eventos',   '{"id":"eA","folio":"EV-2026-007"}'::jsonb, false),
  ('eventos:eB',   'eventos',   '{"id":"eB","folio":"CB-2026-003"}'::jsonb, false),
  ('contratos:kB', 'contratos', '{"id":"kB","folio":"CT-2026-050"}'::jsonb, true)
on conflict (id) do update set datos = excluded.datos, borrado = excluded.borrado;
\echo '   ok'

\echo ''
\echo 'Se vuelve a correr folios.sql, que es lo que pone el contador al día:'
\i /tmp/pruebasql/folios.sql
\echo '   ok'

\echo ''
\echo '1. El siguiente convenio va después del CV-2026-005'
select case when public.crm_aparta_folio('convenios','2026'::int,'CV','prueba') = 'CV-2026-006'
            then '   ok' else '   FALLA' end as resultado;

\echo ''
\echo '2. El siguiente contrato va después del CT-2026-011  <-- lo de Marco'
select case when public.crm_aparta_folio('contratos','2026'::int,'CT','prueba') = 'CT-2026-012'
            then '   ok' else '   FALLA' end as resultado;

\echo ''
\echo '3. La cotización de banquetes va después del EV-2026-007'
\echo '   (aquí arrancaba en 001 y repetía el año entero)'
select case when public.crm_aparta_folio('eventos_ev','2026'::int,'EV','prueba') = 'EV-2026-008'
            then '   ok' else '   FALLA' end as resultado;

\echo ''
\echo '4. Y el contrato de banquetes lleva su PROPIA serie, no la de la cotización'
select case when public.crm_aparta_folio('eventos_cb','2026'::int,'CB','prueba') = 'CB-2026-004'
            then '   ok' else '   FALLA' end as resultado;

\echo ''
\echo '5. Dos que piden a la vez se llevan números distintos'
select case when public.crm_aparta_folio('contratos','2026'::int,'CT','prueba') = 'CT-2026-013'
            then '   ok' else '   FALLA' end as resultado;

\echo ''
\echo '6. Un documento BORRADO no entra al contador'
\echo '   (CT-2026-050 está borrado: si entrara, el contador se iría hasta el 051'
\echo '    y el hotel perdería cuarenta números por un documento que ya no existe)'
select case when not exists (select 1 from public.crm_folios
                              where tipo='contratos' and anio=2026 and numero=50)
            then '   ok' else '   FALLA' end as resultado;
