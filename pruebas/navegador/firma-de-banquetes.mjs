/* ===========================================================================
   EL CONTRATO DE BANQUETES SE FIRMA DESDE EL ENLACE, Y EL CLIENTE LLENA
   LO QUE ES SUYO

   Marco pidió dos cosas seguidas: «me gustaría que se pudiera firmar de manera
   digital… y aplica también lo de mandar el enlace para firma al cliente en
   contratos», y después «en los campos vacíos lo podrías poner tipo formulario
   para que el cliente lo llene?».

   Hay dos clases de hueco en ese contrato y NO se tratan igual:

     · los del HOTEL —razón social, RFC, escritura, banco, cuenta, CLABE,
       registro de PROFECO— se capturan en Ajustes y jamás se le ponen a
       alguien de fuera. Que un cliente pudiera escribir la cuenta bancaria en
       su propio contrato es la puerta de un fraude.
     · los del CLIENTE —domicilio, teléfono, correo, RFC— los conoce él mejor
       que nadie, y si los corrige, lo que firma es lo corregido.

   Y hay una trampa que esta prueba existe para atrapar: la pantalla de firma
   corre en el navegador DEL CLIENTE, que no tiene los ajustes del hotel. Sin
   congelarlos dentro del documento al firmarlo, el cliente abriría un contrato
   que dice «________» donde va la razón social y la cuenta de depósito.

   Cómo correrla:  node pruebas/navegador/firma-de-banquetes.mjs

   TODO lo de aquí es inventado: el repositorio es público y aquí no entra un
   dato de ningún cliente ni la cuenta de ningún banco de verdad.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8816;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Datos legales INVENTADOS. Lo que se prueba es que lleguen a donde van, no
   cuáles son. */
const LEGALES = {
  razonSocial:'RAZÓN SOCIAL DE EJEMPLO S.A. DE C.V.',
  representante:'Representante de ejemplo', rfc:'XAXX010101000',
  escritura:'número 1 de ejemplo', domicilioFiscal:'Domicilio fiscal de ejemplo',
  banco:'Banco de ejemplo', cuenta:'0000000000', clabe:'000000000000000000',
  registroProfeco:'0000/2026', multaFumar:'20,000'
};

/* --------------------------------------------------------------------------
   El servidor de mentiras.

   `documento` lo pone el bloque 1 con lo que de verdad dejó `firmarEvento`:
   así la pantalla del cliente lee EXACTAMENTE lo que el CRM subiría, no una
   copia hecha a mano que podría estar de acuerdo con la prueba y no con la
   aplicación.
   -------------------------------------------------------------------------- */
let documento = null;          // el evento ya firmado por el hotel
let recibidas = [];            // lo que depositó el cliente, en orden
let sinColumna = false;        // el servidor no tiene datos_cliente todavía
let enBuzon = [];              // lo que el CRM va a recoger
let parcheadas = [];

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const manda = (c, b) => {
    res.writeHead(c, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
      'Access-Control-Allow-Methods':'*' });
    res.end(JSON.stringify(b));
  };
  const cuerpoDe = cb => { let t = ''; req.on('data', d => t += d);
                           req.on('end', () => cb(t)); };
  if (req.method === 'OPTIONS') return manda(200, {});
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/rest/v1/rpc/crm_buzon_ok'){
    res.writeHead(200, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*' });
    return res.end('true');
  }
  if (u.pathname === '/rest/v1/crm_datos'){
    /* La pantalla del cliente pide UN renglón por su id —'id=eq.eventos:e1'—.
       A la bajada completa del CRM se le contesta vacío a propósito: si se le
       devolviera este mismo documento, la sincronización le pondría encima la
       copia vieja al estado recién cambiado y la prueba estaría midiendo eso.
       En el servidor de verdad no pasa porque la copia de allá SÍ es la nueva. */
    if (req.method !== 'GET') return manda(201, {});
    const uno = String(u.searchParams.get('id') || '');
    /* Con la clave equivocada no se contesta «no autorizado»: se contesta
       VACÍO, que es lo que hace la regla del servidor de verdad —el renglón
       sencillamente no existe para quien no trae su clave—. */
    const clave = req.headers['x-firma-token'] || '';
    if (uno.startsWith('eq.') && documento && clave === documento.tokenFirma)
      return manda(200, [{ id:'eventos:' + documento.id, datos:documento }]);
    return manda(200, []);
  }
  if (u.pathname === '/rest/v1/crm_firmas'){
    if (req.method === 'GET')   return manda(200, enBuzon);
    if (req.method === 'PATCH') return cuerpoDe(t => { parcheadas.push(u.search); manda(204, {}); });
    return cuerpoDe(t => {
      let f = null;
      try{ f = JSON.parse(t || '{}'); }catch(e){}
      recibidas.push(f);
      /* Es lo que contesta PostgREST cuando la columna no existe: el hotel no
         ha corrido la última versión de firmas.sql. */
      if (sinColumna && f && 'datos_cliente' in f)
        return manda(400, { code:'PGRST204',
          message:"Could not find the 'datos_cliente' column of 'crm_firmas' in the schema cache" });
      manda(201, {});
    });
  }
  manda(404, { message:'no existe' });
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

/**
 * El CRM, como lo ve el ejecutivo: con la nube puesta y la sesión abierta.
 *
 * Se le PARA la sincronización, y hay que decir por qué: este servidor de
 * mentiras no guarda nada, así que cada sondeo contesta «la nube está vacía» y
 * a los pocos segundos le pone encima un estado en blanco a lo que el bloque
 * acaba de cambiar. Peor: el primer enlace reemplaza el estado entero y se
 * lleva por delante el formulario abierto. La sincronización tiene sus propias
 * pruebas —borrar-se-propaga, copiar-es-enviar—; aquí lo que se mide es la
 * firma. Lo que NO se apaga es `recogerFirmas`, que es parte de lo que se
 * prueba y se llama a mano.
 */
async function crm(){
  const ctx = await br.newContext({ viewport:{ width:1200, height:900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(`http://127.0.0.1:${PUERTO}/app`);
  await p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });
  await p.evaluate(({ leg, puerto }) => {
    state.usuarios = [saneaUsuario({ id:'u1', nombre:'Sistemas',
      correo:'admin1@ejemplo.example', rol:'admin' })];
    nube.url = 'http://127.0.0.1:' + puerto;
    nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'x', user:{ email:'admin1@ejemplo.example' } };
    detenerSondeo();
    programarSubida = () => {};
    /* El administrador alcanza las dos áreas, así que el CRM le pregunta en
       cuál entra —y esa pantalla se pone encima de todo lo demás—. Se escoge
       banquetes, que es donde viven los eventos. */
    ponDepto('banquetes');
    Object.assign(state.ajustes.hotel, leg);
    state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO A.C.',
      contacto:'Contacto de ejemplo', ejecutivo:'Sistemas',
      ubicacion:'Domicilio de ejemplo 100', telefono:'664 000 0000',
      email:'contacto@ejemplo.example', rfc:'AAA010101AAA' })];
    guardar();
  }, { leg: LEGALES, puerto: PUERTO });
  return { ctx, p };
}

/** Un evento de banquetes recién capturado, sin firmar. */
const meteEvento = (p, tipo) => p.evaluate(t => {
  const e = saneaEvento({ id:'e1', tipo:t, clienteId:'c1', ejecutivo:'Sistemas',
    folio: t === 'contrato' ? 'CB-EJEMPLO' : 'EV-EJEMPLO',
    fecha:'2026-10-08', titulo:'Evento de ejemplo', garantiaPax:'150', anticipo:30000,
    bloques:[saneaBloqueEv({ fecha:'2026-11-20', horario:'08:00-11:00', evento:'Desayuno',
                             pax:'150', salon:'Salón de ejemplo', horas:'3' })],
    lineas:[saneaLineaEv({ servicio:'Desayuno de ejemplo', cantidad:150, precio:400,
                           conServicio:true })] });
  state.eventos = [e]; guardar();
  return JSON.parse(JSON.stringify(e));
}, tipo);

/** La pantalla del cliente, en un navegador que no sabe nada del hotel. */
function ligaDe(doc){
  const d = { v: doc.id, d:'eventos', t: doc.tokenFirma,
              u:'http://127.0.0.1:' + PUERTO, k:'llave-de-mentiras' };
  return Buffer.from(JSON.stringify(d)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function comoCliente(doc, token){
  const ctx = await br.newContext({ viewport:{ width:430, height:900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  const liga = token
    ? ligaDe(Object.assign({}, doc, { tokenFirma: token }))
    : ligaDe(doc);
  await p.goto(`http://127.0.0.1:${PUERTO}/app#firmar=` + liga);
  return { ctx, p };
}

const trazar = p => p.evaluate(() => {
  const pad = document.querySelector('#pad');
  const g = pad.getContext('2d');
  g.strokeStyle = '#39104e'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(30, 60); g.lineTo(150, 30); g.lineTo(220, 80); g.stroke();
  pad.dataset.trazado = '1';
});

/* --- 1 --------------------------------------------------------------------
   Firmar por el hotel es lo que abre el enlace, y lo que congela el papel. */
await bloque('1 · al firmar el hotel nace la clave y se congela lo que dice el contrato', async () => {
  const { ctx, p } = await crm();
  await meteEvento(p, 'contrato');
  const r = await p.evaluate(async () => {
    const e = state.eventos[0];
    const ok = await firmarEvento(e, 'hotel', { nombre:'Quien firma de ejemplo',
      puesto:'Banquetes', celular:'', img:'data:image/png;base64,iVBORw0KGgo=' });
    return { ok, evento: JSON.parse(JSON.stringify(e)),
             /* El candado de la sincronización: un evento al que nadie le ha
                mandado enlace no carga ninguno de los campos nuevos. Si
                nacieran en los valores por omisión, los tres mil eventos se
                verían editados a la vez y este equipo mandaría su copia encima
                de la de los demás. */
             recienNacido: Object.keys(saneaEvento({ id:'z1', clienteId:'c1' })) };
  });
  afirma('firmó', r.ok === true && r.evento.estado === 'firmado' && !!r.evento.firmaHotel);
  afirma('nació la clave del enlace', !!r.evento.tokenFirma);
  afirma('la razón social quedó congelada en el documento',
    r.evento.datosHotel && r.evento.datosHotel.razonSocial === LEGALES.razonSocial);
  afirma('la cuenta de depósito también',
    r.evento.datosHotel && r.evento.datosHotel.cuenta === LEGALES.cuenta);
  afirma('el logo NO se copió dentro del documento',
    r.evento.datosHotel && !('logo' in r.evento.datosHotel));
  afirma('el RFC del cliente viaja en el destinatario',
    r.evento.destinatario && r.evento.destinatario.rfc === 'AAA010101AAA');
  for (const k of ['tokenFirma','datosCliente','datosHotel','datosVistos'])
    afirma(`un evento sin tocar no carga «${k}»`, !r.recienNacido.includes(k));
  documento = r.evento;       // es lo que leerá la pantalla del cliente
  await ctx.close();
});

/* --- 1b -------------------------------------------------------------------
   Pasar una cotización a contrato copia TODO lo de la cotización. Si se copiara
   también la clave del enlace, los dos documentos compartirían la misma y quien
   tuviera la de uno abriría el otro. */
await bloque('1b · el contrato que sale de una cotización nace sin la clave de ella', async () => {
  const { ctx, p } = await crm();
  const r = await p.evaluate(async () => {
    const cot = saneaEvento({ id:'c9', tipo:'cotizacion', clienteId:'c1', ejecutivo:'Sistemas',
      folio:'EV-EJEMPLO', fecha:'2026-10-08', titulo:'Evento de ejemplo' });
    state.eventos = [cot]; guardar();
    await firmarEvento(cot, 'hotel', { nombre:'Quien firma de ejemplo', puesto:'Banquetes',
      celular:'', img:'data:image/png;base64,iVBORw0KGgo=' });
    cot.datosCliente = { rfc:'BBB020202BBB' };
    pasarAContratoBq(cot, null);
    const k = state.eventos.find(x => x.cotizacionId === 'c9');
    return { clave: cot.tokenFirma, nuevo: JSON.parse(JSON.stringify(saneaEvento(k))) };
  });
  afirma('la cotización sí tiene su clave', !!r.clave);
  afirma('el contrato nuevo NO la hereda', !r.nuevo.tokenFirma);
  afirma('ni hereda lo que escribió el cliente en la otra', !r.nuevo.datosCliente);
  afirma('ni los datos congelados de la otra', !r.nuevo.datosHotel);
  await ctx.close();
});

/* --- 2 --------------------------------------------------------------------
   Lo que de verdad se arregló: el contrato que abre el cliente nombra al
   hotel, aunque su navegador no tenga los ajustes del hotel. */
await bloque('2 · el contrato que abre el cliente nombra al hotel y dice dónde pagar', async () => {
  const { ctx, p } = await comoCliente(documento);
  await p.locator('#pad').waitFor({ timeout:15000 });
  const t = await p.locator('.doc-contenido').innerText();
  afirma('dice la razón social', t.includes(LEGALES.razonSocial));
  afirma('dice el RFC del hotel', t.includes(LEGALES.rfc));
  afirma('dice el banco y la cuenta',
    t.includes(LEGALES.banco) && t.includes(LEGALES.cuenta));
  afirma('dice la CLABE', t.includes(LEGALES.clabe));
  afirma('y siguen estando las diecinueve cláusulas',
    await p.locator('.doc-contenido .cl').count() === 19);
  await ctx.close();
});

/* --- 3 -------------------------------------------------------------------- */
await bloque('3 · con una clave que no es la suya, no abre', async () => {
  const { ctx, p } = await comoCliente(documento, 'clave-que-no-es');
  await p.locator('#firmaCliente .note.warn').first().waitFor({ timeout:15000 });
  const t = await p.locator('#firmaCliente').innerText();
  afirma('no hay lienzo que firmar', await p.locator('#pad').count() === 0);
  afirma('y se le dice que el enlace ya no sirve', /ya no sirve/i.test(t));
  await ctx.close();
});

/* --- 4 --------------------------------------------------------------------
   El formulario es del CONTRATO. Pedirle el RFC para cotizar una boda es
   ponerle un trámite donde no hay ninguno. */
await bloque('4 · el formulario sale en el contrato y no en la cotización', async () => {
  const { ctx, p } = await comoCliente(documento);
  await p.locator('#pad').waitFor({ timeout:15000 });
  afirma('el contrato trae el formulario', await p.locator('#dcCampos').count() === 1);
  afirma('con los cuatro campos del cliente',
    await p.locator('#dcCampos input[data-dc]').count() === 4);
  afirma('domicilio, teléfono, correo y RFC',
    (await p.locator('#dcCampos').innerText()).match(/Domicilio/) &&
    (await p.locator('#dcCampos').innerText()).match(/RFC/));
  /* Y los del HOTEL no están: ni la cuenta, ni la CLABE, ni el registro. */
  const llaves = await p.$$eval('#dcCampos input[data-dc]', xs => xs.map(x => x.dataset.dc));
  afirma('y NINGÚN campo del hotel',
    !llaves.some(k => ['cuenta','clabe','banco','razonSocial','escritura','registroProfeco'].includes(k)));
  await ctx.close();

  const cot = Object.assign({}, documento, { id:'e2', tipo:'cotizacion', folio:'EV-EJEMPLO' });
  const antes = documento; documento = cot;
  const b = await comoCliente(cot);
  await b.p.locator('#pad').waitFor({ timeout:15000 });
  afirma('la cotización NO trae formulario', await b.p.locator('#dcCampos').count() === 0);
  await b.ctx.close();
  documento = antes;
});

/* --- 5 --------------------------------------------------------------------
   «Lo que escriba aparece arriba»: la diferencia entre llenar un formulario y
   leer lo que uno firma. */
await bloque('5 · lo que teclea aparece en las declaraciones del contrato', async () => {
  const { ctx, p } = await comoCliente(documento);
  await p.locator('#pad').waitFor({ timeout:15000 });
  /* El RFC del cliente venía puesto desde su ficha; se vacía para ver la raya. */
  await p.fill('#dcCampos input[data-dc="rfc"]', '');
  await p.waitForFunction(() =>
    /Contribuyentes es ____/.test(document.querySelector('.doc-contenido').innerText),
    null, { timeout:4000 });
  afirma('vacío, el contrato enseña una raya', true);
  await p.fill('#dcCampos input[data-dc="rfc"]', 'bbb020202bbb');
  await p.waitForFunction(() =>
    /BBB020202BBB/.test(document.querySelector('.doc-contenido').innerText),
    null, { timeout:4000 });
  afirma('escrito, el contrato lo dice —y en mayúsculas—', true);
  await p.fill('#dcCampos input[data-dc="ubicacion"]', 'Domicilio nuevo de ejemplo 123');
  await p.waitForFunction(() =>
    /Domicilio nuevo de ejemplo 123/.test(document.querySelector('.doc-contenido').innerText),
    null, { timeout:4000 });
  afirma('y el domicilio corregido también', true);
  await ctx.close();
});

/* --- 6 --------------------------------------------------------------------
   Avisar de los huecos, sí. Bloquear la firma, NUNCA: un cliente que no se
   acuerda de su RFC un domingo no se puede quedar sin firmar. */
await bloque('6 · avisa una vez de los huecos y a la segunda deja firmar', async () => {
  recibidas = []; sinColumna = false;
  const { ctx, p } = await comoCliente(documento);
  await p.locator('#pad').waitFor({ timeout:15000 });
  await p.fill('#dcCampos input[data-dc="rfc"]', '');
  await trazar(p);
  await p.locator('#cfOk').click();
  await p.locator('#cfErr .note.warn').waitFor({ timeout:5000 });
  afirma('avisa de lo que falta',
    /falta rfc/i.test(await p.locator('#cfErr').innerText()));
  afirma('y todavía no depositó nada', recibidas.length === 0);
  await p.locator('#cfOk').click();
  await p.waitForFunction(() =>
    /qued[oó] firmad/i.test(document.querySelector('#firmaCliente').innerText),
    null, { timeout:8000 });
  afirma('a la segunda firma', recibidas.length === 1);
  await ctx.close();
});

/* --- 7 -------------------------------------------------------------------- */
await bloque('7 · lo que escribió viaja con su firma', async () => {
  recibidas = []; sinColumna = false;
  const { ctx, p } = await comoCliente(documento);
  await p.locator('#pad').waitFor({ timeout:15000 });
  await p.fill('#dcCampos input[data-dc="ubicacion"]', 'Domicilio nuevo de ejemplo 123');
  await p.fill('#dcCampos input[data-dc="rfc"]', 'bbb020202bbb');
  await trazar(p);
  await p.locator('#cfOk').click();
  await p.waitForFunction(() =>
    /qued[oó] firmad/i.test(document.querySelector('#firmaCliente').innerText),
    null, { timeout:8000 });
  const f = recibidas[0] || {};
  afirma('va el documento con su tipo adelante', f.convenio_id === 'eventos:e1');
  afirma('va la firma como imagen', /^data:image\/png/.test(f.img || ''));
  afirma('va el domicilio que corrigió',
    f.datos_cliente && f.datos_cliente.ubicacion === 'Domicilio nuevo de ejemplo 123');
  afirma('va el RFC, en mayúsculas',
    f.datos_cliente && f.datos_cliente.rfc === 'BBB020202BBB');
  /* Lo que NO puede viajar: nada del hotel. */
  afirma('y NADA del hotel',
    f.datos_cliente && !['cuenta','clabe','banco','razonSocial'].some(k => k in f.datos_cliente));
  await ctx.close();
});

/* --- 8 --------------------------------------------------------------------
   Si el hotel no corrió la última versión de firmas.sql, la columna no existe
   y el servidor rebota TODO. La firma tiene que entrar de todos modos: lo que
   se pierde es la corrección, no la firma. */
await bloque('8 · sin la columna en el servidor, la firma entra sola', async () => {
  recibidas = []; sinColumna = true;
  const { ctx, p } = await comoCliente(documento);
  await p.locator('#pad').waitFor({ timeout:15000 });
  await p.fill('#dcCampos input[data-dc="rfc"]', 'bbb020202bbb');
  await trazar(p);
  await p.locator('#cfOk').click();
  await p.waitForFunction(() =>
    /qued[oó] firmad/i.test(document.querySelector('#firmaCliente').innerText),
    null, { timeout:8000 });
  afirma('lo intentó con los datos y luego sin ellos', recibidas.length === 2);
  afirma('el segundo intento no lleva la columna',
    recibidas[1] && !('datos_cliente' in recibidas[1]));
  afirma('y la firma sí llegó', recibidas[1] && /^data:image\/png/.test(recibidas[1].img || ''));
  afirma('al cliente no se le enseñó ningún error',
    !/PGRST|schema cache|column/i.test(await p.locator('#firmaCliente').innerText()));
  sinColumna = false;
  await ctx.close();
});

/* --- 9 --------------------------------------------------------------------
   El hotel recoge del buzón: el evento queda confirmado, con lo que el cliente
   escribió congelado, y el ejecutivo se encuentra el aviso. */
await bloque('9 · el hotel recoge la firma y se le ofrece pasar la corrección a la ficha', async () => {
  parcheadas = [];
  enBuzon = [{ id:7, convenio_id:'eventos:e1', token: documento.tokenFirma,
               nombre:'Contacto de ejemplo', puesto:'', celular:'664 000 0000',
               img:'data:image/png;base64,iVBORw0KGgo=', creado:'2026-10-08T18:00:00Z',
               aplicada:false,
               datos_cliente:{ ubicacion:'Domicilio nuevo de ejemplo 123',
                               rfc:'BBB020202BBB' } }];
  const { ctx, p } = await crm();
  const r = await p.evaluate(async doc => {
    state.eventos = [saneaEvento(doc)];
    guardar();
    const parte = await recogerFirmas();
    const e = state.eventos[0];
    return { parte, evento: JSON.parse(JSON.stringify(e)),
             difs: datosQueNoCuadran(e).map(x => x.campo.k) };
  }, documento);
  afirma('se aplicó una firma', r.parte.aplicadas === 1);
  afirma('el evento quedó confirmado', r.evento.estado === 'confirmado');
  afirma('con la firma del cliente', !!r.evento.firmaCliente);
  afirma('la clave del enlace dejó de existir', !r.evento.tokenFirma);
  afirma('y lo que el cliente escribió quedó congelado en el documento',
    r.evento.datosCliente && r.evento.datosCliente.rfc === 'BBB020202BBB');
  afirma('el cliente quedó ganado para banquetes',
    r.evento.estado === 'confirmado');
  afirma('se marcó la firma como recogida', parcheadas.length === 1);
  afirma('y el CRM nota las dos diferencias con la ficha',
    r.difs.includes('ubicacion') && r.difs.includes('rfc'));

  /* Ahora la pantalla: el aviso con el botón, y que el botón de verdad escriba
     la ficha. Lo que escribió el cliente se queda en el contrato de todos
     modos; la ficha la lleva ventas y a la ficha no le escribe nadie de
     fuera sin que alguien del hotel lo vea. */
  await p.evaluate(() => verEvento('e1'));
  await p.locator('#avisoDC').waitFor({ timeout:5000 });
  const aviso = await p.locator('#avisoDC').innerText();
  afirma('el aviso dice qué corrigió', /Domicilio nuevo de ejemplo 123/.test(aviso));
  afirma('y qué decía la ficha', /la ficha dice|en la ficha está vacío/i.test(aviso));
  await p.locator('#bDCPasar').click();
  const fin = await p.evaluate(() => ({
    ficha: JSON.parse(JSON.stringify(cliente('c1'))),
    visto: !!state.eventos[0].datosVistos,
    aviso: !!document.querySelector('#avisoDC')
  }));
  afirma('el botón pasa el domicilio a la ficha',
    fin.ficha.ubicacion === 'Domicilio nuevo de ejemplo 123');
  afirma('y el RFC', fin.ficha.rfc === 'BBB020202BBB');
  afirma('el aviso no vuelve a salir', fin.visto === true && fin.aviso === false);
  await ctx.close();
  enBuzon = [];
});

/* --- 10 -------------------------------------------------------------------
   El enlace tiene que estar OFRECIDO en la pantalla de enviar, o no existe
   para quien lo necesita. */
await bloque('10 · el ejecutivo encuentra el enlace en «Enviar al cliente»', async () => {
  const { ctx, p } = await crm();
  await p.evaluate(doc => {
    const e = saneaEvento(doc);
    e.firmaCliente = null; e.estado = 'firmado';
    state.eventos = [e]; guardar();
    verEvento('e1');
  }, documento);
  await p.locator('#bEvEnviar').click();
  await p.locator('#evCopiar').waitFor({ timeout:8000 });
  const t = await p.locator('#cuerpoEnvioEv').innerText();
  afirma('ofrece que lo firme en su pantalla', /firme en su pantalla/i.test(t));
  afirma('y le dice que ahí llena sus datos', /domicilio, teléfono, correo y RFC/i.test(t));
  afirma('hay botón de copiar el enlace', await p.locator('#evCopiar').count() === 1);
  /* Copiar es mandar: el estado tiene que moverse. */
  await p.locator('#evCopiar').click();
  await p.waitForTimeout(400);
  const est = await p.evaluate(() => state.eventos[0].estado);
  afirma('copiar el enlace deja el documento como enviado', est === 'enviada');
  await ctx.close();
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
