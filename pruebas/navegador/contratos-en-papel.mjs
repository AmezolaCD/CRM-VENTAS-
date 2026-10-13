/* ===========================================================================
   LOS CONTRATOS SE FIRMAN EN PAPEL

   Marco, después de verlo con su departamento legal: «sólo sistemas
   certificados pueden utilizar firmas digitales, así que vamos a tener que
   quitar las firmas digitales en los contratos, sólo en los contratos».

   Tienen razón en el fondo: una firma trazada con el dedo —venga del lienzo
   del mostrador o del enlace que el cliente abre en su teléfono— es firma
   electrónica SIMPLE. La avanzada, que hace prueba plena, sólo la emite un
   prestador de servicios de certificación autorizado. Y el contrato de
   banquetes está REGISTRADO EN PROFECO.

   Lo que esta prueba cuida, y por qué cada cosa:

   · Que al CONTRATO no se le pueda sacar una firma por ningún camino: ni el
     lienzo, ni el enlace, ni el buzón, ni un enlace viejo que alguien haya
     guardado. Quitar el botón no es quitar la función.
   · Que el documento impreso salga con el espacio de firma EN BLANCO, y que
     una firma trazada de antes no se dibuje: enseñarla haría creer que vale.
   · Que el contrato siga teniendo su folio y su camino completo —emitir,
     imprimir, subir el escaneado—, porque si no, no se puede trabajar.
   · Y que las COTIZACIONES, que son el grupo de control, sigan firmándose en
     pantalla exactamente como antes. «Sólo en los contratos» quiere decir
     sólo en los contratos.

   Cómo correrla:  node pruebas/navegador/contratos-en-papel.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8816;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const LEGALES = {
  razonSocial:'RAZÓN SOCIAL DE EJEMPLO S.A. DE C.V.',
  representante:'Representante de ejemplo', rfc:'XAXX010101000',
  escritura:'número 1 de ejemplo', domicilioFiscal:'Domicilio fiscal de ejemplo',
  banco:'Banco de ejemplo', cuenta:'0000000000', clabe:'000000000000000000',
  registroProfeco:'0000/2026', multaFumar:'20,000'
};

const FIRMA = { nombre:'Quien firma de ejemplo', puesto:'Banquetes', celular:'',
                img:'data:image/png;base64,iVBORw0KGgo=' };

let documento = null;     // lo que el servidor de mentiras le sirve al cliente
let recibidas = [];
let enBuzon = [];
let contador = {};

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const manda = (c, b) => {
    res.writeHead(c, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
      'Access-Control-Allow-Methods':'*' });
    res.end(JSON.stringify(b));
  };
  const cuerpoDe = cb => { let t = ''; req.on('data', d => t += d); req.on('end', () => cb(t)); };
  if (req.method === 'OPTIONS') return manda(200, {});
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  /* El contador de folios del hotel. Va de verdad —cuenta— porque en esta
     prueba el folio NO es decorado: emitir es lo que lo aparta, y si se le
     diera uno de regalo al documento no se estaría midiendo nada. */
  if (u.pathname === '/rest/v1/rpc/crm_aparta_folio'){
    return cuerpoDe(t => {
      let d = {};
      try{ d = JSON.parse(t || '{}'); }catch(e){}
      contador[d.p_tipo] = (contador[d.p_tipo] || 0) + 1;
      res.writeHead(200, { 'Content-Type':'application/json',
        'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*' });
      res.end(JSON.stringify(`${d.p_prefijo}-${d.p_anio}-${
        String(contador[d.p_tipo]).padStart(3, '0')}`));
    });
  }
  if (u.pathname === '/rest/v1/crm_folios') return manda(200, [{ tipo:'contratos' }]);
  if (u.pathname === '/rest/v1/rpc/crm_buzon_ok'){
    res.writeHead(200, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*' });
    return res.end('true');
  }
  if (u.pathname === '/rest/v1/crm_datos'){
    /* La pantalla del cliente pide UN renglón por su id. A la bajada completa
       del CRM se le contesta vacío: este servidor no guarda nada y si le
       devolviera algo le pondría encima una copia vieja al estado del bloque. */
    if (req.method !== 'GET') return manda(201, {});
    const uno = String(u.searchParams.get('id') || '');
    /* Con la clave equivocada se contesta VACÍO, que es lo que hace la regla
       del servidor de verdad: el renglón no existe para quien no la trae. */
    const clave = req.headers['x-firma-token'] || '';
    if (uno.startsWith('eq.') && documento && clave && clave === documento.tokenFirma)
      return manda(200, [{ id:uno.slice(3), datos:documento }]);
    return manda(200, []);
  }
  if (u.pathname === '/rest/v1/crm_firmas'){
    if (req.method === 'GET')   return manda(200, enBuzon);
    if (req.method === 'PATCH') return cuerpoDe(() => manda(204, {}));
    return cuerpoDe(t => { try{ recibidas.push(JSON.parse(t || '{}')); }catch(e){} manda(201, {}); });
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
 * El CRM con la nube puesta y la sesión abierta.
 *
 * Se le PARA la sincronización: este servidor de mentiras no guarda nada, así
 * que cada sondeo contestaría «la nube está vacía» y a los pocos segundos le
 * pondría encima un estado en blanco a lo que el bloque acaba de cambiar. La
 * sincronización tiene sus propias pruebas. Lo que no se apaga es
 * `recogerFirmas`, que es parte de lo que aquí se mide y se llama a mano.
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
    // El administrador alcanza las dos áreas y el CRM le pregunta en cuál
    // entra; esa pantalla se pone encima de todo lo demás.
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

/** Mete un evento de banquetes recién capturado. */
const meteEvento = (p, tipo, id) => p.evaluate(({ t, i }) => {
  const e = saneaEvento({ id:i, tipo:t, clienteId:'c1', ejecutivo:'Sistemas',
    fecha:'2026-10-08', titulo:'Evento de ejemplo', garantiaPax:'150', anticipo:30000,
    bloques:[saneaBloqueEv({ fecha:'2026-11-20', horario:'08:00-11:00', evento:'Desayuno',
                             pax:'150', salon:'Salón de ejemplo', horas:'3' })],
    lineas:[saneaLineaEv({ servicio:'Desayuno de ejemplo', cantidad:150, precio:400,
                           conServicio:true })] });
  state.eventos = [e]; guardar();
  return JSON.parse(JSON.stringify(e));
}, { t:tipo, i:id });

function ligaDe(doc, tipo, token){
  const d = { v: doc.id, d: tipo, t: token === undefined ? doc.tokenFirma : token,
              u:'http://127.0.0.1:' + PUERTO, k:'llave-de-mentiras' };
  return Buffer.from(JSON.stringify(d)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function comoCliente(doc, tipo, token){
  const ctx = await br.newContext({ viewport:{ width:430, height:900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app#firmar=` + ligaDe(doc, tipo, token));
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
   Emitir es lo que hace que el contrato deje de ser borrador. Tiene que dar
   folio y congelar el papel, igual que antes daba la firma; lo que NO puede
   dar es una clave de enlace. */
await bloque('1 · el contrato se EMITE: folio y papel congelado, sin clave de enlace', async () => {
  const { ctx, p } = await crm();
  await meteEvento(p, 'contrato', 'e1');
  const r = await p.evaluate(async () => {
    const e = state.eventos[0];
    const ok = await emitirEvento(e, null);
    return { ok, evento: JSON.parse(JSON.stringify(e)) };
  });
  afirma('se emitió', r.ok === true);
  afirma('con su folio de la serie CB', /^CB-/.test(r.evento.folio || ''));
  afirma('dejó de ser borrador', r.evento.estado === 'firmado');
  afirma('y en pantalla eso se llama «Emitido»',
    await p.evaluate(() => estadoDoc(ESTADOS_EV, state.eventos[0]).name) === 'Emitido');
  afirma('NO nació ninguna clave de enlace', !r.evento.tokenFirma);
  afirma('nadie firmó nada', !r.evento.firmaHotel && !r.evento.firmaCliente);
  afirma('la razón social quedó congelada',
    r.evento.datosHotel && r.evento.datosHotel.razonSocial === LEGALES.razonSocial);
  afirma('y el destinatario también',
    r.evento.destinatario && r.evento.destinatario.rfc === 'AAA010101AAA');
  documento = r.evento;
  await ctx.close();
});

/* --- 2 -------------------------------------------------------------------- */
await bloque('2 · la pantalla del contrato no ofrece ni lienzo ni enlace', async () => {
  const { ctx, p } = await crm();
  await p.evaluate(doc => { state.eventos = [saneaEvento(doc)]; guardar(); verEvento('e1'); },
    documento);
  const foot = await p.locator('.modal-foot').innerText();
  afirma('no dice «Firmar»', !/Firmar/i.test(foot));
  afirma('no hay botón de firma del hotel',    await p.locator('#bEvF1').count() === 0);
  afirma('no hay botón de firma del cliente',  await p.locator('#bEvF2').count() === 0);
  afirma('no hay botón de rehacer el enlace',  await p.locator('#bEvLiga').count() === 0);
  afirma('sí ofrece registrar la firma en papel',
    await p.locator('#bEvPapel').count() === 1);
  afirma('y mandárselo al cliente', await p.locator('#bEvEnviar').count() === 1);
  await ctx.close();
});

/* --- 3 --------------------------------------------------------------------
   El papel que se imprime. Si sale con una firma dibujada, alguien va a creer
   que ya está firmado. */
await bloque('3 · el documento sale con el espacio de firma en blanco', async () => {
  const { ctx, p } = await crm();
  const r = await p.evaluate(doc => {
    const e = saneaEvento(doc);
    /* Un contrato de los de antes, con las dos firmas trazadas dentro. Es el
       caso que importa: el dato sigue ahí y NO se debe dibujar. */
    e.firmaHotel   = saneaFirma({ nombre:'Alguien', fecha:'2026-10-01T00:00:00Z',
                                  img:'data:image/png;base64,TRAZOHOTEL' });
    e.firmaCliente = saneaFirma({ nombre:'Otro', fecha:'2026-10-02T00:00:00Z',
                                  img:'data:image/png;base64,TRAZOCLIENTE' });
    state.eventos = [e]; guardar();
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${docEvento(e, cliente('c1'))}</div>`;
    const res = { html: caja.innerHTML,
                  rayas: caja.querySelectorAll('.firmas .cv.cv-papel').length,
                  imgs:  caja.querySelectorAll('.firmas img').length };
    verEvento('e1');
    res.aviso = (document.querySelector('.modal-body .note.warn') || {}).innerText || '';
    return res;
  }, documento);
  afirma('los dos espacios de firma van en blanco', r.rayas === 2);
  afirma('no se dibuja ninguna firma', r.imgs === 0);
  afirma('ni se cuela la imagen guardada', !/TRAZOHOTEL|TRAZOCLIENTE/.test(r.html));
  afirma('y no dice «Pendiente de firma», que sonaba a que faltaba en pantalla',
    !/Pendiente de firma/.test(r.html));
  afirma('al ejecutivo se le avisa de la firma vieja',
    /firma trazada de antes/i.test(r.aviso) && /papel/i.test(r.aviso));
  await ctx.close();
});

/* --- 4 --------------------------------------------------------------------
   El apagador. Mientras la clave viva dentro del documento, el servidor se lo
   sirve a cualquiera que tenga el enlace, y ésos ya andan por WhatsApp. */
await bloque('4 · un contrato guardado con clave la pierde al cargarlo', async () => {
  const { ctx, p } = await crm();
  const r = await p.evaluate(() => ({
    evento:    saneaEvento({ id:'x1', tipo:'contrato',   tokenFirma:'laclavevieja' }).tokenFirma || '',
    cotizacion:saneaEvento({ id:'x2', tipo:'cotizacion', tokenFirma:'laclavevieja' }).tokenFirma || '',
    contratoCt:saneaContrato({ id:'k1', tipo:'contrato',   tokenFirma:'laclavevieja' }).tokenFirma,
    cotizaCt:  saneaContrato({ id:'k2', tipo:'cotizacion', tokenFirma:'laclavevieja' }).tokenFirma
  }));
  afirma('al contrato de banquetes se le borra',  r.evento === '');
  afirma('al contrato de hospedaje también',      r.contratoCt === '');
  afirma('a la cotización de evento NO',          r.cotizacion === 'laclavevieja');
  afirma('y a la de hospedaje tampoco',           r.cotizaCt === 'laclavevieja');
  await ctx.close();
});

/* --- 5 --------------------------------------------------------------------
   Alguien guardó el enlace antes de todo esto y lo abre hoy. Entre que el CRM
   le borra la clave y que eso sube al servidor hay una rendija, y por ahí no
   puede firmar. */
await bloque('5 · con un enlace viejo, el cliente no firma: se le dice que es en papel', async () => {
  recibidas = [];
  const viejo = Object.assign({}, documento, { tokenFirma:'laclavevieja' });
  documento = viejo;
  const { ctx, p } = await comoCliente(viejo, 'eventos', 'laclavevieja');
  await p.locator('#zonaFirma .note').waitFor({ timeout:15000 });
  const t = await p.locator('#zonaFirma').innerText();
  afirma('no hay lienzo que firmar', await p.locator('#pad').count() === 0);
  afirma('se le dice que el contrato se firma en papel', /se firma en papel/i.test(t));
  afirma('y que no es culpa suya', /no algo que usted haya hecho mal/i.test(t));
  afirma('sí puede bajarlo para imprimirlo', await p.locator('#bBajarCli').count() === 1);
  afirma('y no se depositó ninguna firma', recibidas.length === 0);
  await ctx.close();
});

/* --- 6 --------------------------------------------------------------------
   Y si una firma alcanzó a quedarse en el buzón, el CRM no la aplica. */
await bloque('6 · el buzón no le aplica una firma a un contrato', async () => {
  enBuzon = [{ id:7, convenio_id:'eventos:e1', token:'laclavevieja', nombre:'Cliente de prueba',
               puesto:'', celular:'', img:'data:image/png;base64,iVBORw0KGgo=',
               creado:'2026-10-08T18:00:00Z', aplicada:false }];
  const { ctx, p } = await crm();
  const r = await p.evaluate(async doc => {
    state.eventos = [saneaEvento(doc)]; guardar();
    const parte = await recogerFirmas();
    return { parte, evento: JSON.parse(JSON.stringify(state.eventos[0])) };
  }, documento);
  afirma('no se aplicó ninguna', r.parte.aplicadas === 0);
  afirma('el contrato sigue sin firma del cliente', !r.evento.firmaCliente);
  afirma('y se explica por qué, con qué hacer',
    r.parte.notas.some(n => /se firman en papel/i.test(n) && /Registrar que se firmó en papel/i.test(n)));
  enBuzon = [];
  await ctx.close();
});

/* --- 7 --------------------------------------------------------------------
   El camino que sí existe: imprimir, firmar y subir el escaneado. */
await bloque('7 · subir el escaneado cierra el contrato y gana al cliente', async () => {
  const { ctx, p } = await crm();
  const r = await p.evaluate(async doc => {
    const e = saneaEvento(doc);
    state.eventos = [e]; guardar();
    subirEventoFirmado(e, null);
    // El archivo se arma a mano: lo que se prueba es qué deja, no el <input>.
    const manual = saneaManual({ fecha:new Date().toISOString(), quien:'Sistemas',
      archivo:'contrato-firmado.pdf', pdf:'data:application/pdf;base64,AAAA',
      tam:1234, tipoMime:'application/pdf' });
    e.firmaManual = manual;
    aceptaElCliente(e, null, 'Firmado en papel. Se subió el archivo "contrato-firmado.pdf".');
    guardar();
    return { evento: JSON.parse(JSON.stringify(e)),
             cliente: JSON.parse(JSON.stringify(cliente('c1'))),
             bitacora: state.actividades.map(a => a.asunto + ' · ' + (a.notas || '')) };
  }, documento);
  afirma('el contrato quedó confirmado', r.evento.estado === 'confirmado');
  afirma('con el escaneado como constancia',
    !!r.evento.firmaManual && r.evento.firmaManual.archivo === 'contrato-firmado.pdf');
  afirma('y SIN firma trazada', !r.evento.firmaCliente);
  afirma('el cliente quedó ganado para banquetes', r.cliente.estatusBq === 'ganado');
  afirma('y queda escrito que fue en papel',
    r.bitacora.some(x => /Firmado en papel/.test(x)));
  await ctx.close();
});

/* --- 8 -------------------------------------------------------------------- */
await bloque('8 · «Enviar al cliente» no ofrece enlace y dice qué hacer', async () => {
  const { ctx, p } = await crm();
  await p.evaluate(doc => { state.eventos = [saneaEvento(doc)]; guardar(); verEvento('e1'); },
    documento);
  await p.locator('#bEvEnviar').click();
  await p.locator('#evBajar').waitFor({ timeout:8000 });
  const t = await p.locator('#cuerpoEnvioEv').innerText();
  afirma('no hay botón de copiar el enlace', await p.locator('#evCopiar').count() === 0);
  afirma('dice que se firma en papel', /se firma en papel/i.test(t));
  afirma('y a dónde volver con el firmado', /Registrar que se firmó en papel/i.test(t));
  afirma('sin inventarse que «falta que lo firme el hotel»',
    !/enlace de firma no está disponible/i.test(t));
  await ctx.close();
});

/* --- 9 --------------------------------------------------------------------
   El grupo de control. «Sólo en los contratos» quiere decir sólo en los
   contratos: si esto se pone rojo, se quitó de más. */
await bloque('9 · la COTIZACIÓN de evento se sigue firmando en pantalla', async () => {
  recibidas = [];
  const { ctx, p } = await crm();
  await meteEvento(p, 'cotizacion', 'q1');
  const r = await p.evaluate(async () => {
    const e = state.eventos[0];
    await firmarEvento(e, 'hotel', { nombre:'Quien firma de ejemplo', puesto:'Banquetes',
      celular:'', img:'data:image/png;base64,iVBORw0KGgo=' });
    verEvento('q1');
    return { evento: JSON.parse(JSON.stringify(e)),
             pad: !!document.querySelector('#bEvF2'),
             emitir: !!document.querySelector('#bEvEmitir') };
  });
  afirma('la firma del hotel sí se guarda', !!r.evento.firmaHotel);
  afirma('y nace su clave de enlace', !!r.evento.tokenFirma);
  afirma('la pantalla sigue ofreciendo el lienzo del cliente', r.pad === true);
  afirma('y no le pone «Emitir y numerar»', r.emitir === false);
  await ctx.close();

  // Y el cliente la firma desde su enlace, como siempre.
  documento = r.evento;
  const b = await comoCliente(r.evento, 'eventos');
  await b.p.locator('#pad').waitFor({ timeout:15000 });
  afirma('el cliente sí puede firmarla desde el enlace', true);
  await trazar(b.p);
  await b.p.locator('#cfOk').click();
  await b.p.waitForFunction(() =>
    /qued[oó] firmad/i.test(document.querySelector('#firmaCliente').innerText),
    null, { timeout:8000 });
  afirma('y su firma llega al buzón',
    recibidas.length === 1 && recibidas[0].convenio_id === 'eventos:q1');
  await b.ctx.close();
});

/* --- 10 ------------------------------------------------------------------- */
await bloque('10 · el contrato de HOSPEDAJE, lo mismo', async () => {
  const { ctx, p } = await crm();
  const r = await p.evaluate(async () => {
    const k = saneaContrato({ id:'k1', tipo:'contrato', clienteId:'c1', ejecutivo:'Sistemas',
      fecha:'2026-10-08', titulo:'Grupo de ejemplo' });
    state.contratos = [k]; guardar();
    const ok = await emitirContrato(k, null);
    verContrato('k1');
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
    return { ok, contrato: JSON.parse(JSON.stringify(k)),
             foot: document.querySelector('.modal-foot').innerText,
             papel: !!document.querySelector('#bCtPapel'),
             pad:   !!document.querySelector('#bCtF1') || !!document.querySelector('#bCtF2'),
             liga:  !!document.querySelector('#bCtLiga'),
             rayas: caja.querySelectorAll('.firmas .cv.cv-papel').length };
  });
  afirma('se emite con su folio CT', r.ok === true && /^CT-/.test(r.contrato.folio || ''));
  afirma('sin clave de enlace', !r.contrato.tokenFirma);
  afirma('sin lienzo', r.pad === false);
  afirma('sin enlace', r.liga === false);
  afirma('con el camino de papel', r.papel === true);
  afirma('y el documento con los espacios en blanco', r.rayas === 2);
  await ctx.close();
});

/* --- 11 ------------------------------------------------------------------- */
await bloque('11 · el contrato que sale de una cotización nace limpio', async () => {
  const { ctx, p } = await crm();
  const r = await p.evaluate(async () => {
    const cot = saneaEvento({ id:'c9', tipo:'cotizacion', clienteId:'c1', ejecutivo:'Sistemas',
      fecha:'2026-10-08', titulo:'Evento de ejemplo' });
    state.eventos = [cot]; guardar();
    await firmarEvento(cot, 'hotel', { nombre:'Quien firma de ejemplo', puesto:'Banquetes',
      celular:'', img:'data:image/png;base64,iVBORw0KGgo=' });
    pasarAContratoBq(cot, null);
    const k = state.eventos.find(x => x.cotizacionId === 'c9');
    return { clave: cot.tokenFirma, nuevo: JSON.parse(JSON.stringify(saneaEvento(k))) };
  });
  afirma('la cotización sí tiene su clave', !!r.clave);
  afirma('el contrato nuevo NO la hereda', !r.nuevo.tokenFirma);
  afirma('ni hereda los datos congelados de la otra', !r.nuevo.datosHotel);
  afirma('ni su folio', !r.nuevo.folio);
  await ctx.close();
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
