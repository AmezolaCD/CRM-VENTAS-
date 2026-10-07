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
    /* Enlazado, como un equipo que ya lleva tiempo trabajando con la nube. Sin
       esto, cualquier puesta al día entra por `primeraSincronizacion` —la que
       pregunta si se adoptan los datos del servidor— y adopta la nube encima
       de lo que este equipo acaba de capturar. Que es lo correcto para un
       primer enlace, y justo lo que NO se está probando aquí. */
    nube.enlazado = true;
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
  const tr = document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
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
  const sel = document.querySelector('#tLin > tbody > tr:not(.l-desglose) .l-srvSel');
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
    const tr = document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
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
    const tr = document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
    tr.querySelector('.l-servicio').value = 'MESA DE DULCES PERSONALIZADA';
    tr.querySelector('.l-cant').value = '1';
    tr.querySelector('.l-precio').value = '9800';
    tr.querySelector('.l-precio').dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 80));
    document.querySelector('#evCli').value = 'BODA DE EJEMPLO';
    // Guardar como borrador: lo que importa es que el renglón se lea completo.
    const lineas = [...document.querySelectorAll('#tLin > tbody > tr:not(.l-desglose)')].map(tr => ({
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
    const tr = document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
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
    const tr = document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
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
    const sel = document.querySelector('#tLin > tbody > tr:not(.l-desglose) .l-srvSel');
    sel.value = 'Mobiliario lounge';
    sel.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 80));
    const tr = document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
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
    'Servicio,Precio,Serv.,Familia',
    'Cafetería de ejemplo · una pausa,111,sí,Alimentos de ejemplo',
    '"Menú de ejemplo en 3 tiempos de pollo, cerdo o vegetariano",222,sí,Alimentos de ejemplo',
    'Barra de ejemplo · hasta 4 horas,333,sí,Bebidas de ejemplo',
    'Proyector de ejemplo,444,no,Audiovisual de ejemplo',
    'Pista de ejemplo 6 x 8 m,555,no,Audiovisual de ejemplo',
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

  /* Con 130 servicios de dos listas, la lista desplegable tiene que venir
     partida por familias o no se puede usar. */
  const g = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'eventos'; render();
    editarEvento(null, null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    const sel = document.querySelector('#tLin > tbody > tr:not(.l-desglose) .l-srvSel');
    return {
      grupos: [...sel.querySelectorAll('optgroup')].map(o => o.label),
      enAlimentos: [...sel.querySelectorAll('optgroup[label="Alimentos de ejemplo"] option')]
        .map(o => o.value),
      sueltos: [...sel.children].filter(e => e.tagName === 'OPTION' && e.value &&
        e.value !== '::otro::').map(o => o.value),
      cuantos: sel.querySelectorAll('option').length
    };
  });
  afirma('la lista viene partida por familias, en el orden del catálogo',
    g.grupos.join(' · ') === 'Alimentos de ejemplo · Bebidas de ejemplo · Audiovisual de ejemplo');
  afirma('cada servicio bajo la suya', g.enAlimentos.length === 2 &&
    g.enAlimentos.some(v => /Cafetería/.test(v)) && g.enAlimentos.some(v => /Menú/.test(v)));
  /* Uno sin familia no se pierde: sale suelto al final, no desaparece. */
  afirma('el que no trae familia sale suelto, no se pierde',
    g.sueltos.join('') === 'Silla de ejemplo');
  afirma('y están los seis, más «Escoge» y «Otro»', g.cuantos === 8);
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
    /* Sin cuarta columna a propósito: un archivo viejo de tres columnas tiene
       que seguir entrando, y no debe borrar la familia que ya estaba puesta. */
    document.getElementById('srvTexto').value =
      'Cafetería de ejemplo · una pausa,999,sí\nCalentón de ejemplo,777,no';
    document.getElementById('srvCargar').click();
    await new Promise(r => setTimeout(r, 400));
    const cafe = state.serviciosBq.filter(x => /una pausa/.test(x.nombre));
    return { antes, despues: state.serviciosBq.length,
             cuantosCafe: cafe.length, precioCafe: cafe[0] && cafe[0].precio,
             hayCalenton: state.serviciosBq.some(x => x.nombre === 'Calentón de ejemplo'),
             familiaCafe: cafe[0] && cafe[0].familia };
  });
  afirma('el que ya estaba no se duplicó', r.cuantosCafe === 1);
  afirma('se le actualizó el precio', r.precioCafe === 999);
  afirma('el nuevo se agregó', r.hayCalenton);
  afirma('y no se borró nada de lo demás', r.despues === r.antes + 1);
  afirma('un archivo de tres columnas no le borra la familia que ya tenía',
    r.familiaCafe === 'Alimentos de ejemplo');
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

/* ---------------------------------------------------------------------------
   12 · «GUARDAR AJUSTES» GUARDA LOS SERVICIOS.

   Marco lo preguntó con razón, porque ya le pasó: cada vez que se agrega algo
   a la pantalla de Ajustes hay que acordarse de recogerlo al guardar, y si se
   olvida, el botón dice «Guardado ✓» y no guarda ese campo. Pasó con quién
   firma los certificados. Esto lo prueba haciendo lo mismo que haría él: con
   el ratón, campo por campo, y comprobando los CUATRO —nombre, familia,
   precio y la palomita— en el estado, en el disco y después de recargar.
   --------------------------------------------------------------------------- */
await bloque('12 · «Guardar ajustes» sí guarda los servicios', async () => {
  const puesto = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    state.serviciosBq = [saneaServicioBq({ id:'sbX', nombre:'Antes', familia:'Antes',
                                           precio:1, conServicio:true })];
    guardar();
    /* Salir y volver a entrar, como lo haría una persona: estando ya en
       Ajustes la pantalla NO se repinta sola —es a propósito, si no se le
       borraría a quien esté capturando—. */
    vista = 'tablero'; render();
    await new Promise(r => setTimeout(r, 200));
    vista = 'ajustes'; render();
    await new Promise(r => setTimeout(r, 300));
    const tr = document.querySelector('#tSrv tr[data-sb="sbX"]');
    tr.querySelector('[data-sk="nombre"]').value  = 'Montaje y mantelería de ejemplo';
    tr.querySelector('[data-sk="familia"]').value = 'Mobiliario de ejemplo';
    tr.querySelector('[data-sk="precio"]').value  = '1,234.50';
    tr.querySelector('[data-sk="conServicio"]').checked = false;
    document.getElementById('bGuardarAj').click();
    await new Promise(r => setTimeout(r, 400));
    const x = state.serviciosBq[0];
    let d = null;
    try{ d = (JSON.parse(localStorage.getItem('crm-hotel-v3')).serviciosBq || [])[0]; }catch(e){}
    return { estado: x && [x.nombre, x.familia, x.precio, x.conServicio].join('|'),
             disco:  d && [d.nombre, d.familia, d.precio, d.conServicio].join('|'),
             dijo: (document.getElementById('ajOk') || {}).textContent };
  });
  const ESPERADO = 'Montaje y mantelería de ejemplo|Mobiliario de ejemplo|1234.5|false';
  afirma('los cuatro campos quedan en el estado', puesto.estado === ESPERADO);
  afirma('y escritos en el equipo', puesto.disco === ESPERADO);
  /* El precio con coma y centavos no se puede perder: «1,234.50» son mil
     doscientos treinta y cuatro con cincuenta, no uno. */
  afirma('el precio se entiende con coma de miles y centavos',
    /\|1234\.5\|/.test(puesto.estado || ''));
  afirma('y la pantalla dice que guardó', /Guardado/.test(puesto.dijo || ''));

  // Y lo que de verdad cuenta: que siga ahí después de recargar.
  await admin.p.reload();
  await admin.p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
  /* La sesión no se guarda en el equipo, así que al recargar queda la pantalla
     de entrar encima. Se vuelve a entrar para que los bloques de abajo miren
     la aplicación y no el acceso. */
  await admin.p.evaluate(c => {
    nube.sesion = { access_token:'ficticio', user:{ email:c } };
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    render();
  }, 'admin@ejemplo.example');
  const tras = await admin.p.evaluate(() => {
    const x = state.serviciosBq[0];
    return x && [x.nombre, x.familia, x.precio, x.conServicio].join('|');
  });
  afirma('y sobrevive a recargar la aplicación', tras === ESPERADO);
});

/* ---------------------------------------------------------------------------
   13 · «SERVICIOS COTIZADOS» YA NO SE CAPTURA — SIN PERDER LO QUE YA SE ESCRIBIÓ.

   Marco: «lo de servicios cotizados y la propuesta económica se me hace algo
   que se repite». En la cotización sí: imprimía una sección de texto libre
   justo encima de la tabla que ya nombra esos mismos servicios. Se quita de la
   captura y deja de salir en los documentos nuevos.

   Lo que NO puede pasar: que una cotización que ya salió cambie de contenido.
   Quitar una sección de la pantalla no puede borrarle el texto a un documento
   que ya lo traía, ni firmado ni en borrador.
   --------------------------------------------------------------------------- */
await bloque('13 · se quita de la captura sin borrar lo ya escrito', async () => {
  const nuevo = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'eventos'; render();
    editarEvento(null, null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    /* El editor, no cualquier modal: con la pantalla de acceso encima esta
       comprobación se pasaba sola mirando el formulario equivocado. */
    const caja = document.querySelector('#tLin') &&
                 document.querySelector('#tLin').closest('.modal-body');
    const cuerpo = caja ? caja.innerText : '';
    return { abrioElEditor: !!caja,
             hayCampo: !!document.querySelector('#evServicios'),
             hayTitulo: /Servicios cotizados/i.test(cuerpo),
             hayPropuesta: /Propuesta econ[oó]mica/i.test(cuerpo) };
  });
  afirma('el editor de la cotización sí abrió', nuevo.abrioElEditor);
  afirma('en uno nuevo ya no sale la sección', !nuevo.hayCampo && !nuevo.hayTitulo);
  afirma('y la propuesta económica sigue ahí', nuevo.hayPropuesta);

  const viejo = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    const TEXTO = 'Jardín de ejemplo\n· Ceremonia de ejemplo';
    state.eventos = [saneaEvento({ id:'evViejo', tipo:'cotizacion', clienteId:'c1',
      estado:'borrador', fecha:'2026-10-01', servicios:TEXTO,
      lineas:[saneaLineaEv({ servicio:'Algo de ejemplo', cantidad:1, precio:100 })] })];
    guardar(); render();
    editarEvento('evViejo');
    await new Promise(r => setTimeout(r, 300));
    const campo = document.querySelector('#evServicios');
    const traia = campo ? campo.value : null;
    // Guardar sin tocar nada: el texto no se puede ir.
    document.querySelector('#evGuardar') ? document.querySelector('#evGuardar').click()
      : document.querySelectorAll('.modal-foot .btn')[2].click();
    await new Promise(r => setTimeout(r, 400));
    const e = state.eventos.find(x => x.id === 'evViejo');
    return { traia, quedo: e && e.servicios, TEXTO };
  });
  afirma('en uno que ya lo traía, sí se puede ver y corregir', viejo.traia === viejo.TEXTO);
  afirma('y guardar no se lo borra', viejo.quedo === viejo.TEXTO);
});

/* ---------------------------------------------------------------------------
   14 · EL BUSCADOR DE LA LISTA.

   «ponme un buscador en la lista desplegable de servicios ya que al ser tantos
   es dificil localizarlos». Con 180 renglones entre el kit del hotel, la lista
   del proveedor y los paquetes, bajar la lista a mano no se puede.
   --------------------------------------------------------------------------- */
await bloque('14 · se busca dentro de la lista', async () => {
  /* Un catálogo largo de mentiras: el buscador sólo sale cuando hace falta. */
  const CAT = [];
  for (let i = 1; i <= 18; i++)
    CAT.push({ nombre:'Relleno de ejemplo ' + i, precio:100 + i, conServicio:true,
               familia:'Relleno de ejemplo' });
  CAT.push({ nombre:'Pista de ejemplo 6 x 8 m', precio:555, conServicio:false,
             familia:'Escenarios de ejemplo' });
  CAT.push({ nombre:'Tarima de ejemplo', precio:444, conServicio:false,
             familia:'Escenarios de ejemplo' });
  CAT.push({ nombre:'Cafetería de ejemplo', precio:111, conServicio:true,
             familia:'Alimentos de ejemplo' });

  const r = await admin.p.evaluate(async cat => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    state.serviciosBq = cat.map((x, i) => saneaServicioBq(Object.assign({ orden:i }, x)));
    guardar();
    vista = 'eventos'; render();
    editarEvento(null, null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));

    const tr = () => document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
    const campo = tr().querySelector('.busca-srv');
    const sel = () => tr().querySelector('.l-srvSel');
    const teclear = async t => {
      campo.value = t;
      campo.dispatchEvent(new Event('input', { bubbles:true }));
      await new Promise(r => setTimeout(r, 120));
    };
    const estado = () => ({
      opciones: [...sel().options].filter(o => o.value && o.value !== '::otro::').map(o => o.value),
      escogido: sel().value,
      precio: tr().querySelector('.l-precio').value,
      serv: tr().querySelector('.l-serv').checked,
      cuenta: tr().querySelector('.srv-cuenta').textContent
    });

    const hayBuscador = !!campo;
    const alAbrir = estado();

    // 1 · por nombre, y queda uno: se escoge solo y se llena
    await teclear('pista');
    const unaSola = estado();

    // 2 · por familia
    await teclear('escenarios');
    const porFamilia = estado();

    // 3 · sin acentos ni mayúsculas
    await teclear('CAFETERIA');
    const sinAcentos = estado();

    // 4 · algo que no existe
    await teclear('xyz que no existe');
    const nada = estado();

    // 5 · se borra la búsqueda: vuelven todos
    await teclear('');
    const vuelven = estado();
    return { hayBuscador, alAbrir, unaSola, porFamilia, sinAcentos, nada, vuelven };
  }, CAT);

  afirma('con un catálogo largo sale el buscador', r.hayBuscador);
  afirma('al abrir están todos', r.alAbrir.opciones.length === 21);

  afirma('buscar por nombre deja uno solo', r.unaSola.opciones.length === 1);
  /* Lo que de verdad ahorra el buscador: queda uno, se escoge solo, y se
     llenan su precio y su palomita sin picarle a nada más. */
  afirma('y se escoge solo', r.unaSola.escogido === 'Pista de ejemplo 6 x 8 m');
  afirma('con su precio', r.unaSola.precio === '555');
  afirma('y su palomita, que esta no lleva cargo', r.unaSola.serv === false);
  afirma('y lo dice', /uno solo/i.test(r.unaSola.cuenta));

  afirma('también se busca por familia', r.porFamilia.opciones.length === 2 &&
    r.porFamilia.opciones.includes('Tarima de ejemplo'));
  afirma('y dice cuántos coinciden', /2 coinciden/.test(r.porFamilia.cuenta));

  afirma('no importan acentos ni mayúsculas',
    r.sinAcentos.opciones.join('') === 'Cafetería de ejemplo');

  /* Buscar es mirar, no deshacer: una palabra que no empata no puede borrarle
     a nadie el servicio que ya tenía escogido. */
  afirma('lo que no empata no borra lo ya escogido',
    r.nada.escogido === 'Cafetería de ejemplo');
  afirma('y avisa que no hay coincidencias', /ninguno coincide/i.test(r.nada.cuenta));

  afirma('al borrar la búsqueda vuelven todos', r.vuelven.opciones.length === 21);
  afirma('sin perder lo escogido', r.vuelven.escogido === 'Cafetería de ejemplo');
});

await bloque('15 · con pocos servicios el buscador no estorba', async () => {
  const r = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    state.serviciosBq = [
      saneaServicioBq({ nombre:'Uno de ejemplo', precio:10, orden:0 }),
      saneaServicioBq({ nombre:'Dos de ejemplo', precio:20, orden:1 })];
    guardar();
    vista = 'eventos'; render();
    editarEvento(null, null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    const tr = document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
    return { buscador: !!tr.querySelector('.busca-srv'), lista: !!tr.querySelector('.l-srvSel') };
  });
  afirma('con dos servicios no sale el buscador', !r.buscador);
  afirma('pero la lista sí', r.lista);
});

/* ---------------------------------------------------------------------------
   16 · EL DESGLOSE DEL PAQUETE: ADENTRO CON CIFRAS, AFUERA SIN ELLAS.

   «que a la hora de estar haciendo la cotizacion se muestre el listado de los
   servicios que se ofrecen en cada paquete y que vengan sus respectivos
   costos por persona sujerido pero modificable pero esto solo como control
   interno en reportes de ingreso, pero a la hora de crear la cotizacion para
   el cliente solo se muestre la lista de servicios de ese paquete sin costos
   y solo venga el costo total por persona».

   Lo que puede salir caro: que una cifra interna se cuele al papel del
   cliente, o que el total por persona no siga a lo que el ejecutivo movió.
   --------------------------------------------------------------------------- */
const PAQ = {
  nombre:'Paquete de ejemplo · pollo o cerdo', precio:1193, conServicio:false,
  familia:'Paquetes de ejemplo',
  partes:[ { concepto:'Menú de ejemplo 3 tiempos', unitario:726, cantidad:80 },
           { concepto:'Descorche de ejemplo',      unitario:400, cantidad:80 },
           { concepto:'Mantel de ejemplo',         unitario:130, cantidad:8  } ]
};
// 726*80 + 400*80 + 130*8 = 58080 + 32000 + 1040 = 91120 ; /80 = 1139
const TOTAL_PAQ = 91120, XPERS = 1139;

await bloque('16 · escoger un paquete trae su desglose y de ahí sale el precio', async () => {
  const r = await admin.p.evaluate(async paq => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    state.serviciosBq = [saneaServicioBq(Object.assign({ orden:0 }, paq)),
      saneaServicioBq({ nombre:'Suelto de ejemplo', precio:60, orden:1, familia:'Sueltos' })];
    state.eventos = [];
    guardar();
    vista = 'eventos'; render();
    editarEvento(null, null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    const tr = () => document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
    const sel = tr().querySelector('.l-srvSel');
    sel.value = paq.nombre; sel.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    // 80 invitados
    tr().querySelector('.l-cant').value = '80';
    tr().querySelector('.l-cant').dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    const caja = () => document.querySelector('#tLin .l-desglose .desglose');
    return {
      hayCaja: !!caja(),
      conceptos: [...caja().querySelectorAll('.d-concepto')].map(i => i.value),
      total: caja().querySelector('.d-total').textContent,
      xpers: caja().querySelector('.d-xpers').textContent,
      precio: tr().querySelector('.l-precio').value,
      precioBloqueado: tr().querySelector('.l-precio').readOnly,
      subEvento: document.querySelector('#evSub').textContent
    };
  }, PAQ);
  afirma('baja el desglose del catálogo', r.hayCaja && r.conceptos.length === 3);
  afirma('con sus conceptos', r.conceptos[0] === 'Menú de ejemplo 3 tiempos');
  afirma('suma el total del paquete', r.total.includes('91,120'));
  afirma('y saca el costo por persona', r.xpers.includes('1,139'));
  /* Lo medular: el precio del renglón SALE del desglose y no se teclea, para
     que no puedan contradecirse delante de un cliente. */
  afirma('el precio del renglón sale de ahí', r.precio === String(XPERS));
  afirma('y deja de teclearse a mano', r.precioBloqueado === true);
  /* El subtotal del evento es exactamente lo que suma el desglose: 80 × 1,139.
     El total de abajo lleva el IVA encima, y ése no es lo que se mide aquí. */
  afirma('el subtotal del evento cuadra con el desglose', r.subEvento.includes('91,120'));
});

await bloque('17 · lo que mueva el ejecutivo manda', async () => {
  const r = await admin.p.evaluate(async () => {
    const tr = () => document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
    const caja = () => document.querySelector('#tLin .l-desglose .desglose');
    // Se negocia el menú: de 726 a 650
    const u = caja().querySelectorAll('.d-unit')[0];
    u.value = '650'; u.dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    const tras = { xpers: caja().querySelector('.d-xpers').textContent,
                   precio: tr().querySelector('.l-precio').value };
    // Y se quita el mantel
    caja().querySelectorAll('[data-quitaparte]')[2].click();
    await new Promise(r => setTimeout(r, 120));
    const sinMantel = { conceptos: [...caja().querySelectorAll('.d-concepto')].map(i => i.value),
                        precio: tr().querySelector('.l-precio').value };
    // Y se agrega uno nuevo
    caja().querySelector('[data-addparte]').click();
    await new Promise(r => setTimeout(r, 120));
    const f = caja().querySelectorAll('tbody > tr')[2];
    f.querySelector('.d-concepto').value = 'Pirotecnia de ejemplo';
    f.querySelector('.d-unit').value = '3000';
    f.querySelector('.d-cant').value = '1';
    f.querySelector('.d-cant').dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    return Object.assign({ tras, sinMantel }, {
      conPiro: { precio: tr().querySelector('.l-precio').value,
                 total: caja().querySelector('.d-total').textContent } });
  });
  // 650*80 + 400*80 + 130*8 = 52000+32000+1040 = 85040 ; /80 = 1063
  afirma('bajar un unitario baja el por persona', r.tras.precio === '1063');
  // sin mantel: 84000 ; /80 = 1050
  afirma('quitar un concepto también', r.sinMantel.precio === '1050' &&
    r.sinMantel.conceptos.length === 2);
  // + 3000 = 87000 ; /80 = 1088 (87000/80 = 1087.5 → 1088)
  afirma('y agregar uno, igual', r.conPiro.precio === '1088');
  afirma('el total del paquete sigue cuadrando', r.conPiro.total.includes('87,000'));
});

await bloque('18 · el desglose del renglón es COPIA del catálogo', async () => {
  const r = await admin.p.evaluate(async () => {
    // Se guarda la cotización tal como quedó.
    document.querySelector('#evCli').value = 'BODA DE EJEMPLO';
    const lineas = [...document.querySelectorAll('#tLin > tbody > tr:not(.l-desglose)')].map(tr => ({
      servicio: tr.querySelector('.l-servicio').value,
      partes: [...(tr.nextElementSibling.querySelectorAll('.desglose > table > tbody > tr') || [])].map(f => ({
        concepto: f.querySelector('.d-concepto').value,
        unitario: parseMoney(f.querySelector('.d-unit').value) }))
    }));
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    /* Con su cliente: un evento sin cliente es huérfano y `sanear` lo aparta
       en la primera sincronización —y entonces los bloques de abajo medirían
       un documento que ya no existe—. */
    state.clientes = [saneaCliente({ id:'c1', empresa:'BODA DE EJEMPLO',
                                     ejecutivo:'Sistemas' })];
    state.eventos = [saneaEvento({ id:'evP', tipo:'cotizacion', clienteId:'c1',
      estado:'borrador', fecha:'2026-10-07', lineas:[saneaLineaEv({
        servicio: lineas[0].servicio, cantidad:80, precio:1088,
        partes: lineas[0].partes.map(p => ({ concepto:p.concepto, unitario:p.unitario, cantidad:80 })) })] })];
    guardar();
    // Ahora cambia el CATÁLOGO: otro precio y otro desglose.
    state.serviciosBq[0].precio = 9999;
    state.serviciosBq[0].partes = [saneaParteBq({ concepto:'OTRA COSA', unitario:1, cantidad:1 })];
    guardar();
    const e = state.eventos.find(x => x.id === 'evP');
    return { conceptos: e.lineas[0].partes.map(p => p.concepto),
             precio: e.lineas[0].precio };
  });
  afirma('la cotización guardada conserva SU desglose',
    r.conceptos.length === 3 && !r.conceptos.includes('OTRA COSA'));
  afirma('y su precio', r.precio === 1088);
});

await bloque('19 · al cliente, los conceptos SIN una sola cifra', async () => {
  const r = await admin.p.evaluate(() => {
    /* Autónomo, como el de abajo: entre bloque y bloque corre la
       sincronización, y heredar el documento del anterior es azar. */
    state.clientes = [saneaCliente({ id:'c1', empresa:'BODA DE EJEMPLO', ejecutivo:'Sistemas' })];
    const e = saneaEvento({ id:'evD', tipo:'cotizacion', clienteId:'c1', estado:'borrador',
      fecha:'2026-10-07', lineas:[saneaLineaEv({
        servicio:'Paquete de ejemplo · pollo o cerdo', cantidad:80, precio:1088,
        partes:[ { concepto:'Menú de ejemplo 3 tiempos', unitario:650, cantidad:80 },
                 { concepto:'Descorche de ejemplo', unitario:400, cantidad:80 },
                 { concepto:'Pirotecnia de ejemplo', unitario:3000, cantidad:1 } ] })] });
    state.eventos = [e]; guardar();
    const caja = document.createElement('div');
    caja.innerHTML = cuerpoEvento(e, cliente(e.clienteId));
    const celda = [...caja.querySelectorAll('td')]
      .find(td => td.querySelector('.inc-paq'));
    return { hayLista: !!celda,
             texto: celda ? celda.innerText : '',
             html: celda ? celda.innerHTML : '',
             todo: caja.innerText };
  });
  afirma('la hoja trae la lista de lo que incluye el paquete', r.hayLista);
  afirma('con sus conceptos', /Menú de ejemplo 3 tiempos/.test(r.texto) &&
    /Descorche de ejemplo/.test(r.texto));
  /* El corazón del asunto: ni un costo interno en el papel del cliente. */
  afirma('y NI UNA cifra del desglose en esa celda',
    !/650|400|3000|85040|87,000/.test(r.html));
  afirma('el documento no enseña ningún unitario',
    !/\b650\b/.test(r.todo) && !/\b3,?000\b/.test(r.todo));
  afirma('pero sí el precio por persona', /1,088/.test(r.todo));
});

await bloque('20 · adentro, el reporte sí trae las cifras', async () => {
  const r = await admin.p.evaluate(async () => {
    /* Se arma aquí mismo en vez de heredarlo del bloque de arriba: entre uno
       y otro corre la sincronización, y un bloque que depende de lo que dejó
       el anterior se vuelve azar. */
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    state.clientes = [saneaCliente({ id:'c1', empresa:'BODA DE EJEMPLO', ejecutivo:'Sistemas' })];
    state.eventos = [saneaEvento({ id:'evR', tipo:'cotizacion', clienteId:'c1',
      estado:'confirmado', fecha: new Date().getFullYear() + '-06-15',
      lineas:[saneaLineaEv({ servicio:'Paquete de ejemplo · pollo o cerdo',
        cantidad:80, precio:1088, partes:[
          { concepto:'Menú de ejemplo 3 tiempos', unitario:650, cantidad:80 },
          { concepto:'Pirotecnia de ejemplo', unitario:3000, cantidad:1 } ] })] })];
    guardar();
    let bajado = null;
    const orig = window.descargar;
    window.descargar = (nombre, contenido) => { bajado = { nombre, contenido }; };
    vista = 'reportes'; render();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('repAnio').click();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('repDesg').click();
    await new Promise(r => setTimeout(r, 200));
    window.descargar = orig;
    return bajado;
  });
  afirma('se baja un archivo de desglose', !!r && /desglose-de-paquetes/.test(r.nombre));
  const reng = r.contenido.split(/\r?\n/).filter(Boolean);
  afirma('con un renglón por concepto: encabezado y los dos', reng.length === 3);
  afirma('y con sus cifras, que aquí sí van', /650/.test(r.contenido) && /3000/.test(r.contenido));
  afirma('diciendo de qué paquete son', /Paquete de ejemplo/.test(r.contenido));
});

await bloque('21 · un servicio sin desglose sigue como siempre', async () => {
  const r = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'eventos'; render();
    editarEvento(null, null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    const tr = () => document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
    const sel = tr().querySelector('.l-srvSel');
    sel.value = 'Suelto de ejemplo'; sel.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    const sinCaja = !document.querySelector('#tLin .l-desglose .desglose');
    const libre = !tr().querySelector('.l-precio').readOnly;
    // Y se puede teclear el precio, como toda la vida.
    tr().querySelector('.l-precio').value = '77';
    tr().querySelector('.l-cant').value = '2';
    tr().querySelector('.l-cant').dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    return { sinCaja, libre, sub: tr().querySelector('.l-sub').textContent };
  });
  afirma('no le cuelga ningún desglose', r.sinCaja);
  afirma('su precio se teclea, como siempre', r.libre);
  afirma('y las cuentas salen', r.sub.includes('154'));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
