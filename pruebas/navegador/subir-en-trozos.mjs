/* ===========================================================================
   LA SUBIDA SE PARTE EN TROZOS, Y UN TIMEOUT NO LA MATA

   Marco, cinco rondas buscando por qué los datos bancarios no le llegaban a
   Carmen. El botón de diagnóstico acabó contestando lo que nadie esperaba:

       No se pudo sincronizar. 500 · canceling statement due to statement timeout

   No era que los ajustes no subieran: ERA QUE NO SUBÍA NADA. Y la causa son
   dos cosas que se juntan:

   · `sincronizado` —el mapa de «esto ya está en el servidor»— vive en memoria
     y al recargar la página queda VACÍO. Así que el CRM daba por no subido
     todo lo que tiene y mandaba la base entera en una sola petición.

   · PostgREST ejecuta ese lote como UN SOLO statement y Supabase lo corta a
     los ocho segundos. Y como un timeout no se parece a «un renglón malo»,
     `mandarLote` ni siquiera lo partía: lo dejaba salir como error fatal. La
     siguiente vuelta hacía exactamente lo mismo. Para siempre.

   Lo que se cuida aquí:

   · que NINGUNA petición lleve el montón entero;
   · que si el servidor contesta «statement timeout», se parta y se reintente
     en vez de rendirse — y que al final TODO acabe arriba;
   · que un renglón de verdad rechazado se siga reportando uno por uno, sin
     llevarse a los demás;
   · y el contrapeso: que un error que NO se arregla partiendo —la sesión
     caducada— siga saliendo como lo que es, sin convertirse en N peticiones
     fallidas.

   Cómo correrla:  node pruebas/navegador/subir-en-trozos.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del arreglo tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8866;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* --------------------------------------------------------------------------
   El servidor de mentiras, con el genio de Supabase: si el lote trae más de
   `topeDelServidor` renglones, contesta lo mismo que contestó de verdad.
   -------------------------------------------------------------------------- */
const tabla = new Map();
let reloj = 0;
const sello = () => new Date(Date.UTC(2026, 9, 29, 12, 0, reloj++)).toISOString();

const servidor = {
  topeDelServidor: Infinity,   // más de esto → «statement timeout»
  idQueRebota: null,           // un renglón que viola una regla de fila
  estado: 0,                   // un código fijo que devolver (sesión caducada)
  peticiones: [],              // cuántos renglones llevó cada POST
};

const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  const manda = (c, b) => { res.writeHead(c, cors); res.end(JSON.stringify(b)); };
  if (req.method === 'OPTIONS') return manda(200, {});

  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }

  if (u.pathname === '/rest/v1/crm_datos'){
    if (req.method === 'GET'){
      const desde = (u.searchParams.get('actualizado') || '').replace(/^gt\./, '');
      let filas = [...tabla.values()];
      if (desde) filas = filas.filter(f => f.actualizado > desde);
      filas.sort((a, b) => a.id < b.id ? -1 : 1);
      return manda(200, filas);
    }
    if (req.method === 'POST'){
      let cuerpo = '';
      req.on('data', d => cuerpo += d);
      return req.on('end', () => {
        let lote;
        try{ lote = JSON.parse(cuerpo || '[]'); }catch(e){ return manda(400, { message:'json' }); }
        servidor.peticiones.push(lote.length);

        if (servidor.estado)
          return manda(servidor.estado, { message:'JWT expired' });

        /* Lo que de verdad contesta Supabase cuando el statement se pasa del
           tiempo. Es un 500, no un 4xx: por eso no se parecía a un rechazo. */
        if (lote.length > servidor.topeDelServidor)
          return manda(500, { message:'canceling statement due to statement timeout' });

        if (servidor.idQueRebota && lote.some(f => f.id === servidor.idQueRebota))
          return manda(403, { message:'new row violates row-level security policy' });

        for (const f of lote){
          const antes = tabla.get(f.id) || {};
          tabla.set(f.id, Object.assign({}, antes, f, { actualizado: sello() }));
        }
        manda(201, {});
      });
    }
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

/* PESTAÑA NUEVA POR BLOQUE, y no es manía: el CRM se sincroniza solo cada
   tanto, y una vuelta de fondo del bloque anterior le subía su cartera al
   servidor en medio del siguiente —899 renglones en un bloque de 30—. Con su
   propia pestaña, cada bloque mide lo suyo. */
let p;
async function equipoNuevo(){
  if (p) await p.context().close().catch(() => {});
  const ctx = await br.newContext();
  p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app`);
  await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
}

/**
 * Deja el equipo con `cuantos` clientes por subir y nada dado por subido.
 *
 * Abre una pestaña limpia: ver `equipoNuevo`.
 */
const conCartera = async (cuantos) => {
  await equipoNuevo();
  return p.evaluate((n) => {
  nube.url = location.origin;
  nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio', user:{ email:'admin@ejemplo.example' } };
  nube.ultimo = '';
  nube.sinDuenio = false;
  nube.rechazados = [];
  state.clientes = [];
  for (let i = 1; i <= n; i++)
    state.clientes.push(saneaCliente({ id:'c' + i, empresa:'EMPRESA ' + i,
      ejecutivo:'Ana', estatus:'nuevo' }));
  guardar();
  /* Lo que pasa en cada recarga: el mapa de «ya subido» arranca vacío, así
     que TODO se ve como pendiente. Es el punto de partida del error. */
  sincronizado = new Map();
  return state.clientes.length;
  }, cuantos);
};

const sincronizar1 = () => p.evaluate(() => sincronizar().then(() => ({
  estado: nube.estado, error: nube.error || '',
  rechazados: (nube.rechazados || []).map(x => x.id)
})));

/* --- 1 ---------------------------------------------------------------------
   Lo que le pasó al hotel: muchos renglones y un servidor que corta. */
await bloque('1 · con el servidor cortando a los 250, la subida igual termina', async () => {
  tabla.clear(); servidor.peticiones = [];
  servidor.topeDelServidor = 250; servidor.idQueRebota = null; servidor.estado = 0;
  afirma('el equipo arranca con 600 por subir', await conCartera(600) === 600);

  const r = await sincronizar1();
  afirma('la sincronización NO quedó en error', r.estado !== 'error');
  afirma('SUBIERON LOS 600 CLIENTES',
    [...tabla.keys()].filter(k => k.startsWith('clientes:')).length === 600);
  afirma('y ninguna petición llevó el montón entero',
    servidor.peticiones.every(n => n <= 250));
  afirma('hicieron falta varias, no una', servidor.peticiones.length > 1);
  console.log('        (' + servidor.peticiones.length + ' peticiones, la mayor de ' +
    Math.max(...servidor.peticiones) + ' renglones)');
});

/* --- 2 ---------------------------------------------------------------------
   El tope del propio CRM, sin que el servidor diga nada. */
await bloque('2 · nunca manda un lote enorme, aunque el servidor lo aguante', async () => {
  tabla.clear(); servidor.peticiones = [];
  servidor.topeDelServidor = Infinity; servidor.idQueRebota = null; servidor.estado = 0;
  afirma('el equipo arranca con 900 por subir', await conCartera(900) === 900);

  await sincronizar1();
  afirma('subieron los 900',
    [...tabla.keys()].filter(k => k.startsWith('clientes:')).length === 900);
  afirma('NINGUNA PETICIÓN PASÓ DE 200 RENGLONES',
    servidor.peticiones.every(n => n <= 200));
});

/* --- 3 ---------------------------------------------------------------------
   El grupo de control de siempre: un renglón malo se reporta solo, no se
   lleva a los demás por delante. */
await bloque('3 · un renglón rechazado se reporta, y el resto sí sube', async () => {
  tabla.clear(); servidor.peticiones = [];
  servidor.topeDelServidor = Infinity; servidor.estado = 0;
  servidor.idQueRebota = 'clientes:c7';
  afirma('el equipo arranca con 30 por subir', await conCartera(30) === 30);

  const r = await sincronizar1();
  afirma('el renglón malo queda apuntado con su id', r.rechazados.includes('clientes:c7'));
  afirma('Y LOS OTROS 29 SUBEN IGUAL',
    [...tabla.keys()].filter(k => k.startsWith('clientes:')).length === 29);
  afirma('el malo no está en el servidor', !tabla.has('clientes:c7'));
});

/* --- 4 ---------------------------------------------------------------------
   EL CONTRAPESO. Partir sólo sirve para lo que se arregla partiendo. Una
   sesión caducada no: partir haría N peticiones para fallar N veces. */
await bloque('4 · la sesión caducada no se parte en mil intentos', async () => {
  tabla.clear(); servidor.peticiones = [];
  servidor.topeDelServidor = Infinity; servidor.idQueRebota = null;
  servidor.estado = 401;
  afirma('el equipo arranca con 400 por subir', await conCartera(400) === 400);

  const r = await sincronizar1();
  afirma('la sincronización lo reporta como error', r.estado === 'error');
  afirma('Y NO SE CONVIRTIÓ EN UNA PETICIÓN POR RENGLÓN',
    servidor.peticiones.length < 10);
  console.log('        (' + servidor.peticiones.length + ' peticiones, no 400)');
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
