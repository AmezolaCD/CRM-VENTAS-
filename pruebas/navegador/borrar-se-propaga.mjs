/* ===========================================================================
   BORRAR UN CLIENTE TIENE QUE BORRARLO PARA TODOS — Y QUE NO VUELVA

   Marco borró un cliente y pasaron las dos cosas que no debían pasar: en los
   demás equipos el cliente siguió ahí, y al rato volvió a aparecer también en
   el suyo.

   Las dos salían del mismo renglón. Un borrado viaja como LÁPIDA —la fila
   sigue en el servidor, marcada `borrado`— y al bajarla el CRM la trataba como
   un conflicto más: «si aquí hay una edición sin subir, no la pises». Pero
   `sincronizado` es un Map en memoria que arranca vacío en cada recarga, así
   que TODO lo que ya estaba parecía recién editado. La lápida se saltaba
   siempre, y el renglón —al verse como edición pendiente— se volvía a subir
   con `borrado:false`, resucitando al cliente para todo el mundo.

   Esta prueba levanta un servidor de mentiras y DOS equipos de verdad —dos
   pestañas con su propio almacenamiento— y hace el recorrido completo.

   Cómo correrla:  node pruebas/navegador/borrar-se-propaga.mjs
   Con APP_HTML se le apunta a otra copia del index.html, que es como se
   comprueba que de verdad atrapa algo: contra la versión anterior tiene que
   ponerse roja.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8799;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* --------------------------------------------------------------------------
   El servidor de mentiras: una tabla crm_datos en memoria.
   -------------------------------------------------------------------------- */
const tabla = new Map();                       // id -> fila
let reloj = 0;
const sello = () => new Date(Date.UTC(2026, 9, 6, 12, 0, reloj++)).toISOString();

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
        for (const f of lote){
          // merge-duplicates: las columnas que NO vienen se quedan como estaban.
          const antes = tabla.get(f.id) || {};
          tabla.set(f.id, Object.assign({}, antes, f, { actualizado: sello() }));
        }
        manda(201, {});
      });
    }
  }

  // Los buzones (firmas, altas, whatsapp, odts) no son de esta prueba.
  if (u.pathname.startsWith('/rest/v1/crm_')) return manda(200, []);
  manda(200, []);
});
await new Promise(r => srv.listen(PUERTO, '127.0.0.1', r));

let fallas = 0;
const afirma = (q, bien) => {
  console.log((bien ? '  ok    ' : '  FALLA ') + q);
  if (!bien) fallas++;
};

const br = await chromium.launch({ executablePath: CHROME });

/** Un equipo: su propia pestaña, su propio almacenamiento. */
async function equipo(nombre, correo){
  const ctx = await br.newContext();            // almacenamiento aparte
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA (' + nombre + ') ' + e.message); fallas++; });
  const abrir = async () => {
    await p.goto(`http://127.0.0.1:${PUERTO}/app`);
    await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
    await p.evaluate(([u, c]) => {
      nube.url = u; nube.anon = 'llave-de-mentiras';
      nube.sesion = { access_token:'ficticio', user:{ email:c } };
      nube.ultimo = "";
    }, [`http://127.0.0.1:${PUERTO}`, correo]);
  };
  await abrir();
  return {
    p, abrir,
    sincronizar: () => p.evaluate(() => sincronizar()),
    clientes: () => p.evaluate(() => state.clientes.map(c => c.id + ':' + c.nombre)),
  };
}

/** Cómo está ese cliente del lado del servidor. */
const enServidor = () => [...tabla.values()].find(f => f.id === 'clientes:cPrueba');

const A = await equipo('A', 'ana@ejemplo.example');
const B = await equipo('B', 'beto@ejemplo.example');

console.log('\n1 · el equipo A da de alta un cliente y lo sube');
await A.p.evaluate(() => {
  state.clientes.push(saneaCliente({ id:'cPrueba', nombre:'CLIENTE DE PRUEBA',
    ejecutivo:'Ana', estatus:'nuevo' }));
  guardar();
});
await A.sincronizar();
afirma('A lo tiene', (await A.clientes()).some(c => c.startsWith('cPrueba')));
afirma('y el servidor también, sin marca de borrado',
  !!enServidor() && enServidor().borrado === false);

console.log('\n2 · el equipo B lo recibe');
await B.sincronizar();
afirma('a B le llegó el cliente', (await B.clientes()).some(c => c.startsWith('cPrueba')));

console.log('\n3 · B recarga — aquí es donde se rompía');
/* La recarga vacía `sincronizado`, y con él la única manera que tenía el CRM
   de distinguir «esto ya estaba sincronizado» de «esto lo acabo de editar».
   Sin este paso la prueba pasaría con el error dentro. */
await B.abrir();
afirma('B sigue teniendo el cliente después de recargar',
  (await B.clientes()).some(c => c.startsWith('cPrueba')));

console.log('\n4 · A lo borra');
await A.p.evaluate(() => {
  state.clientes = state.clientes.filter(c => c.id !== 'cPrueba');
  guardar();
});
await A.sincronizar();
afirma('la lápida llegó al servidor', !!enServidor() && enServidor().borrado === true);
afirma('y A ya no lo tiene', !(await A.clientes()).some(c => c.startsWith('cPrueba')));

console.log('\n5 · B sincroniza: el borrado tiene que llegarle');
await B.sincronizar();
afirma('a B se le fue el cliente', !(await B.clientes()).some(c => c.startsWith('cPrueba')));

console.log('\n6 · y no vuelve a aparecer');
await B.sincronizar();
await A.sincronizar();
await B.sincronizar();
afirma('el servidor lo sigue dando por borrado',
  !!enServidor() && enServidor().borrado === true);
afirma('B no lo resucitó',  !(await B.clientes()).some(c => c.startsWith('cPrueba')));
afirma('A tampoco lo vio volver', !(await A.clientes()).some(c => c.startsWith('cPrueba')));

console.log('\n7 · y lo que NO se borró sigue viajando igual');
await A.p.evaluate(() => {
  state.clientes.push(saneaCliente({ id:'cVivo', nombre:'CLIENTE QUE SE QUEDA',
    ejecutivo:'Ana', estatus:'nuevo' }));
  guardar();
});
await A.sincronizar();
await B.sincronizar();
afirma('un alta posterior sí le llega a B',
  (await B.clientes()).some(c => c.startsWith('cVivo')));
afirma('y el borrado no se deshizo de rebote',
  !(await B.clientes()).some(c => c.startsWith('cPrueba')));

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
