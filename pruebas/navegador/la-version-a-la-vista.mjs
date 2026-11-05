/* ===========================================================================
   LA VERSIÓN, A LA VISTA DE TODOS · Y EL BOTÓN QUE ACTUALIZA

   Marco: «Carmen no puede saber en qué actualización está porque no lo
   muestra en ninguna pantalla y no tiene acceso a ajustes, y tarda mucho en
   actualizar de un equipo a otro».

   Las dos cosas son la misma. El número sólo salía en Ajustes, que un
   ejecutivo no abre. Y lo de «tarda mucho» no es la publicación ni el
   navegador guardando de más —las cabeceras ya piden revalidar—: es que LA
   PESTAÑA NO SE RECARGA. El CRM es la pantalla de trabajo del día; se deja
   abierta el lunes y se sigue usando el miércoles.

   Lo que se cuida aquí:

   · que la versión se vea sin entrar a Ajustes, y que diga la de verdad;
   · que el programa se entere solo de que hay una más nueva publicada;
   · que lo DIGA en vez de recargarle la página a alguien por su cuenta;
   · que el botón actualice de verdad —refrescando la copia guardada del
     navegador, o la recarga serviría otra vez la vieja—;
   · que si NO hay nada nuevo lo diga, en vez de hacer como que actualizó;
   · y que no le salga a quien no es del hotel: el cliente que viene a firmar
     no tiene por qué ver la versión del CRM.

   Cómo correrla:  node pruebas/navegador/la-version-a-la-vista.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del arreglo tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8869;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium';

/* El servidor de mentiras lleva una huella que se puede cambiar a mano: es
   justo lo que hace una publicación nueva. */
const servidor = { huella: 'W/"uno"', heads: 0, recargas: 0 };

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*' };
  if (u.pathname === '/app' || u.pathname === '/'){
    if (req.method === 'HEAD'){
      servidor.heads++;
      res.writeHead(200, Object.assign({ 'Content-Type':'text/html; charset=utf-8',
        'ETag': servidor.huella }, cors));
      return res.end();
    }
    if (String(req.headers['cache-control'] || '').includes('no-cache')) servidor.recargas++;
    res.writeHead(200, Object.assign({ 'Content-Type':'text/html; charset=utf-8',
      'ETag': servidor.huella }, cors));
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  res.writeHead(200, Object.assign({ 'Content-Type':'application/json' }, cors));
  res.end('[]');
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
/** La versión que de verdad trae el archivo, para no afirmar contra un número escrito a mano. */
const VERSION_REAL = (fs.readFileSync(APP, 'utf8')
  .match(/const VERSION = "([^"]+)"/) || [])[1] || '';

let ctx, p;
async function abrir(hash = ''){
  if (ctx) await ctx.close().catch(() => {});
  ctx = await br.newContext();
  p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app` + hash);
  await p.waitForFunction(() => typeof pintarVersion === 'function', null, { timeout:15000 });
  await p.waitForTimeout(500);
}

const chip = () => p.locator('#versionCore');

/* --- 1 ---------------------------------------------------------------------
   Lo que Carmen no podía saber. */
await bloque('1 · la versión se ve sin entrar a Ajustes', async () => {
  servidor.huella = 'W/"uno"';
  await abrir();
  afirma('el número está en la pantalla', await chip().isVisible());
  const txt = await chip().innerText();
  afirma('y es la versión de verdad del archivo', !!VERSION_REAL && txt.includes(VERSION_REAL));
  console.log('        dice: ' + txt);
});

/* --- 2 ---------------------------------------------------------------------
   Lo de «tarda mucho en actualizar de un equipo a otro»: la pestaña lleva
   horas abierta y nadie le ha dicho que ya hay otra versión. */
await bloque('2 · se entera solo de que hay una versión nueva publicada', async () => {
  servidor.huella = 'W/"uno"';
  await abrir();
  afirma('al abrir no dice nada', !/versi[oó]n nueva/i.test(await chip().innerText()));

  servidor.huella = 'W/"dos"';            // se publicó algo
  await p.evaluate(() => mirarSiHayVersionNueva());
  await p.waitForTimeout(300);

  const txt = await chip().innerText();
  afirma('AHORA LO DICE', /versi[oó]n nueva/i.test(txt));
  afirma('y se nota, no pasa desapercibido',
    (await chip().getAttribute('class') || '').includes('warn'));
  afirma('PERO NO RECARGÓ LA PÁGINA SOLA',
    await p.evaluate(() => typeof pintarVersion === 'function'));
});

/* --- 3 ---------------------------------------------------------------------
   El botón que pidió Marco: que fuerce la actualización. */
await bloque('3 · el botón actualiza de verdad', async () => {
  servidor.huella = 'W/"uno"';
  await abrir();
  servidor.huella = 'W/"tres"';
  servidor.recargas = 0;

  await chip().click();
  await p.waitForFunction(() => typeof pintarVersion === 'function', null, { timeout:15000 });
  await p.waitForTimeout(400);

  afirma('PIDIÓ EL ARCHIVO SALTÁNDOSE LA COPIA GUARDADA', servidor.recargas >= 1);
  afirma('y la pantalla volvió a quedar lista', await chip().isVisible());
  afirma('ya no dice que hay versión nueva',
    !/versi[oó]n nueva/i.test(await chip().innerText()));
});

/* --- 4 ---------------------------------------------------------------------
   GRUPO DE CONTROL. Si no hay nada nuevo, que lo diga en vez de hacer como
   que actualizó: si no, nadie vuelve a creerle al botón. */
await bloque('4 · sin nada nuevo, lo dice y no recarga', async () => {
  servidor.huella = 'W/"uno"';
  await abrir();
  servidor.recargas = 0;
  let dijo = '';
  p.once('dialog', d => { dijo = d.message(); d.accept(); });

  await chip().click();
  await p.waitForTimeout(800);

  afirma('AVISA QUE YA ESTÁ AL DÍA', /m[aá]s nueva/i.test(dijo));
  afirma('y dice cuál es', !!VERSION_REAL && dijo.includes(VERSION_REAL));
  afirma('no recargó por gusto', servidor.recargas === 0);
});

/* --- 5 ---------------------------------------------------------------------
   GRUPO DE CONTROL. Esto es del hotel, no del cliente. */
await bloque('5 · al cliente que viene a firmar no se le enseña', async () => {
  servidor.huella = 'W/"uno"';
  const liga = Buffer.from(JSON.stringify({ v:'v1', d:'convenios', t:'clave',
      u:'http://127.0.0.1:' + PUERTO, k:'llave-de-mentiras' }))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await abrir('#firmar=' + liga);
  afirma('NO SE LE VE', !(await chip().isVisible()));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
