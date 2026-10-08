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
    /* Enlazado, como un equipo que ya lleva tiempo trabajando con la nube. Sin
       esto, cualquier puesta al día entra por `primeraSincronizacion` —la que
       pregunta si se adoptan los datos del servidor— y adopta la nube encima
       de lo que este equipo acaba de capturar. Que es lo correcto para un
       primer enlace, y justo lo que NO se está probando aquí. */
    nube.enlazado = true;
    guardar();
  }, [`http://127.0.0.1:${PUERTO}`, correo]);
  return { p, sinc: () => p.evaluate(() => sincronizar()) };
}

const uno = await equipo('uno', 'admin1@ejemplo.example');
const dos = await equipo('dos', 'admin2@ejemplo.example');
await uno.sinc(); await dos.sinc();

await bloque('1 · lo tecleado en Ajustes sobrevive a lo que baja', async () => {
  /* El orden importa y ya me tropecé con él: PRIMERO se abre Ajustes y hasta
     DESPUÉS el otro equipo mueve algo. Al revés, cualquier guardado del primer
     equipo dispara una subida con retardo que se puede llevar lo pendiente
     antes de que la pantalla esté abierta, y entonces no queda nada por bajar
     —la prueba se pone verde sin haber probado nada—. */
  await uno.p.evaluate(async () => {
    vista = 'ajustes'; render();
    /* 900 ms, no 400: cada `guardar()` deja programada una subida a los 400, y
       si se cuela a media prueba el escenario deja de ser el que se quería
       medir. Se le da tiempo de pasar ANTES de que el otro equipo mueva nada. */
    await new Promise(r => setTimeout(r, 900));
  });

  await dos.p.evaluate(() => {
    state.ajustes.hotel.ciudad = 'OTRA CIUDAD';
    state.clientes.push(saneaCliente({ id:'cx', empresa:'LLEGA DEL OTRO EQUIPO' }));
    guardar();
  });
  await dos.sinc();

  // Y aquí, alguien está llenando Ajustes.
  const r = await uno.p.evaluate(async () => {
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
    // Igual que arriba: se deja pasar la subida programada por ese `guardar()`.
    window.__vig = { estado: state, fila: state.certificados[0] };
    await new Promise(r => setTimeout(r, 900));
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
    return { enEstado: (state.certificados[0] || {}).paraQuien, enDisco, traia,
             seReemplazo: state !== window.__vig.estado };
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
  /* El estado NO se puede haber reemplazado con la ventana abierta: ésa es la
     causa de que se pierda lo tecleado, y de ahí salió el defecto que esta
     prueba destapó —`primeraSincronizacion` lo hacía sin preguntar—. */
  afirma('el estado no se reemplazó con la ventana abierta', r.seReemplazo === false);

  afirma('al cerrarla, lo del otro equipo entra', d.cliente);
  afirma('sin deshacer lo que se acababa de corregir', d.certificado === 'DESPUÉS');
});

/* ---------------------------------------------------------------------------
   5 · EL PRIMER ENLACE TAMPOCO PUEDE PISAR UNA CAPTURA ABIERTA.

   Lo destapó esta misma prueba, poniéndose roja de vez en cuando. El guardián
   estaba en `sincronizar()`, pero su hermana —`primeraSincronizacion`, la que
   corre la primera vez que un equipo se conecta y al volver a entrar— también
   REEMPLAZA el estado entero, y ésa no lo tenía.

   No es un caso de laboratorio: se vence la sesión con una cotización abierta,
   la persona vuelve a entrar, y al guardar lo que llevaba escrito se pierde.

   Lo difícil es que el guardián no puede ser el mismo: el primer enlace se
   hace desde Ajustes, y al entrar hay una pantalla de acceso encima. Si se
   contaran esas dos, el equipo no se enlazaría NUNCA. Eso también se prueba.
   --------------------------------------------------------------------------- */
await bloque('5 · el primer enlace espera a que se cierre la captura', async () => {
  const tres = await equipo('tres', 'admin1@ejemplo.example');
  // Un equipo que todavía NO está enlazado, como recién configurado.
  await tres.p.evaluate(() => {
    nube.enlazado = false;
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  });

  const conVentana = await tres.p.evaluate(async () => {
    state.certificados = [saneaCertificado({ id:'cx1', tipo:'spa_facial',
      paraQuien:'LO QUE SE ESTABA ESCRIBIENDO', estado:'borrador' })];
    guardar();
    vista = 'certificados'; render();
    editarCertificado('cx1');
    await new Promise(r => setTimeout(r, 300));
    const antes = state;
    await primeraSincronizacion();
    return { seReemplazo: state !== antes, enlazado: nube.enlazado,
             pendiente: nube.hayQueBajar,
             sigueAbierta: !!document.querySelector('#ceQuien') };
  });
  afirma('con la ventana abierta NO se reemplaza el estado', conVentana.seReemplazo === false);
  afirma('y el enlace se queda pendiente', conVentana.enlazado === false && conVentana.pendiente);
  afirma('la ventana sigue ahí, con lo suyo', conVentana.sigueAbierta);

  /* Y la otra mitad: con la pantalla de acceso encima —que es un `.overlay`
     también— el enlace SÍ tiene que ocurrir, o nadie podría entrar. */
  const conAcceso = await tres.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    pantallaEntrada();
    await new Promise(r => setTimeout(r, 200));
    const hayAcceso = !!document.getElementById('entrada');
    const antes = state;
    await primeraSincronizacion();
    const r = { hayAcceso, seReemplazo: state !== antes, enlazado: nube.enlazado };
    cerrarEntrada();
    return r;
  });
  afirma('la pantalla de acceso sí estaba encima', conAcceso.hayAcceso);
  afirma('y aun así el equipo se enlaza', conAcceso.enlazado === true);

  await tres.p.context().close();
});

await bloque('6 · plegar una sección de Ajustes no borra lo que hay dentro', async () => {
  /* Marco: «puedes hacer que se pueda ocultar cada sección de ajustes para no
     estarme desplazando tanto». Ajustes mide ocho mil píxeles de alto.

     El riesgo está en CÓMO se pliega. `recogerAjustes()` lee los campos con
     `querySelectorAll` cada vez que se agrega, se mueve o se borra algo; si
     una sección cerrada sacara sus campos de la página, al guardar se
     borraría todo lo que vive dentro de ella —el catálogo de salones, los
     usuarios, los datos del hotel— en silencio y por haber doblado un
     título. Por eso se OCULTA, no se quita, y por eso esta prueba. */
  const eq = await equipo('plegado', 'admin1@ejemplo.example');
  const r = await eq.p.evaluate(async () => {
    state.salones = [saneaSalon({ nombre:'Salón de ejemplo', ubicacion:'Piso 2',
                                  de2a5:20000, de6a12:30000, orden:0 })];
    state.habitaciones = state.habitaciones.slice(0, 2);
    guardar();
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 700));

    const caja = document.getElementById('panelAjustes').firstElementChild;
    const abierto = caja.scrollHeight;
    const plegables = caja.querySelectorAll(':scope > h3.sec.sec-plegable').length;

    document.getElementById('ajPlegarTodo').click();
    await new Promise(r => setTimeout(r, 300));
    const cerrado = caja.scrollHeight;
    /* Los campos tienen que SEGUIR en la página, nada más escondidos. */
    const campoSigue = !!document.querySelector('#tSal tr[data-sl] [data-lk="nombre"]');

    // Y ahora lo que de verdad importa: guardar con todo cerrado.
    document.getElementById('bGuardarAj').click();
    await new Promise(r => setTimeout(r, 600));

    const sal = (state.salones || [])[0] || {};
    return { abierto, cerrado, plegables, campoSigue,
             salones: (state.salones || []).length,
             nombre: sal.nombre, tarifa: sal.de6a12,
             usuarios: state.usuarios.length,
             habitaciones: state.habitaciones.length,
             hotel: (state.ajustes && state.ajustes.hotel || {}).nombre };
  });

  afirma('todas las secciones se pueden plegar', r.plegables >= 12);
  /* La medida de que esto sirve para algo: de ocho pantallas a media. */
  afirma(`se encoge de verdad (${r.abierto} px → ${r.cerrado} px)`,
    r.abierto > 4000 && r.cerrado < r.abierto / 5);
  afirma('los campos siguen en la página, sólo escondidos', r.campoSigue);
  /* Y lo medular: guardar con todo cerrado no se lleva nada por delante. */
  afirma('el catálogo de salones sobrevive al guardado',
    r.salones === 1 && r.nombre === 'Salón de ejemplo' && r.tarifa === 30000);
  afirma('los usuarios también', r.usuarios >= 1);
  afirma('el catálogo de habitaciones también', r.habitaciones === 2);
  afirma('y los datos del hotel', !!r.hotel);
  await eq.p.context().close();
});

await bloque('7 · lo plegado se recuerda al volver', async () => {
  const eq = await equipo('memoria', 'admin1@ejemplo.example');
  const r = await eq.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 600));
    const caja = document.getElementById('panelAjustes').firstElementChild;
    const titulos = [...caja.querySelectorAll(':scope > h3.sec')];
    const uno = titulos.find(h => /nube y equipo/i.test(h.textContent));
    uno.click();
    await new Promise(r => setTimeout(r, 250));
    const cerradaAhora = uno.classList.contains('sec-cerrada');

    /* Salir de Ajustes y volver: es lo que hace cualquiera entre una cosa y
       otra, y si el plegado se olvidara ahí no serviría de nada. */
    vista = 'tablero'; render();
    await new Promise(r => setTimeout(r, 200));
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 600));
    const caja2 = document.getElementById('panelAjustes').firstElementChild;
    const uno2 = [...caja2.querySelectorAll(':scope > h3.sec')]
      .find(h => /nube y equipo/i.test(h.textContent));
    const otra = [...caja2.querySelectorAll(':scope > h3.sec')]
      .find(h => /datos del hotel/i.test(h.textContent));
    return { cerradaAhora,
             sigueCerrada: uno2.classList.contains('sec-cerrada'),
             laOtraAbierta: !otra.classList.contains('sec-cerrada') };
  });
  afirma('al dar clic en el título se cierra', r.cerradaAhora);
  afirma('y al volver a Ajustes sigue cerrada', r.sigueCerrada);
  /* Sólo la que cerró: no se le pliega lo que no pidió. */
  afirma('las demás siguen abiertas', r.laOtraAbierta);
  await eq.p.context().close();
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
