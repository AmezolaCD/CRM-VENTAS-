/* ===========================================================================
   LO QUE SE ESCRIBE NO SE PIERDE

   «no se guarda cuando lleno lo de quien firma el certificado», dijo Marco.

   Y no era el campo. Al aplicar lo que baja, la sincronización REEMPLAZA el
   estado (`state = estadoDesdeFilas(...)`). La pantalla de Ajustes se dibuja
   una vez y NO se vuelve a dibujar mientras alguien la está llenando —eso es
   a propósito, si no se le borraría lo escrito—, así que se queda con las
   referencias del estado de antes. Entonces el botón de Guardar escribía en
   un objeto que ya nadie miraba: la pantalla decía «Guardado ✓» y no se
   guardaba nada.

   El peligro ya se cuidaba, pero preguntando por `.overlay`, o sea sólo por
   las ventanas. **Ajustes no es una ventana: es una pantalla entera**, y por
   ahí se colaba. Le pasaba a todo lo de esa pantalla —los datos del hotel, la
   lista de usuarios, el catálogo—, no nada más a quién firma.

   Esta prueba levanta un servidor de mentiras y DOS equipos de verdad. El
   segundo mueve algo para que el primero tenga qué bajar, y al primero se le
   exige que lo que teclee sobreviva.

   Cómo correrla:  node pruebas/navegador/no-se-pierde-lo-escrito.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión
   anterior tiene que ponerse roja.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8806;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* ----- El servidor de mentiras: una tabla crm_datos en memoria ----- */
const tabla = new Map();
let reloj = 0;
const sello = () => new Date(Date.UTC(2026, 9, 6, 12, 0, reloj++)).toISOString();

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
        let lote = [];
        try{ lote = JSON.parse(cuerpo || '[]'); }catch(e){ return manda(400, { message:'json' }); }
        for (const f of lote)
          tabla.set(f.id, Object.assign({}, tabla.get(f.id) || {}, f, { actualizado: sello() }));
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

/** Un equipo: su propia pestaña, su propio almacenamiento, su propio correo. */
async function equipo(nombre, correo){
  const ctx = await br.newContext({ viewport:{ width:1200, height:900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA (' + nombre + ') ' + e.message); fallas++; });
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(`http://127.0.0.1:${PUERTO}/app`);
  await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
  /* Los dos son administradores: los ajustes sólo los escribe la
     administración (SOLO_ADMIN), y de eso trata la prueba. */
  await p.evaluate(([u, c]) => {
    state.usuarios = [
      saneaUsuario({ id:'u1', nombre:'Sistemas', correo:'admin1@ejemplo.example', rol:'admin' }),
      saneaUsuario({ id:'u2', nombre:'Dirección', correo:'admin2@ejemplo.example', rol:'admin' })];
    nube.url = u; nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio', user:{ email:c } };
    nube.ultimo = '';
    guardar();
  }, [`http://127.0.0.1:${PUERTO}`, correo]);
  return { p, sinc: () => p.evaluate(() => sincronizar()) };
}

const uno = await equipo('uno', 'admin1@ejemplo.example');
const dos = await equipo('dos', 'admin2@ejemplo.example');
await uno.sinc(); await dos.sinc();

await bloque('1 · lo tecleado en Ajustes sobrevive a lo que baja', async () => {
  // El otro equipo mueve algo: desde ahora el primero tiene qué bajar.
  await dos.p.evaluate(() => {
    state.ajustes.hotel.ciudad = 'OTRA CIUDAD';
    state.clientes.push(saneaCliente({ id:'cx', empresa:'LLEGA DEL OTRO EQUIPO' }));
    guardar();
  });
  await dos.sinc();

  // Y aquí, alguien está llenando Ajustes.
  const r = await uno.p.evaluate(async () => {
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('hDirector').value = 'Antonio Rico';
    document.getElementById('hPuestoDir').value = 'Dirección General';
    /* Justo lo que pasaba: la nube trae algo mientras la pantalla está
       abierta. Antes esto reemplazaba el estado y lo de abajo se perdía. */
    await sincronizar();
    const traia = nube.hayQueBajar;
    document.getElementById('bGuardarAj').click();
    await new Promise(r => setTimeout(r, 300));
    let enDisco = null;
    try{ enDisco = JSON.parse(localStorage.getItem('crm-hotel-v3')).ajustes.hotel.director; }catch(e){}
    return { enEstado: state.ajustes.hotel.director,
             puesto: state.ajustes.hotel.puestoDirector, enDisco, traia,
             sigueEnPantalla: document.getElementById('hDirector').value,
             dijoGuardado: (document.getElementById('ajOk') || {}).textContent };
  });
  /* Sin esto la prueba se pasaría sola el día que la nube no traiga nada:
     diría «verde» sin haber probado lo único que importa. */
  afirma('la nube de verdad traía algo que aplicar', r.traia === true);
  afirma('el nombre quedó en el estado', r.enEstado === 'Antonio Rico');
  afirma('y en el almacenamiento de este equipo', r.enDisco === 'Antonio Rico');
  afirma('el puesto también', r.puesto === 'Dirección General');
  afirma('no se le borró de la pantalla mientras escribía', r.sigueEnPantalla === 'Antonio Rico');
  /* Decir «Guardado ✓» sin guardar es peor que no decir nada: la persona se
     va tranquila. Si dice que guardó, tiene que haber guardado. */
  afirma('y si dice Guardado, de verdad guardó',
    !/Guardado/.test(r.dijoGuardado || '') || r.enDisco === 'Antonio Rico');
});

await bloque('2 · y al salir de Ajustes, lo del otro equipo sí entra', async () => {
  const r = await uno.p.evaluate(async () => {
    vista = 'tablero'; render();
    await new Promise(r => setTimeout(r, 400));
    await sincronizar();
    return { cliente: state.clientes.some(c => c.id === 'cx'),
             firma: state.ajustes.hotel.director };
  });
  afirma('el cliente del otro equipo llegó', r.cliente);
  /* Lo que se escribió aquí no se pierde al ponerse al día: se subió antes. */
  afirma('y el nombre que se escribió aquí sigue puesto', r.firma === 'Antonio Rico');
});

await bloque('3 · el otro equipo recibe quién firma', async () => {
  const r = await dos.p.evaluate(async () => {
    await sincronizar();
    return state.ajustes.hotel.director;
  });
  afirma('le llegó Antonio Rico', r === 'Antonio Rico');
});

await bloque('4 · con una ventana abierta pasa lo mismo', async () => {
  // Primero se abre la ventana…
  await uno.p.evaluate(async () => {
    vista = 'certificados'; render();
    document.querySelectorAll('.overlay').forEach(e => e.remove());
    state.certificados = [saneaCertificado({ id:'ce1', tipo:'spa_facial',
      paraQuien:'ANTES', estado:'borrador' })];
    guardar();
    editarCertificado('ce1');
    await new Promise(r => setTimeout(r, 400));
  });
  // …y DESPUÉS el otro equipo mueve algo, para que haya qué bajar seguro.
  await dos.p.evaluate(async () => {
    state.clientes.push(saneaCliente({ id:'cy', empresa:'OTRO MÁS' }));
    guardar(); await sincronizar();
  });
  const r = await uno.p.evaluate(async () => {
    await sincronizar();                       // la nube trae algo, con la ventana abierta
    const traia = nube.hayQueBajar;
    document.querySelector('#ceQuien').value = 'DESPUÉS';
    document.querySelector('#ceGuardar').click();
    await new Promise(r => setTimeout(r, 300));
    let enDisco = null;
    try{ enDisco = (JSON.parse(localStorage.getItem('crm-hotel-v3')).certificados[0] || {}).paraQuien; }catch(e){}
    return { enEstado: (state.certificados[0] || {}).paraQuien, enDisco, traia };
  });
  afirma('la nube de verdad traía algo que aplicar', r.traia === true);
  afirma('lo que se corrigió en la ventana quedó', r.enEstado === 'DESPUÉS');
  afirma('y se guardó en el equipo', r.enDisco === 'DESPUÉS');

  // Y al cerrarse la ventana, lo que esperaba entra.
  const d = await uno.p.evaluate(async () => {
    document.querySelectorAll('.overlay').forEach(e => e.remove());
    await new Promise(r => setTimeout(r, 300));
    await sincronizar();
    return { cliente: state.clientes.some(c => c.id === 'cy'),
             certificado: (state.certificados[0] || {}).paraQuien };
  });
  afirma('al cerrarla, lo del otro equipo entra', d.cliente);
  afirma('sin deshacer lo que se acababa de corregir', d.certificado === 'DESPUÉS');
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
