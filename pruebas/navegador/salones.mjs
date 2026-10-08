/* ===========================================================================
   EL SALÓN SE ESCOGE DE UNA LISTA, Y SU RENTA SALE DEL RATO QUE DURA

   La renta se tecleaba a mano, salón por salón, mirando un Excel que —lo
   conté— trae CINCO tablas de precios distintas para el mismo salón. Marco:
   «en el apartado de detalles del evento ayúdame con una lista desplegable de
   los salones y agregarle el precio sugerido modificable».

   Lo que lo hace interesante: un salón no cuesta por hora, cuesta por rato, y
   el rato tiene tres tamaños. El horario ya se captura en el mismo renglón
   —«20:00-2:00»—, así que el precio se puede sacar de ahí en vez de pedirle a
   nadie que escoja un tramo.

   Lo que se prueba aquí es lo que puede salir mal:
     · que las horas se cuenten bien, incluso cruzando la medianoche;
     · que un salón que NO se renta por ese rato no invente un precio;
     · que una renta negociada a mano no se pise;
     · que «Cortesía en base a consumo» sobreviva: el campo es texto libre;
     · y que sin catálogo todo siga como antes de que esto existiera.

   Cómo correrla:  node pruebas/navegador/salones.mjs
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8811;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Servidor de mentiras: la aplicación y un crm_datos en memoria, para poder
   comprobar que el catálogo viaja a los demás equipos. */
const tabla = new Map();
let reloj = 0;
const sello = () => new Date(Date.UTC(2026, 9, 8, 12, 0, reloj++)).toISOString();

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  const manda = (c, b) => { res.writeHead(c, cors); res.end(JSON.stringify(b)); };
  if (req.method === 'OPTIONS') return manda(200, {});
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
  res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
  res.end(fs.readFileSync(APP, 'utf8'));
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

async function equipo(correo){
  const ctx = await br.newContext({ viewport:{ width:1400, height:950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA ' + e.message); fallas++; });
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(`http://127.0.0.1:${PUERTO}/`);
  await p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });
  await p.evaluate(([u, c]) => {
    state.usuarios = [saneaUsuario({ id:'u1', nombre:'Sistemas', correo:c, rol:'admin' })];
    nube.url = u; nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio', user:{ email:c } };
    nube.ultimo = ''; nube.enlazado = true;
    guardar();
  }, [`http://127.0.0.1:${PUERTO}`, correo]);
  return { ctx, p };
}

const admin = await equipo('admin@ejemplo.example');

/* Salones y tarifas INVENTADOS: los de verdad son los del hotel y este
   repositorio es público. Lo que se prueba es la cuenta, no las cifras.
   El «Salón de ejemplo chico» no se renta por una hora suelta, como los
   grandes del libro de Marco. */
const CATALOGO = [
  { nombre:'Salón de ejemplo grande', ubicacion:'Piso 2',
    hasta1:'',   de2a5:20000, de6a12:30000 },
  { nombre:'Salón de ejemplo chico',  ubicacion:'Piso 3',
    hasta1:1000, de2a5:5000,  de6a12:9000 }
];

const sembrar = () => admin.p.evaluate(cat => {
  state.salones = cat.map((x, i) => saneaSalon(Object.assign({ orden:i }, x)));
  state.clientes = [saneaCliente({ id:'c1', empresa:'BODA DE EJEMPLO', ejecutivo:'Sistemas' })];
  state.eventos = [];
  guardar();
}, CATALOGO);

/** Abre una cotización nueva y deja el primer momento a la mano. */
const abrirCotizacion = () => admin.p.evaluate(async () => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  vista = 'eventos'; render();
  editarEvento(null, 'cotizacion');
  await new Promise(r => setTimeout(r, 300));
});

/** Pone el horario, escoge el salón y devuelve lo que quedó en el renglón. */
const escoger = (horario, salon) => admin.p.evaluate(async ([h, s]) => {
  const tr = document.querySelector('#tBloq tbody tr');
  const hora = tr.querySelector('.b-hora');
  hora.value = h;
  hora.dispatchEvent(new Event('input', { bubbles:true }));
  const sel = tr.querySelector('.sl-sel');
  if (sel){ sel.value = s; sel.dispatchEvent(new Event('change', { bubbles:true })); }
  await new Promise(r => setTimeout(r, 120));
  return { renta: tr.querySelector('.b-renta').value,
           salon: tr.querySelector('.b-salon').value,
           porque: (tr.querySelector('.sl-porque') || {}).textContent || '',
           haySelect: !!sel };
}, [horario, salon]);

await bloque('1 · el salón se escoge de una lista', async () => {
  await sembrar();
  await abrirCotizacion();
  const r = await admin.p.evaluate(() => {
    const sel = document.querySelector('#tBloq tbody tr .sl-sel');
    return { hay: !!sel,
             opciones: sel ? [...sel.options].map(o => o.textContent.trim()) : [] };
  });
  afirma('la celda es una lista, no un campo en blanco', r.hay);
  afirma('trae los dos salones del catálogo',
    r.opciones.some(o => /Salón de ejemplo grande/.test(o)) &&
    r.opciones.some(o => /Salón de ejemplo chico/.test(o)));
  /* La ubicación va en la lista porque es lo que distingue dos salones que se
     llaman parecido cuando uno anda escogiendo de prisa. */
  afirma('y cada uno dice en qué piso está',
    r.opciones.some(o => /Piso 2/.test(o)));
  afirma('con su salida de emergencia', r.opciones.some(o => /^Otro/.test(o)));
});

await bloque('2 · la renta sale del rato que dura el momento', async () => {
  await abrirCotizacion();
  const largo = await escoger('20:00-2:00', 'Salón de ejemplo chico');
  /* 20:00 a 2:00 son SEIS horas, no menos veintidós: cruzó la medianoche.
     Es el horario de su foto y el caso que más fácil se cuenta mal. */
  afirma('una boda de 20:00 a 2:00 son 6 horas, no 22 negativas',
    largo.renta.includes('9,000'));
  afirma('y lo dice, para que nadie tenga que adivinar',
    /6 h/.test(largo.porque) && /6-12/.test(largo.porque));

  await abrirCotizacion();
  const medio = await escoger('14:00-16:00', 'Salón de ejemplo chico');
  afirma('dos horas caen en el tramo de en medio', medio.renta.includes('5,000'));

  await abrirCotizacion();
  const corto = await escoger('10:00-10:30', 'Salón de ejemplo chico');
  afirma('media hora cae en el tramo corto', corto.renta.includes('1,000'));
});

await bloque('3 · sin horario se cobra el rato largo, y se dice', async () => {
  await abrirCotizacion();
  const r = await escoger('', 'Salón de ejemplo chico');
  /* Equivocarse hacia arriba se corrige hablando con el cliente; hacia abajo
     se descubre cuando ya se firmó. */
  afirma('se sugiere el tramo largo', r.renta.includes('9,000'));
  afirma('y se explica por qué', /sin horario/i.test(r.porque));
});

await bloque('4 · un salón que no se renta por ese rato no inventa precio', async () => {
  await abrirCotizacion();
  const r = await escoger('10:00-10:30', 'Salón de ejemplo grande');
  /* En el libro del hotel los salones grandes traen un `*` en «0-1 hora».
     Poner ahí el precio de otro tramo sería cobrar mal. */
  afirma('la renta se queda vacía', r.renta === '');
  afirma('y se le dice que la ponga a mano', /no se renta por ese rato/i.test(r.porque));

  /* Pero el mismo salón con un rato que sí se renta, sí se llena. */
  await abrirCotizacion();
  const b = await escoger('18:00-23:00', 'Salón de ejemplo grande');
  afirma('con cinco horas, el mismo salón sí trae su precio', b.renta.includes('20,000'));
});

await bloque('5 · una renta negociada a mano NO se pierde', async () => {
  await abrirCotizacion();
  await escoger('20:00-2:00', 'Salón de ejemplo chico');
  const r = await admin.p.evaluate(async () => {
    const tr = document.querySelector('#tBloq tbody tr');
    tr.querySelector('.b-renta').value = 'Cortesía en base a consumo';
    const sel = tr.querySelector('.sl-sel');
    sel.value = 'Salón de ejemplo grande';
    sel.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    return { renta: tr.querySelector('.b-renta').value,
             salon: tr.querySelector('.b-salon').value };
  });
  /* El campo es TEXTO LIBRE y así se queda: hay cotizaciones que ahí dicen
     esto mismo, y convertirlo en un número las rompería. */
  afirma('«Cortesía en base a consumo» sobrevive al cambio de salón',
    r.renta === 'Cortesía en base a consumo');
  afirma('pero el salón sí cambió', r.salon === 'Salón de ejemplo grande');
});

await bloque('6 · cambiar el horario vuelve a calcular la renta', async () => {
  await abrirCotizacion();
  await escoger('14:00-16:00', 'Salón de ejemplo chico');
  const r = await admin.p.evaluate(async () => {
    const tr = document.querySelector('#tBloq tbody tr');
    const antes = tr.querySelector('.b-renta').value;
    /* La boda se alargó. Que la renta se quede en la del rato de antes es
       justo el error que esto venía a evitar. */
    const h = tr.querySelector('.b-hora');
    h.value = '14:00-22:00';
    h.dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    return { antes, despues: tr.querySelector('.b-renta').value };
  });
  afirma('empezó en el tramo de en medio', r.antes.includes('5,000'));
  afirma('y al alargarse pasa al tramo largo', r.despues.includes('9,000'));
});

await bloque('7 · se puede cotizar un salón que no está en la lista', async () => {
  await abrirCotizacion();
  const r = await admin.p.evaluate(async () => {
    const tr = document.querySelector('#tBloq tbody tr');
    const sel = tr.querySelector('.sl-sel');
    sel.value = OTRO_SALON;
    sel.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));
    const txt = tr.querySelector('.b-salon');
    txt.value = 'Jardín prestado de ejemplo';
    return { visible: txt.style.display !== 'none', valor: txt.value };
  });
  afirma('aparece el campo para escribirlo', r.visible);
  afirma('y se guarda lo que se escribió', r.valor === 'Jardín prestado de ejemplo');
});

await bloque('8 · lo capturado se guarda con el documento', async () => {
  const r = await admin.p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'eventos'; render();
    editarEvento(null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    const tr = document.querySelector('#tBloq tbody tr');
    tr.querySelector('.b-fecha').value = '2026-10-30';
    const h = tr.querySelector('.b-hora');
    h.value = '20:00-2:00'; h.dispatchEvent(new Event('input', { bubbles:true }));
    const sel = tr.querySelector('.sl-sel');
    sel.value = 'Salón de ejemplo chico';
    sel.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 150));

    /* Lo demás que el documento exige para poder guardarse: el cliente se
       escoge de una lista —su valor es el id, no el nombre— y la propuesta
       económica necesita al menos un renglón. */
    document.querySelector('#evCli').value = 'c1';
    const l = document.querySelector('#tLin > tbody > tr:not(.l-desglose)');
    l.querySelector('.l-servicio').value = 'Servicio de ejemplo';
    l.querySelector('.l-cant').value = '50';
    const pr = l.querySelector('.l-precio');
    pr.value = '800'; pr.dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 120));

    document.getElementById('bOkEv').click();
    await new Promise(r => setTimeout(r, 500));
    const e = state.eventos[state.eventos.length - 1];
    return e ? { salon: e.bloques[0].salon, renta: e.bloques[0].renta,
                 err: (document.querySelector('#evErr') || {}).textContent || '' }
             : { err: (document.querySelector('#evErr') || {}).textContent || 'no se guardó' };
  });
  if (r && r.err) console.log('         el documento dijo: ' + r.err.slice(0, 120));
  afirma('el salón queda guardado por su nombre', !!r && r.salon === 'Salón de ejemplo chico');
  afirma('y su renta, tal como quedó en pantalla', !!r && (r.renta || '').includes('9,000'));
});

await bloque('9 · el catálogo viaja a los demás equipos', async () => {
  /* Es lo que tumbaría la subida entera si el servidor rechazara el tipo
     nuevo: un renglón rechazado rebota el lote. */
  await admin.p.evaluate(async () => { await sincronizar(); });
  const otro = await equipo('otro@ejemplo.example');
  const r = await otro.p.evaluate(async () => {
    nube.enlazado = true;
    await sincronizar();
    return (state.salones || []).map(x => x.nombre + '|' + x.de6a12);
  });
  afirma('llegaron los dos salones con sus tarifas',
    r.includes('Salón de ejemplo chico|9000') &&
    r.includes('Salón de ejemplo grande|30000'));
  await otro.ctx.close();
});

await bloque('10 · sin catálogo, todo sigue como antes', async () => {
  const r = await admin.p.evaluate(async () => {
    state.salones = []; guardar();
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    vista = 'eventos'; render();
    editarEvento(null, 'cotizacion');
    await new Promise(r => setTimeout(r, 300));
    const tr = document.querySelector('#tBloq tbody tr');
    const txt = tr.querySelector('.b-salon');
    txt.value = 'LO DE SIEMPRE, A MANO';
    return { haySelect: !!tr.querySelector('.sl-sel'),
             hayTexto: !!txt, visible: txt.style.display !== 'none', valor: txt.value };
  });
  afirma('no se enseña una lista vacía', !r.haySelect);
  afirma('se deja el campo de siempre, a la vista', r.hayTexto && r.visible);
  afirma('y se escribe a mano como hasta hoy', r.valor === 'LO DE SIEMPRE, A MANO');
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
