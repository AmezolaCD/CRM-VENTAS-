/* ===========================================================================
   LA PROPUESTA ECONÓMICA SALE DE UN CATÁLOGO

   La propuesta económica de una cotización de evento era texto libre renglón
   por renglón: «Cena emplatada» y su precio, tecleados cada vez. Tres
   ejecutivos, tres redacciones y tres precios para el mismo platillo — el
   mismo problema que tenían los certificados en el PowerPoint.

   Marco lo pidió así: «en el apartado de servicio quiero que sea una lista
   desplegable con todos los tipos de servicios y que el precio unitario venga
   predeterminado al que viene en el documento, pero modificable».

   Lo que se prueba aquí es lo que puede salir mal:
     · que escoger llene el precio Y la palomita del cargo por servicio;
     · que NO pise un precio negociado a mano;
     · que se pueda cotizar algo que no está en el catálogo;
     · que una cotización vieja —con un servicio que ya no existe— siga
       abriendo con lo suyo;
     · y que el catálogo viaje a los demás equipos sin que el servidor lo
       rebote, que es lo que tumbaría la subida entera.

   Cómo correrla:  node pruebas/navegador/servicios-de-banquetes.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8807;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* ----- Servidor de mentiras: crm_datos en memoria ----- */
const tabla = new Map();
let reloj = 0;
const sello = () => new Date(Date.UTC(2026, 9, 7, 12, 0, reloj++)).toISOString();

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

async function equipo(nombre, correo, rol){
  const ctx = await br.newContext({ viewport:{ width:1280, height:900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA (' + nombre + ') ' + e.message); fallas++; });
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(`http://127.0.0.1:${PUERTO}/app`);
  await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
  await p.evaluate(([u, c, r]) => {
    state.usuarios = [
      saneaUsuario({ id:'u1', nombre:'Sistemas', correo:'admin@ejemplo.example', rol:'admin' }),
      saneaUsuario({ id:'u2', nombre:'Banquetes', correo:'bq@ejemplo.example', rol:'gte_banquetes' })];
    nube.url = u; nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio', user:{ email:c } };
    nube.ultimo = '';
    guardar();
  }, [`http://127.0.0.1:${PUERTO}`, correo, rol]);
  return { p, sinc: () => p.evaluate(() => sincronizar()) };
}

const admin = await equipo('admin', 'admin@ejemplo.example', 'admin');

/** Deja el catálogo con tres servicios: dos con cargo de servicio y uno sin. */
const CATALOGO = [
  { nombre:'Cena emplatada',       precio:850,  conServicio:true  },
  { nombre:'Barra libre nacional', precio:450,  conServicio:true  },
  { nombre:'Pista iluminada',      precio:6500, conServicio:false }
];
/* El `typeof` no es adorno: contra una versión que todavía no tiene catálogo,
   esto debe dejar correr la prueba para que falle donde tiene que fallar —en
   la lista desplegable— y no reventar aquí con un ReferenceError, que no
   demuestra nada. */
await admin.p.evaluate(cat => {
  state.serviciosBq = typeof saneaServicioBq === 'function'
    ? cat.map((x, i) => saneaServicioBq(Object.assign({ orden:i }, x)))
    : cat.map((x, i) => Object.assign({ id:'sb' + i, orden:i }, x));
  state.clientes = [saneaCliente({ id:'c1', empresa:'BODA DE EJEMPLO', ejecutivo:'Banquetes' })];
  guardar(); render();
}, CATALOGO);

/** Abre una cotización nueva y devuelve lo que haya en el primer renglón. */
const abrirCotizacion = () => admin.p.evaluate(async () => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  editarEvento(null, null, 'cotizacion');
  await new Promise(r => setTimeout(r, 300));
});

const renglon = () => admin.p.evaluate(() => {
  const tr = document.querySelector('#tLin tbody tr');
  const sel = tr.querySelector('.l-srvSel');
  return {
    haySelect: !!sel,
    opciones: sel ? [...sel.options].map(o => o.textContent) : [],
    escogido: sel ? sel.value : null,
    servicio: tr.querySelector('.l-servicio').value,
    textoVisible: tr.querySelector('.l-servicio').style.display !== 'none',
    precio: tr.querySelector('.l-precio').value,
    serv: tr.querySelector('.l-serv').checked,
    total: document.querySelector('#evTot').textContent
  };
});

const escoger = v => admin.p.evaluate(async val => {
  const sel = document.querySelector('#tLin tbody tr .l-srvSel');
  sel.value = val;
  sel.dispatchEvent(new Event('change', { bubbles:true }));
  await new Promise(r => setTimeout(r, 80));
}, v);

await bloque('1 · el servicio se escoge de una lista, y llena el renglón', async () => {
  await abrirCotizacion();
  const vacio = await renglon();
  afirma('la celda es una lista, no un campo en blanco', vacio.haySelect);
  afirma('trae los tres servicios del catálogo',
    CATALOGO.every(x => vacio.opciones.includes(x.nombre)));
  afirma('y hasta abajo la salida de emergencia',
    vacio.opciones.some(o => /Otro servicio/.test(o)));

  await escoger('Cena emplatada');
  const cena = await renglon();
  afirma('el precio se llena solo con el del catálogo', cena.precio === '850');
  afirma('la palomita del 15% también', cena.serv === true);
  afirma('y el renglón guarda el nombre del servicio', cena.servicio === 'Cena emplatada');
  afirma('el campo de texto no estorba a la vista', !cena.textoVisible);

  await escoger('Pista iluminada');
  const pista = await renglon();
  afirma('al cambiar de servicio, cambia el precio', pista.precio === '6500');
  /* Esto es lo que de verdad importa del catálogo: la pista NO lleva el 15%,
     y antes había que acordarse de quitar la palomita a mano en cada
     cotización. */
  afirma('y la pista se queda SIN cargo por servicio', pista.serv === false);
});

await bloque('2 · un precio negociado a mano NO se pierde', async () => {
  await abrirCotizacion();
  await escoger('Cena duplicada'.replace('duplicada', 'emplatada'));
  await admin.p.evaluate(async () => {
    const tr = document.querySelector('#tLin tbody tr');
    tr.querySelector('.l-precio').value = '700';          // se negoció con el cliente
    tr.querySelector('.l-serv').checked = false;          // y se le quitó el cargo
    tr.querySelector('.l-precio').dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 60));
  });
  await escoger('Barra libre nacional');
  const r = await renglon();
  afirma('el precio negociado sigue ahí', r.precio === '700');
  afirma('y la palomita que se quitó, también', r.serv === false);
  afirma('pero el servicio sí cambió', r.servicio === 'Barra libre nacional');
});

await bloque('3 · se puede cotizar algo que no está en el catálogo', async () => {
  await abrirCotizacion();
  await escoger('Cena emplatada');
  await escoger('::otro::');
  const otro = await renglon();
  afirma('aparece el campo para escribirlo', otro.textoVisible);
  afirma('y se limpia lo que venía de la lista', otro.servicio === '');

  const r = await admin.p.evaluate(async () => {
    const tr = document.querySelector('#tLin tbody tr');
    tr.querySelector('.l-servicio').value = 'MESA DE DULCES PERSONALIZADA';
    tr.querySelector('.l-cant').value = '1';
    tr.querySelector('.l-precio').value = '9800';
    tr.querySelector('.l-precio').dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 80));
    document.querySelector('#evCli').value = 'BODA DE EJEMPLO';
    // Guardar como borrador: lo que importa es que el renglón se lea completo.
    const lineas = [...document.querySelectorAll('#tLin tbody tr')].map(tr => ({
      servicio: tr.querySelector('.l-servicio').value,
      precio: parseMoney(tr.querySelector('.l-precio').value)
    }));
    return lineas[0];
  });
  afirma('el renglón se lee con lo escrito a mano', r.servicio === 'MESA DE DULCES PERSONALIZADA');
  afirma('y con su precio', r.precio === 9800);
});

await bloque('4 · una cotización vieja sigue abriendo con lo suyo', async () => {
  /* La propuesta era texto libre: hay documentos guardados con servicios que
     nunca van a estar en el catálogo. Ninguno se puede quedar en blanco. */
  const r = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    state.eventos = [saneaEvento({ id:'ev1', tipo:'cotizacion', clienteId:'c1',
      estado:'borrador', fecha:'2026-10-01',
      lineas:[ saneaLineaEv({ servicio:'CENA DE TRES TIEMPOS (2024)', cantidad:120, precio:640 }) ] })];
    guardar(); render();
    editarEvento('ev1');
    await new Promise(r => setTimeout(r, 300));
    const tr = document.querySelector('#tLin tbody tr');
    const sel = tr.querySelector('.l-srvSel');
    return { servicio: tr.querySelector('.l-servicio').value,
             visible: tr.querySelector('.l-servicio').style.display !== 'none',
             escogido: sel ? sel.value : null,
             precio: tr.querySelector('.l-precio').value };
  });
  afirma('el servicio de antes sigue escrito', r.servicio === 'CENA DE TRES TIEMPOS (2024)');
  afirma('y a la vista, no escondido detrás de la lista', r.visible);
  afirma('la lista lo reconoce como «Otro»', r.escogido === '::otro::');
  afirma('y su precio no se tocó', r.precio === '640');
});

await bloque('5 · el catálogo llega a los demás equipos', async () => {
  await admin.p.evaluate(() => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  });
  await admin.sinc();
  const rechazados = await admin.p.evaluate(() => nube.rechazados.length);
  /* Si el servidor rebotara un renglón del tipo nuevo, tumbaría la subida
     ENTERA —PostgREST manda el lote en un solo POST—. Por eso se mide. */
  afirma('el servidor no rebotó nada', rechazados === 0);
  afirma('el catálogo subió',
    [...tabla.keys()].filter(k => k.startsWith('serviciosBq:')).length === 3);

  const bq = await equipo('banquetes', 'bq@ejemplo.example', 'gte_banquetes');
  await bq.sinc();
  const r = await bq.p.evaluate(() => state.serviciosBq.map(x =>
    x.nombre + '|' + x.precio + '|' + (x.conServicio ? 'si' : 'no')));
  afirma('a banquetes le llegaron los tres',
    r.join(' · ') === 'Cena emplatada|850|si · Barra libre nacional|450|si · Pista iluminada|6500|no');
  await bq.p.context().close();
});

await bloque('6 · sin catálogo, la captura NO se rompe', async () => {
  const r = await admin.p.evaluate(async () => {
    state.serviciosBq = [];
    guardar(); render();
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    editarEvento(null, null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    const tr = document.querySelector('#tLin tbody tr');
    tr.querySelector('.l-servicio').value = 'LO DE SIEMPRE, A MANO';
    return { haySelect: !!tr.querySelector('.l-srvSel'),
             hayTexto: !!tr.querySelector('.l-servicio'),
             servicio: tr.querySelector('.l-servicio').value,
             avisa: /cat[aá]logo de servicios est[aá] vac[ií]o/i
                      .test(document.querySelector('.modal-body').innerText) };
  });
  afirma('no se enseña una lista de un solo renglón', !r.haySelect);
  afirma('se deja el campo de siempre', r.hayTexto && r.servicio === 'LO DE SIEMPRE, A MANO');
  afirma('y se dice dónde se captura el catálogo', r.avisa);
});

await bloque('7 · se captura en Ajustes y llega a la cotización', async () => {
  const r = await admin.p.evaluate(async () => {
    state.serviciosBq = [];
    guardar();
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 300));

    document.getElementById('bAddSrv').click();
    await new Promise(r => setTimeout(r, 250));
    document.getElementById('bAddSrv').click();
    await new Promise(r => setTimeout(r, 250));

    const filas = [...document.querySelectorAll('#tSrv tr[data-sb]')];
    const pon = (i, nombre, precio, serv) => {
      filas[i].querySelector('[data-sk="nombre"]').value = nombre;
      filas[i].querySelector('[data-sk="precio"]').value = precio;
      filas[i].querySelector('[data-sk="conServicio"]').checked = serv;
    };
    pon(0, 'Menú coctel', '520', true);
    pon(1, 'Mobiliario lounge', '3200', false);
    document.getElementById('bGuardarAj').click();
    await new Promise(r => setTimeout(r, 300));

    let enDisco = [];
    try{ enDisco = JSON.parse(localStorage.getItem('crm-hotel-v3')).serviciosBq || []; }catch(e){}
    return { cuantas: filas.length,
             enEstado: state.serviciosBq.map(x => x.nombre + '|' + x.precio + '|' + x.conServicio),
             enDisco: enDisco.length };
  });
  afirma('«+ Agregar servicio» agrega renglones', r.cuantas === 2);
  afirma('se guardan con su precio y su palomita',
    r.enEstado.join(' · ') === 'Menú coctel|520|true · Mobiliario lounge|3200|false');
  afirma('y quedan en el almacenamiento del equipo', r.enDisco === 2);

  /* Lo que importa de verdad: que de ahí salga la lista de la cotización. */
  const enCotizacion = await admin.p.evaluate(async () => {
    vista = 'eventos'; render();
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    editarEvento(null, null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    const sel = document.querySelector('#tLin tbody tr .l-srvSel');
    sel.value = 'Mobiliario lounge';
    sel.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 80));
    const tr = document.querySelector('#tLin tbody tr');
    return { opciones: [...sel.options].map(o => o.textContent),
             precio: tr.querySelector('.l-precio').value,
             serv: tr.querySelector('.l-serv').checked };
  });
  afirma('lo capturado en Ajustes sale en la lista',
    enCotizacion.opciones.includes('Menú coctel') &&
    enCotizacion.opciones.includes('Mobiliario lounge'));
  afirma('con el precio que se le puso', enCotizacion.precio === '3200');
  afirma('y sin el cargo por servicio, como se marcó', enCotizacion.serv === false);
});

await bloque('8 · un servicio sin nombre no se queda en el catálogo', async () => {
  /* Agregar un renglón y arrepentirse es lo más normal del mundo. Uno en
     blanco en la lista desplegable es un renglón vacío que nadie entiende. */
  const r = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 300));
    const antes = state.serviciosBq.length;
    document.getElementById('bAddSrv').click();
    await new Promise(r => setTimeout(r, 250));
    document.getElementById('bGuardarAj').click();      // sin escribirle nombre
    await new Promise(r => setTimeout(r, 300));
    return { antes, despues: state.serviciosBq.length };
  });
  afirma('el renglón en blanco se descarta al guardar', r.despues === r.antes);
});

await bloque('9 · la lista se carga de golpe, pegándola', async () => {
  /* El kit del hotel y la lista del proveedor de audiovisual traen más de cien
     renglones entre los dos y cambian cada enero. Teclearlos a mano no es
     trabajo de nadie, y escribirlos dentro de la aplicación tampoco: este
     archivo es público. */
  /* Nombres y precios INVENTADOS: la lista de verdad trae los precios del
     hotel y los de su proveedor, y este repositorio es público. Lo que se
     prueba es la forma del archivo, no sus cifras. */
  const LISTA = [
    'Servicio,Precio,Serv.',
    'Cafetería de ejemplo · una pausa,111,sí',
    '"Menú de ejemplo en 3 tiempos de pollo, cerdo o vegetariano",222,sí',
    'Barra de ejemplo · hasta 4 horas,333,sí',
    'Proyector de ejemplo,444,no',
    'Pista de ejemplo 6 x 8 m,555,no',
    'Silla de ejemplo,66,no'
  ].join('\n');

  const r = await admin.p.evaluate(async lista => {
    state.serviciosBq = [];
    guardar();
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('bImpSrv').click();
    await new Promise(r => setTimeout(r, 200));
    document.getElementById('srvTexto').value = lista;
    document.getElementById('srvCargar').click();
    await new Promise(r => setTimeout(r, 400));
    return state.serviciosBq.map(x => x.nombre + '|' + x.precio + '|' + (x.conServicio ? 'si' : 'no'));
  }, LISTA);
  afirma('entraron los seis', r.length === 6);
  afirma('el encabezado no se coló como servicio', !r.some(x => /^Servicio\|/.test(x)));
  afirma('un nombre con coma adentro no se parte en dos',
    r.includes('Menú de ejemplo en 3 tiempos de pollo, cerdo o vegetariano|222|si'));
  /* Lo que de verdad distingue una lista de otra: los alimentos llevan el 15%
     y el audiovisual no. Cargarlo mal es cobrar de más en cada cotización. */
  afirma('los alimentos quedan CON cargo por servicio',
    r.includes('Cafetería de ejemplo · una pausa|111|si') &&
    r.includes('Barra de ejemplo · hasta 4 horas|333|si'));
  afirma('y el audiovisual y el mobiliario SIN él',
    r.includes('Proyector de ejemplo|444|no') &&
    r.includes('Pista de ejemplo 6 x 8 m|555|no') &&
    r.includes('Silla de ejemplo|66|no'));
});

await bloque('10 · volver a cargarla actualiza precios sin duplicar', async () => {
  const r = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 300));
    const antes = state.serviciosBq.length;
    document.getElementById('bImpSrv').click();
    await new Promise(r => setTimeout(r, 200));
    // El mismo servicio con otro precio, y uno nuevo.
    document.getElementById('srvTexto').value =
      'Cafetería de ejemplo · una pausa,999,sí\nCalentón de ejemplo,777,no';
    document.getElementById('srvCargar').click();
    await new Promise(r => setTimeout(r, 400));
    const cafe = state.serviciosBq.filter(x => /una pausa/.test(x.nombre));
    return { antes, despues: state.serviciosBq.length,
             cuantosCafe: cafe.length, precioCafe: cafe[0] && cafe[0].precio,
             hayCalenton: state.serviciosBq.some(x => x.nombre === 'Calentón de ejemplo') };
  });
  afirma('el que ya estaba no se duplicó', r.cuantosCafe === 1);
  afirma('se le actualizó el precio', r.precioCafe === 999);
  afirma('el nuevo se agregó', r.hayCalenton);
  afirma('y no se borró nada de lo demás', r.despues === r.antes + 1);
});

await bloque('11 · «reemplazar» sí deja sólo lo nuevo', async () => {
  const r = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('bImpSrv').click();
    await new Promise(r => setTimeout(r, 200));
    document.getElementById('srvTexto').value = 'Cena emplatada,850,sí\nPista iluminada,6500,no';
    document.getElementById('srvReemplaza').checked = true;
    document.getElementById('srvCargar').click();
    await new Promise(r => setTimeout(r, 400));
    return state.serviciosBq.map(x => x.nombre);
  });
  afirma('quedan nada más los dos', r.length === 2);
  afirma('y en el orden en que venían',
    r[0] === 'Cena emplatada' && r[1] === 'Pista iluminada');
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
