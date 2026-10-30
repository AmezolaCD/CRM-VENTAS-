/* ===========================================================================
   UN FOLIO NO SE PUEDE PERDER SIN QUE NADIE SE ENTERE

   Marco: «tengo un solo contrato con 3 números de folio distintos —027, 029 y
   030— y en el CRM sólo aparece el 029; los otros dos se los saltó».

   De dónde salía eso. Cuando dos equipos toman el mismo folio —cada quien
   cuenta con lo que tiene bajado, y con los papeles puestos eso es un pedazo
   del hotel—, `resolverFoliosRepetidos()` renumera al más nuevo en la
   siguiente sincronización. Hacía dos cosas mal, y juntas no arreglaban el
   choque: lo convertían en una rueda.

     · EL NÚMERO NUEVO SE LO INVENTABA. `serie.libre(d)` es «máximo + 1» sobre
       lo que ese equipo alcanza a ver. No le preguntaba al contador.

     · Y NO SE LO AVISABA A NADIE. Ni un `anotarFolio` en toda la función. El
       contador del servidor no se enteraba de que ese número ya estaba
       gastado, se lo repartía al siguiente que firmara, volvían a chocar, y
       se volvía a renumerar. 027 → 029 → 030.

   Lo que se cuida aquí:

   · que el número nuevo SALGA DEL CONTADOR del hotel, no de contar en casa;
   · que después de renumerar el contador YA NO vuelva a repartir ese número
     —la rueda— y que una segunda vuelta no renumere otra vez;
   · que sin contador NO SE INVENTE nada: se marca como repetido y lo decide
     una persona;
   · que un folio que vino del contador no se renumere nunca, porque el
     adivinado es siempre el otro;
   · que el libro de folios enseñe un número que ningún documento trae;
   · que se pueda buscar un contrato por su folio;
   · y los grupos de control: dos borradores que de verdad chocan y nunca
     salieron se SIGUEN renumerando solos, y uno emitido, enviado o reabierto
     sigue sin renumerarse. Lo que cambia es de dónde sale el número.

   Cómo correrla:  node pruebas/navegador/los-folios-no-se-pierden.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del arreglo tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público y aquí no entra el
   nombre de ningún cliente de verdad.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8877;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ANIO   = new Date().getFullYear();

/* --------------------------------------------------------------------------
   El contador del hotel, de mentiras pero con su regla: reparte de uno en uno
   y NUNCA repite. Es justo lo que el CRM daba por hecho sin usarlo.
   -------------------------------------------------------------------------- */
const servidor = { libro: [], vivo: true, apartados: 0 };
const numeroDe = f => Number(String(f).split('-').pop());

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  const manda = (c, b) => { res.writeHead(c, cors); res.end(JSON.stringify(b)); };
  if (req.method === 'OPTIONS') return manda(200, {});

  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }

  if (u.pathname === '/rest/v1/rpc/crm_aparta_folio'){
    let cuerpo = '';
    req.on('data', d => cuerpo += d);
    return req.on('end', () => {
      if (!servidor.vivo) return manda(500, { message:'el contador no contesta' });
      const p = JSON.parse(cuerpo || '{}');
      const suyos = servidor.libro.filter(x => x.tipo === p.p_tipo && x.anio === p.p_anio);
      const n = suyos.reduce((m, x) => Math.max(m, x.numero), 0) + 1;
      const folio = `${p.p_prefijo}-${p.p_anio}-${String(n).padStart(3, '0')}`;
      servidor.libro.push({ tipo:p.p_tipo, anio:p.p_anio, numero:n, folio,
                            quien:p.p_quien || '', creado:new Date().toISOString() });
      servidor.apartados++;
      manda(200, folio);
    });
  }
  if (u.pathname === '/rest/v1/rpc/crm_anota_folio'){
    let cuerpo = '';
    req.on('data', d => cuerpo += d);
    return req.on('end', () => {
      const p = JSON.parse(cuerpo || '{}');
      if (!servidor.libro.some(x => x.tipo === p.p_tipo && x.anio === p.p_anio &&
                                    x.numero === p.p_numero))
        servidor.libro.push({ tipo:p.p_tipo, anio:p.p_anio, numero:p.p_numero,
                              folio:p.p_folio, quien:p.p_quien || '',
                              creado:new Date().toISOString() });
      manda(200, null);
    });
  }
  if (u.pathname === '/rest/v1/crm_folios'){
    const anio = Number((u.searchParams.get('anio') || '').replace(/^eq\./, '')) || ANIO;
    return manda(200, servidor.libro.filter(x => x.anio === anio));
  }
  if (u.pathname === '/rest/v1/crm_datos'){
    if (req.method === 'GET') return manda(200, []);
    return manda(201, {});
  }
  if (u.pathname.startsWith('/rest/v1/crm_')) return manda(200, []);
  manda(200, []);
});
await new Promise(r => srv.listen(PUERTO, '127.0.0.1', r));

let fallas = 0;
const afirma = (q, bien) => {
  console.log((bien ? '  ok    ' : '  FALLA ') + q);
  if (!bien) fallas++;
};
async function bloque(titulo, fn){
  console.log('\n' + titulo);
  try{ await fn(); }
  catch(ex){ console.log('  FALLA se cayó: ' + String(ex.message).split('\n')[0]); fallas++; }
}

const br = await chromium.launch({ executablePath: CHROME });

/* Pestaña nueva por bloque: el CRM se sincroniza solo cada tanto y una vuelta
   de fondo del bloque anterior mediría lo que no es. */
let ctx, p;
async function equipo(docs, comoAdmin = true){
  if (ctx) await ctx.close().catch(() => {});
  ctx = await br.newContext();
  p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app`);
  await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
  await p.evaluate(({ d, admin }) => {
    nube.url = location.origin;
    nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio', user:{ email:'quien@ejemplo.example' } };
    nube.ultimo = ''; nube.sinDuenio = false; nube.rechazados = []; nube.sinFolios = false;
    state.usuarios = [saneaUsuario({ id:'u1', correo:'quien@ejemplo.example',
      nombre:'Quien Sea', rol: admin ? 'admin' : 'ejecutivo' })];
    state.clientes  = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
                                      ejecutivo:'Quien Sea', estatus:'nuevo' })];
    state.contratos = (d || []).map(saneaContrato);
    guardar();
  }, { d: docs, admin: comoAdmin });
}

const folios = () => p.evaluate(() => state.contratos.map(k => ({
  id:k.id, folio:k.folio, repetido:k.folioRepetido || '',
  delContador: !!k.folioDelContador })));

/** Dos borradores con el MISMO folio, como los deja un choque de verdad. */
const choque = (folio, extraB = {}) => ([
  { id:'kA', folio, tipo:'cotizacion', clienteId:'c1', estado:'borrador',
    createdAt:'2026-10-01T10:00:00Z', fecha:`${ANIO}-10-01` },
  Object.assign({ id:'kB', folio, tipo:'cotizacion', clienteId:'c1', estado:'borrador',
    createdAt:'2026-10-02T10:00:00Z', fecha:`${ANIO}-10-02` }, extraB)
]);

/* --- 1 ---------------------------------------------------------------------
   EL CASO DE MARCO, primera mitad: el número nuevo sale del contador. */
await bloque('1 · al renumerar, el número lo da el contador del hotel', async () => {
  servidor.libro = [
    { tipo:'contratos', anio:ANIO, numero:27, folio:`CT-${ANIO}-027`, quien:'Carmen',
      creado:'2026-10-01T10:00:00Z' }];
  servidor.vivo = true; servidor.apartados = 0;
  await equipo(choque(`CT-${ANIO}-027`));

  await p.evaluate(() => resolverFoliosRepetidos());
  const [a, b] = await folios();

  afirma('el más viejo conserva su folio', a.folio === `CT-${ANIO}-027`);
  afirma('al otro SE LE PIDIÓ NÚMERO AL CONTADOR', servidor.apartados === 1);
  afirma('y se lo quedó', b.folio === `CT-${ANIO}-028`);
  afirma('queda apuntado que ese número vino del contador', b.delContador === true);
  afirma('y ya no está marcado como repetido', !b.repetido);
});

/* --- 2 ---------------------------------------------------------------------
   LA RUEDA. Es la prueba que de verdad importa: el número renumerado tiene
   que quedar GASTADO en el contador, o la siguiente firma lo vuelve a sacar. */
await bloque('2 · el número renumerado queda gastado: la rueda se detiene', async () => {
  servidor.libro = [
    { tipo:'contratos', anio:ANIO, numero:27, folio:`CT-${ANIO}-027`, quien:'Carmen',
      creado:'2026-10-01T10:00:00Z' }];
  servidor.vivo = true; servidor.apartados = 0;
  await equipo(choque(`CT-${ANIO}-027`));
  await p.evaluate(() => resolverFoliosRepetidos());
  const despues = (await folios())[1].folio;

  // El siguiente que firme en el hotel: NO le puede tocar el mismo número.
  const delSiguiente = await p.evaluate(() => apartarFolio('contratos', 'CT',
    new Date().getFullYear()));
  afirma('EL CONTADOR YA NO REPARTE EL NÚMERO RENUMERADO', delSiguiente !== despues);
  afirma('le toca el siguiente, sin huecos', numeroDe(delSiguiente) === numeroDe(despues) + 1);

  // Y una segunda vuelta de sincronización no vuelve a mover nada.
  const otra = await p.evaluate(() => resolverFoliosRepetidos());
  afirma('UNA SEGUNDA VUELTA YA NO RENUMERA NADA', otra === false);
  afirma('el folio se quedó quieto', (await folios())[1].folio === despues);
});

/* --- 3 ---------------------------------------------------------------------
   Sin contador no se inventa. Inventar es lo que arrancó la rueda. */
await bloque('3 · si el contador no contesta, NO se inventa un número', async () => {
  servidor.libro = []; servidor.vivo = false; servidor.apartados = 0;
  await equipo(choque(`CT-${ANIO}-027`));

  await p.evaluate(() => resolverFoliosRepetidos());
  const [, b] = await folios();
  afirma('EL FOLIO NO SE TOCÓ', b.folio === `CT-${ANIO}-027`);
  afirma('y queda marcado como repetido, para que lo vea una persona',
    b.repetido === `CT-${ANIO}-027`);
  afirma('no se lo apuntó como si viniera del contador', b.delContador === false);
});

/* --- 4 ---------------------------------------------------------------------
   Un folio del contador es único por construcción: el adivinado es el otro. */
await bloque('4 · un folio que vino del contador no se renumera', async () => {
  servidor.libro = []; servidor.vivo = true; servidor.apartados = 0;
  /* El MÁS VIEJO es el adivinado y el más nuevo trae el del contador. Por
     antigüedad le tocaría perder al bueno; por procedencia, no. */
  await equipo([
    { id:'kA', folio:`CT-${ANIO}-027`, tipo:'cotizacion', clienteId:'c1', estado:'borrador',
      createdAt:'2026-10-01T10:00:00Z', fecha:`${ANIO}-10-01` },
    { id:'kB', folio:`CT-${ANIO}-027`, tipo:'cotizacion', clienteId:'c1', estado:'borrador',
      createdAt:'2026-10-02T10:00:00Z', fecha:`${ANIO}-10-02`, folioDelContador:true }
  ]);

  await p.evaluate(() => resolverFoliosRepetidos());
  const ks = await folios();
  const bueno = ks.find(k => k.id === 'kB'), adivinado = ks.find(k => k.id === 'kA');
  afirma('EL DEL CONTADOR CONSERVA SU NÚMERO', bueno.folio === `CT-${ANIO}-027`);
  afirma('y el adivinado es el que se mueve', adivinado.folio !== `CT-${ANIO}-027`);
});

/* --- 5 ---------------------------------------------------------------------
   GRUPO DE CONTROL. La regla de a quién se le puede tocar el folio no cambia. */
await bloque('5 · lo que ya salió sigue sin renumerarse solo', async () => {
  for (const [comoEs, extra] of [
        ['ya emitido',  { estado:'firmado_hotel' }],
        /* La forma que pide `saneaEnvio`: {fecha, via}. Con otras llaves el
           envío se anula y la prueba mediría otra cosa. */
        ['ya enviado',  { enviado:{ fecha:'2026-10-02T10:00:00Z', via:'correo',
                                    quien:'Quien Sea' } }],
        ['reabierto para corregir', { yaSalio:true }]]){
    servidor.libro = []; servidor.vivo = true; servidor.apartados = 0;
    await equipo(choque(`CT-${ANIO}-027`, extra));
    await p.evaluate(() => resolverFoliosRepetidos());
    const [, b] = await folios();
    afirma(`${comoEs}: conserva su folio`, b.folio === `CT-${ANIO}-027`);
    afirma(`${comoEs}: y no se gastó un número del contador`, servidor.apartados === 0);
  }
});

/* --- 6 ---------------------------------------------------------------------
   GRUPO DE CONTROL. Lo que SÍ se renumeraba solo, se sigue renumerando solo. */
await bloque('6 · dos borradores que nunca salieron sí se arreglan solos', async () => {
  servidor.libro = []; servidor.vivo = true; servidor.apartados = 0;
  await equipo(choque(`CT-${ANIO}-027`));
  const hubo = await p.evaluate(() => resolverFoliosRepetidos());
  const [a, b] = await folios();
  afirma('la sincronización dice que hubo cambio', hubo === true);
  afirma('quedan con folios distintos', a.folio !== b.folio);
  afirma('y ninguno quedó marcado como repetido', !a.repetido && !b.repetido);
});

/* --- 7 ---------------------------------------------------------------------
   El libro de folios: el número que ningún documento trae. */
await bloque('7 · el libro de folios enseña el número que nadie usa', async () => {
  servidor.libro = [
    { tipo:'contratos', anio:ANIO, numero:27, folio:`CT-${ANIO}-027`, quien:'Carmen',
      creado:'2026-10-28T18:00:00Z' },
    { tipo:'contratos', anio:ANIO, numero:29, folio:`CT-${ANIO}-029`, quien:'Carmen',
      creado:'2026-10-28T19:00:00Z' }];
  servidor.vivo = true;
  await equipo([{ id:'kA', folio:`CT-${ANIO}-029`, tipo:'contrato', clienteId:'c1',
                  estado:'firmado_hotel', fecha:`${ANIO}-10-28` }]);

  await p.evaluate(() => libroDeFolios());
  await p.locator('.overlay .modal-body').waitFor({ timeout:10000 });
  const txt = await p.locator('.overlay .modal-body').innerText();

  afirma('sale el folio que sí tiene documento', txt.includes(`CT-${ANIO}-029`));
  afirma('Y EL QUE NO LO TIENE', txt.includes(`CT-${ANIO}-027`));
  afirma('y lo dice con todas sus letras', /ning[úu]n documento lo trae/i.test(txt));
  afirma('dice quién lo pidió', /Carmen/.test(txt));
  afirma('y los cuenta arriba', /no traen? ning[úu]n documento|no trae ning[úu]n documento/i.test(txt));
});

/* --- 8 ---------------------------------------------------------------------
   Y a quien no lo ve todo, no se le dice una mentira. */
await bloque('8 · a quien no ve toda la cartera no se le dice «nadie lo usa»', async () => {
  servidor.libro = [
    { tipo:'contratos', anio:ANIO, numero:27, folio:`CT-${ANIO}-027`, quien:'Carmen',
      creado:'2026-10-28T18:00:00Z' }];
  servidor.vivo = true;
  await equipo([], false);          // ejecutivo, no administrador

  await p.evaluate(() => libroDeFolios());
  await p.locator('.overlay .modal-body').waitFor({ timeout:10000 });
  const txt = await p.locator('.overlay .modal-body').innerText();
  afirma('lo acota a lo que su equipo alcanza a ver', /de los que ves/i.test(txt));
  afirma('y lo explica aparte', /otra persona/i.test(txt));
});

/* --- 9 ---------------------------------------------------------------------
   Buscar un contrato por el folio que trae impreso el papel. */
await bloque('9 · se puede buscar un contrato por su folio', async () => {
  servidor.libro = []; servidor.vivo = true;
  await equipo([
    { id:'kA', folio:`CT-${ANIO}-027`, tipo:'contrato', clienteId:'c1',
      estado:'firmado_hotel', fecha:`${ANIO}-10-01` },
    { id:'kB', folio:`CT-${ANIO}-029`, tipo:'contrato', clienteId:'c1',
      estado:'firmado_hotel', fecha:`${ANIO}-10-02` }]);

  const sale = await p.evaluate(folio => {
    filtros.q = folio; vista = 'contratos'; render();
    return document.getElementById('tblContratos').innerText;
  }, `CT-${ANIO}-029`);
  afirma('ENCUENTRA EL QUE SE BUSCA', sale.includes(`CT-${ANIO}-029`));
  afirma('y deja fuera al otro', !sale.includes(`CT-${ANIO}-027`));

  const nada = await p.evaluate(() => {
    filtros.q = 'CT-1999-001'; render();
    return document.getElementById('tblContratos').innerText;
  });
  afirma('y si no está, dice dónde más buscarlo', /libro de folios/i.test(nada));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
