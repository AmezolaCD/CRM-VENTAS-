/* ===========================================================================
   PEDIR «TODO» NO ES RECIBIR TODO

   El servidor de datos tiene un tope de filas por respuesta —en Supabase se
   llama «Max rows» y estaba en 1000—. Cuando se pasa NO contesta un error:
   corta y contesta 200 tan tranquilo.

   `bajar()` pedía la tabla entera en una sola petición. Con 2252 filas en el
   servidor del hotel, un equipo que se enlazaba de cero recibía las
   actividades, parte de los clientes, y de ahí en adelante NADA: ni un
   convenio, ni un contrato, ni el catálogo de habitaciones, ni la lista de
   usuarios. Medido en el servidor, no deducido: `content-range: 0-999/*`
   aparecía varias veces al día.

   Y no se arreglaba solo: `nube.ultimo` se quedaba con la fecha más alta de
   esas mil filas y lo cortado, más viejo, no se volvía a pedir nunca.

   Lo que se afirma aquí:

   1. Con más filas que el tope, `bajar()` las trae TODAS.
   2. Llegan los tipos que antes se perdían enteros: convenios, contratos,
      usuarios.
   3. Los tramos se encadenan con el último id, no con un `offset` —que se
      salta renglones si alguien edita a media bajada—.
   4. Con un tope MÁS CHICO que el paso también las trae todas. Es el caso que
      rompe el atajo de «vinieron menos de las que pedí, ya acabé».
   5. En el día a día no se multiplican los viajes.
   6. La bajada incremental conserva el filtro de fecha en TODOS los tramos.
   7. Un servidor que contesta siempre el mismo tramo —un proxy de por medio, una
      configuración rara— no deja al CRM girando ni le mete filas repetidas.

   Cómo correrla:  node pruebas/navegador/bajar-todo-lo-que-hay.mjs
   Con APP_HTML se le apunta a otra copia del index.html, que es como se
   comprueba que esta prueba de verdad atrapa algo.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8897;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

/* El servidor de mentiras se porta como PostgREST: respeta `limit`, respeta
   `id=gt.`, y CORTA en `tope` sin avisar. */
let tope = 1000;
let atorado = false;           // contesta siempre lo mismo, para probar el freno
const pedidas = [];            // cada URL que llegó, para mirar cómo se pidió

/* 2300 filas repartidas como las del hotel: el corte en 1000 cae a media lista
   de clientes y deja fuera convenios, contratos y usuarios enteros. */
const TODAS = [];
const mete = (tipo, n) => {
  for (let i = 0; i < n; i++)
    TODAS.push({ id: `${tipo}:${String(i).padStart(5, '0')}`, tipo, borrado:false,
                 actualizado: new Date(Date.UTC(2026, 0, 1 + (i % 300))).toISOString(),
                 datos:{ id:String(i) } });
};
mete('actividades', 760);
mete('clientes',    243);
mete('contratos',    34);
mete('convenios',   236);
mete('serviciosBq', 902);
mete('usuarios',     25);
mete('zzz_ultimo',  100);
TODAS.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/rest/v1/crm_datos'){
    pedidas.push(req.url);
    let filas = TODAS;

    const desde = (u.searchParams.get('actualizado') || '').replace(/^gt\./, '');
    if (desde) filas = filas.filter(f => f.actualizado > desde);

    const trasId = (u.searchParams.get('id') || '').replace(/^gt\./, '');
    if (trasId && !atorado) filas = filas.filter(f => f.id > trasId);

    // El tope del servidor manda sobre el `limit` que pida el cliente.
    const pide = Number(u.searchParams.get('limit')) || filas.length;
    const corte = Math.min(pide, tope);
    const salen = filas.slice(0, corte);
    res.writeHead(200, Object.assign({
      'Content-Range': salen.length ? `0-${salen.length - 1}/*` : '*/*' }, cors));
    return res.end(JSON.stringify(salen));
  }
  res.writeHead(200, cors); res.end('[]');
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
const ctx = await br.newContext({ viewport:{ width:900, height:800 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof bajar === 'function', null, { timeout: 15000 });
await p.evaluate(url => {
  nube.url = url; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio' };
}, `http://127.0.0.1:${PUERTO}`);

/** Baja y devuelve lo que llegó, junto con cómo se pidió. */
const bajarYa = async desde => {
  pedidas.length = 0;
  const filas = await p.evaluate(d => bajar(d).then(f => f.map(x => x.id)), desde);
  return { ids: filas, urls: pedidas.slice() };
};

await bloque('1 · con más filas que el tope, llegan todas', async () => {
  tope = 1000; atorado = false;
  const r = await bajarYa();
  afirma(`llegan las ${TODAS.length} filas (llegaron ${r.ids.length})`,
    r.ids.length === TODAS.length);
  afirma('sin repetir ninguna', new Set(r.ids).size === r.ids.length);
  afirma('y hubo que pedirlas en varios tramos', r.urls.length > 1);
});

await bloque('2 · llegan los tipos que antes se perdían enteros', async () => {
  tope = 1000; atorado = false;
  const r = await bajarYa();
  const hay = t => r.ids.some(id => id.startsWith(t + ':'));
  const cuantos = t => r.ids.filter(id => id.startsWith(t + ':')).length;
  afirma(`los 236 convenios (llegaron ${cuantos('convenios')})`, cuantos('convenios') === 236);
  afirma(`los 34 contratos (llegaron ${cuantos('contratos')})`,  cuantos('contratos') === 34);
  afirma(`los 25 usuarios (llegaron ${cuantos('usuarios')})`,    cuantos('usuarios') === 25);
  afirma('y hasta lo último de la lista',                        hay('zzz_ultimo'));
});

await bloque('3 · los tramos se encadenan con el id, no con un offset', async () => {
  tope = 1000; atorado = false;
  const r = await bajarYa();
  afirma('ningún tramo usa offset',   !r.urls.some(u => /offset=/.test(u)));
  afirma('del segundo en adelante se pide «después de este id»',
    r.urls.slice(1).every(u => /[?&]id=gt\./.test(u)));
  afirma('y el primero no lo lleva',  !/[?&]id=gt\./.test(r.urls[0]));
});

await bloque('4 · con un tope MÁS CHICO que el paso, también llegan todas', async () => {
  /* El caso que rompe el atajo de «vinieron menos de las que pedí, ya acabé»:
     el servidor nunca va a devolver las 1000 que se le piden. */
  tope = 300; atorado = false;
  const r = await bajarYa();
  afirma(`llegan las ${TODAS.length} (llegaron ${r.ids.length})`, r.ids.length === TODAS.length);
  afirma('en los tramos que hagan falta', r.urls.length >= Math.ceil(TODAS.length / 300));
  tope = 1000;
});

await bloque('5 · en el día a día no se multiplican los viajes', async () => {
  tope = 1000; atorado = false;
  // Una bajada incremental de todos los días: pocas filas y ya.
  const r = await bajarYa('2026-12-31T00:00:00.000Z');   // no hay nada más nuevo
  afirma('no llegó nada, que es lo correcto', r.ids.length === 0);
  afirma('y costó una sola petición', r.urls.length === 1);
});

await bloque('6 · la bajada incremental conserva el filtro en todos los tramos', async () => {
  tope = 400; atorado = false;
  const desde = '2026-01-01T00:00:00.000Z';
  const r = await bajarYa(desde);
  afirma('se pidieron varios tramos', r.urls.length > 1);
  afirma('TODOS llevan el filtro de fecha',
    r.urls.every(u => /actualizado=gt\./.test(u)));
  const esperadas = TODAS.filter(f => f.actualizado > desde).length;
  afirma(`y llegan las ${esperadas} que son (llegaron ${r.ids.length})`,
    r.ids.length === esperadas);
  tope = 1000;
});

await bloque('7 · un servidor que no avanza no deja al CRM girando', async () => {
  /* Contesta siempre el mismo tramo, ignorando «después de este id» —pasa con un
     proxy de por medio o con un servidor mal configurado—. Sin protección esto
     da las doscientas vueltas del freno y devuelve las mismas filas repetidas
     doscientas veces. */
  tope = 1000; atorado = true;
  const r = await Promise.race([
    bajarYa().then(x => x),
    new Promise(r => setTimeout(() => r(null), 60000))
  ]);
  afirma('la bajada termina en vez de colgarse', !!r);
  if (!r) return;
  afirma(`se corta en cuanto no avanza, sin dar 200 vueltas (dio ${r.urls.length})`,
    r.urls.length <= 3);
  afirma('y NO devuelve filas repetidas', new Set(r.ids).size === r.ids.length);
  atorado = false;
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
