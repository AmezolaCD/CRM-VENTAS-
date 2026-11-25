/* ===========================================================================
   UN TOQUE EN EL LIENZO NO ES UNA FIRMA

   CV-2027-154: el cliente abrió su enlace, le dio a «Firmar» SIN TRAZAR NADA,
   y el convenio se cerró solo. El enlace se apagó —`cerrarConvenio` vacía
   `tokenFirma` en cuanto se firma— y no hubo manera de volvérselo a mandar.
   La «firma» que quedó guardada pesaba 2 142 bytes; la más pequeña de las
   otras treinta y dos del buzón, 4 346. Un lienzo en blanco.

   Entró porque el guardia miraba lo que no debía: `prepararPad` marcaba el
   lienzo como firmado en el `pointerdown`, y el trazo sólo se pinta en el
   `pointermove`. Un toque —o un dedo que roza la pantalla al bajar por la
   página— dejaba el lienzo vacío y marcado como firmado.

   Lo que se afirma aquí:

   1. Tocar el lienzo sin trazar y darle a Firmar NO manda nada, y se dice que
      falta la firma.
   2. Trazando, sí se manda.
   3. El pad del ejecutivo se porta igual: un toque no cuenta.
   4. Un convenio con la firma en blanco ofrece «Quitar la firma y volver a
      mandarlo»; uno firmado de verdad NO lo ofrece.
   5. Al usarlo, el convenio vuelve a quedar firmado por la ejecutiva, con un
      enlace NUEVO, y queda apuntado en la bitácora.
   6. Y entonces vuelve a salir «Enviar al cliente».
   7. Por la puerta de atrás tampoco: «Aplicar esta firma» rechaza una en blanco.

   Cómo correrla:  node pruebas/navegador/un-toque-no-es-una-firma.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8904;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

const CONVENIO = {
  id:'v1', folio:'CV-2027-154', tokenFirma:'laclave', clienteId:'c1',
  fecha:'2026-10-01', vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
  estado:'firmado_ejecutiva',
  firmaHotel:{ nombre:'Ejecutivo de ejemplo' },
  habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                  grupo:'deluxe', publica:5300, convenio:2800 }],
  destinatario:{ empresa:'EMPRESA DE EJEMPLO SA DE CV',
                 contacto:'Juan Pérez', telefono:'664 000 0000' }
};

let recibido = null;              // lo que llegó al buzón de firmas

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const manda = (c, b) => {
    res.writeHead(c, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*' });
    res.end(JSON.stringify(b));
  };
  if (req.method === 'OPTIONS') return manda(200, {});
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/rest/v1/rpc/crm_buzon_ok') return manda(200, true);
  if (u.pathname === '/rest/v1/crm_datos')
    return manda(200, [{ id:'convenios:v1', tipo:'convenios', borrado:false,
      actualizado:'2026-11-01T00:00:00.000Z', datos: CONVENIO }]);
  if (u.pathname === '/rest/v1/crm_firmas'){
    if (req.method !== 'POST') return manda(200, []);
    let cuerpo = '';
    req.on('data', d => cuerpo += d);
    return req.on('end', () => {
      try{ recibido = JSON.parse(cuerpo || '{}'); }catch(e){ recibido = null; }
      manda(201, {});
    });
  }
  manda(200, []);
});
await new Promise(r => srv.listen(PUERTO, '127.0.0.1', r));

const liga = Buffer.from(JSON.stringify({ v:'v1', d:'convenios', t:'laclave',
    u:'http://127.0.0.1:' + PUERTO, k:'llave-de-mentiras' }))
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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

/** Abre el enlace como lo abre el cliente, en un teléfono. */
async function abrirComoCliente(){
  const ctx = await br.newContext({ viewport:{ width:430, height:900 }, hasTouch:true });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app#firmar=` + liga);
  await p.locator('#pad').waitFor({ timeout: 15000 });
  return { ctx, p };
}

/** Traza de verdad sobre el lienzo. */
const trazar = p => p.evaluate(() => {
  const pad = document.querySelector('#pad');
  const g = pad.getContext('2d');
  g.strokeStyle = '#39104e'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(30, 60); g.lineTo(150, 30); g.lineTo(220, 80); g.stroke();
});

await bloque('1 · tocar el lienzo sin trazar no manda nada', async () => {
  recibido = null;
  const { ctx, p } = await abrirComoCliente();
  /* Un toque de verdad: pointerdown y pointerup sin mover, que es lo que hace
     un dedo que roza la pantalla. Va por el `locator` y no por coordenadas
     porque el lienzo vive al final de una página larga: tirando a unas
     coordenadas sueltas el toque cae fuera y la prueba no prueba nada —pasó en
     el primer intento, y pasaba contra las DOS versiones—. */
  await p.locator('#pad').tap();
  afirma('el toque sí llegó al lienzo',
    await p.evaluate(() => document.querySelector('#pad').dataset.trazado) === 'sí');
  await p.locator('#cfOk').click();
  await p.waitForTimeout(600);
  afirma('no se mandó nada al buzón',   recibido === null);
  const err = await p.locator('#cfErr').innerText();
  afirma('y se dice que falta la firma', /falta su firma/i.test(err));
  afirma('explicando que tocar no basta', /tocarlo no basta/i.test(err));
  await ctx.close();
});

await bloque('2 · trazando sí se manda', async () => {
  recibido = null;
  const { ctx, p } = await abrirComoCliente();
  await trazar(p);
  await p.locator('#cfOk').click();
  for (let i = 0; i < 100 && !recibido; i++) await p.waitForTimeout(100);
  afirma('la firma llegó al buzón',     !!recibido);
  afirma('con su imagen dentro',        !!(recibido && recibido.img));
  await ctx.close();
});

/* --- lo del lado del hotel ------------------------------------------------ */
const ctxH = await br.newContext({ viewport:{ width:1100, height:950 } });
const ph = await ctxH.newPage();
ph.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
ph.on('dialog', d => d.accept().catch(() => {}));
await ph.goto(`http://127.0.0.1:${PUERTO}/app`);
/* Sin cortar si falta: contra el index.html de antes esta función no existe, y
   lo que se quiere ver entonces es TODO lo que falla, no el primer tropiezo. */
await ph.waitForFunction(() => typeof padFirmado === 'function', null, { timeout:15000 })
  .catch(() => console.log('  (esta versión no tiene padFirmado)'));

/* Una firma de verdad y una en blanco, las dos como PNG, para poder compararlas
   con el mismo criterio con el que las mira el CRM. */
const PNGS = await ph.evaluate(() => {   // dos firmas de mentiras para comparar
  const haz = pintar => {
    const cv = document.createElement('canvas');
    cv.width = 300; cv.height = 120;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    if (pintar){
      g.strokeStyle = '#39104e'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(20, 80); g.lineTo(120, 25); g.lineTo(240, 90); g.stroke();
    }
    return cv.toDataURL('image/png');
  };
  return { buena: haz(true), blanca: haz(false) };
});

await bloque('3 · el pad del ejecutivo también mira la tinta', async () => {
  const r = await ph.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 300; cv.height = 120;
    cv.dataset.trazado = 'sí';            // como lo dejaba un toque
    const tocado = padFirmado(cv);
    const g = cv.getContext('2d');
    g.strokeStyle = '#39104e'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(20, 80); g.lineTo(120, 25); g.lineTo(240, 90); g.stroke();
    return { tocado, trazado: padFirmado(cv) };
  });
  afirma('un lienzo tocado pero vacío NO cuenta', r.tocado === false);
  afirma('y uno trazado sí',                      r.trazado === true);
});

/** Deja el CRM con el convenio cerrado por la firma que se le diga. */
const prepararCarta = (img) => ph.evaluate(([img, CONVENIO, firmaDelHotel]) => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  nube.url = ''; nube.anon = ''; nube.sesion = null; nube.estado = 'local';
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
    contacto:'Juan Pérez', telefono:'6640000000', email:'uno@ejemplo.example',
    estatus:'ganado' })];
  /* La firma del hotel lleva imagen a propósito: `saneaFirma` tira una firma
     sin trazo, y sin firma del hotel la carta ofrece «Firmar como ejecutivo»
     en vez de «Enviar al cliente». */
  state.convenios = [saneaConv(Object.assign({}, CONVENIO, {
    estado:'firmado_cliente', tokenFirma:'',
    firmaHotel:{ nombre:'Carmen de ejemplo', puesto:'Ejecutiva', celular:'',
                 fecha:'2026-10-22T00:00:00.000Z', img: firmaDelHotel },
    firmaEmpresa:{ nombre:'Juan Pérez', puesto:'', celular:'',
                   fecha:'2026-11-25T17:14:23.050Z', img } }))];
  state.actividades = [];
  guardar();
  verConvenio('v1');
}, [img, CONVENIO, PNGS.buena]);

const esperarBoton = async () => {
  for (let i = 0; i < 60; i++){
    if (await ph.locator('#bCvSinFirma').count()
        && await ph.locator('#bCvSinFirma').isVisible()) return true;
    await ph.waitForTimeout(100);
  }
  return false;
};

await bloque('4 · el botón sale con la firma en blanco, y NO con una de verdad', async () => {
  await prepararCarta(PNGS.buena);
  afirma('con una firma de verdad NO se ofrece quitarla', await esperarBoton() === false);
  await prepararCarta(PNGS.blanca);
  afirma('con el lienzo en blanco sí se ofrece',          await esperarBoton() === true);
});

await bloque('5 · al quitarla, vuelve a quedar mandable', async () => {
  const antes = await ph.evaluate(() => state.convenios[0].tokenFirma);
  await ph.locator('#bCvSinFirma').click();
  await ph.waitForTimeout(600);
  const r = await ph.evaluate(() => ({
    estado: state.convenios[0].estado,
    firma:  !!state.convenios[0].firmaEmpresa,
    token:  state.convenios[0].tokenFirma,
    bitacora: state.actividades.map(a => a.asunto)
  }));
  afirma('se quitó la firma en blanco',       r.firma === false);
  afirma('vuelve a estar firmado por la ejecutiva', r.estado === 'firmado_ejecutiva');
  afirma('con un enlace NUEVO',               !!r.token && r.token !== antes);
  afirma('y queda apuntado en la bitácora',
    r.bitacora.some(t => /se quit[óo] una firma en blanco/i.test(t)));
});

await bloque('6 · y vuelve a salir «Enviar al cliente»', async () => {
  /* La carta se cierra y se vuelve a abrir al quitar la firma, así que hay que
     esperar a que se repinte: mirarlo en el acto medía el reloj. */
  let hay = 0;
  for (let i = 0; i < 60 && !hay; i++){
    hay = await ph.locator('#bEnviar').count();
    if (!hay) await ph.waitForTimeout(100);
  }
  afirma('el botón de enviar está de vuelta', hay === 1);
  afirma('y el de quitar la firma ya no',     await ph.locator('#bCvSinFirma').count() === 0);
});

await bloque('7 · «Aplicar esta firma» rechaza una en blanco', async () => {
  const r = await ph.evaluate(async blanca => {
    const cv = document.createElement('canvas');
    cv.width = 10; cv.height = 10;
    return { blanca: await firmaEnBlanco(blanca), nada: await firmaEnBlanco('') };
  }, PNGS.blanca);
  afirma('el CRM la reconoce como lienzo en blanco', r.blanca === true);
  afirma('y «sin firma» no es lo mismo que «en blanco»', r.nada === false);
  const buena = await ph.evaluate(b => firmaEnBlanco(b), PNGS.buena);
  afirma('una firma de verdad no se confunde',  buena === false);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
