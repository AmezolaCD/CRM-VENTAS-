/* ===========================================================================
   LO QUE VE EL CLIENTE CUANDO ABRE EL ENLACE DE FIRMA

   Esta pantalla la abre gente de FUERA del hotel, en el teléfono que sea, y
   una sola vez. Si algo le falla ahí, nadie se entera: el cliente cierra la
   página y el convenio se queda sin firmar.

   Lo que se afirma aquí, y por qué:

   1. Los datos van PUESTOS con lo que capturó el ejecutivo. Al cliente no se
      le pide lo que el hotel ya sabe.
   2. Se puede firmar SIN ESCRIBIR NADA. Antes el nombre era obligatorio y sin
      él no se podía firmar.
   3. Si no hay nada que poner —una orden de trabajo— los campos salen a la
      vista y se puede firmar igual.
   4. Si el servidor rechaza la firma, NO se le enseña el error de la base de
      datos ni se le encarga avisarle a nadie. Esto se afirma por AUSENCIA,
      que es la parte que se rompe sola si alguien vuelve a meter letra de
      técnico.

   Cómo correrla:   node pruebas/navegador/firma-del-cliente.mjs
   Necesita playwright y un Chromium; con NODE_PATH se le puede apuntar a uno
   ya instalado. Si se le pasa --fotos, deja las capturas en el directorio
   actual, claro y oscuro, al ancho de un teléfono.

   TODO lo que hay aquí es inventado a propósito: el repositorio es público y
   aquí no entra un dato de ningún cliente de verdad.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8793;
const FOTOS  = process.argv.includes('--fotos');
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CONVENIO = {
  id:'v1', folio:'CV-2026-040', tokenFirma:'laclave', clienteId:'c1',
  fecha:'2026-10-01', vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
  habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                  grupo:'deluxe', publica:5300, convenio:2800 }],
  destinatario:{ empresa:'EMPRESA DE EJEMPLO SA DE CV',
                 contacto:'Juan Pérez', telefono:'664 000 0000' }
};

/* --------------------------------------------------------------------------
   El servidor de mentiras. `estado` dice qué contesta el buzón de firmas:
   201 cuando lo acepta, 401 con el 42501 que vio un cliente de verdad cuando
   la regla no está montada.
   -------------------------------------------------------------------------- */
let estado = 201, destinatario = CONVENIO.destinatario, recibido = null;

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
  if (u.pathname === '/rest/v1/crm_datos')
    return manda(200, [{ id:'convenios:v1',
      datos: Object.assign({}, CONVENIO, { destinatario }) }]);
  if (u.pathname === '/rest/v1/crm_firmas'){
    let cuerpo = '';
    req.on('data', d => cuerpo += d);
    return req.on('end', () => {
      try{ recibido = JSON.parse(cuerpo || '{}'); }catch(e){ recibido = null; }
      if (estado === 201) return manda(201, {});
      manda(401, { code:'42501', details:null, hint:null,
        message:'new row violates row-level security policy for table "crm_firmas"' });
    });
  }
  manda(404, { message:'no existe' });
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

/* Un bloque que se cae no se lleva a los demás: así, al correr esto contra la
   versión ANTERIOR —para comprobar que la prueba de verdad atrapa algo— se ve
   todo lo que falla, no nada más lo primero. */
async function bloque(titulo, fn){
  console.log('\n' + titulo);
  try{ await fn(); }
  catch(ex){ console.log('  FALLA se cayó: ' + String(ex.message).split('\n')[0]); fallas++; }
}

const br = await chromium.launch({ executablePath: CHROME });

/** Abre el enlace como lo abre el cliente y espera a que salga el lienzo. */
async function abrir(tema = 'light'){
  const ctx = await br.newContext({ viewport:{ width:430, height:900 },
    colorScheme: tema, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app#firmar=` + liga);
  await p.locator('#pad').waitFor({ timeout: 15000 });
  return { ctx, p };
}

/* El lienzo escucha eventos de puntero y el ratón de la prueba no siempre se
   los dispara como un dedo: se traza directamente sobre el canvas. */
const trazar = p => p.evaluate(() => {
  const pad = document.querySelector('#pad');
  const g = pad.getContext('2d');
  g.strokeStyle = '#39104e'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(30, 60); g.lineTo(150, 30); g.lineTo(220, 80); g.stroke();
  pad.dataset.trazado = '1';
});

/* --- 1. Los datos van puestos, y «Corregir» los destapa ------------------ */
await bloque('1 · lo que el hotel ya sabe, ya puesto', async () => {
  const { ctx, p } = await abrir();
  afirma('el renglón dice de quién es la firma',
    (await p.locator('#zonaFirma').innerText()).includes('Juan Pérez · 664 000 0000'));
  afirma('los campos arrancan escondidos',
    await p.locator('#cfDatos').count() === 1 && !(await p.locator('#cfDatos').isVisible()));
  if (FOTOS){
    await p.locator('#zonaFirma').scrollIntoViewIfNeeded();
    await p.locator('#zonaFirma').screenshot({ path:'firma-como-llega-claro.png' });
  }
  await p.locator('#cfCorregir').click();
  afirma('«Corregir» los destapa', await p.locator('#cfDatos').isVisible());
  afirma('el nombre viene lleno',  await p.locator('#cfNombre').inputValue() === 'Juan Pérez');
  afirma('el celular viene lleno', await p.locator('#cfCel').inputValue() === '664 000 0000');
  if (FOTOS){
    await p.locator('#zonaFirma').scrollIntoViewIfNeeded();
    await p.locator('#zonaFirma').screenshot({ path:'firma-corregir-claro.png' });
  }
  await ctx.close();
});

/* --- 2. Se firma sin escribir nada --------------------------------------- */
await bloque('2 · firmar sin tocar un solo campo', async () => {
  estado = 201; recibido = null;
  const { ctx, p } = await abrir();
  await trazar(p);
  await p.locator('#cfOk').click();
  await p.locator('.note[style*="--ok"]').waitFor({ timeout: 8000 }).catch(() => {});
  const txt = await p.locator('#firmaCliente').innerText();
  /* Se exige PRIMERO que haya firmado. Sin esto, «saluda por su nombre» pasa
     de a mentiras: el nombre también sale en el cuerpo del convenio, así que
     una pantalla que nunca firmó lo contiene igual. */
  const firmo = /qued[oó] firmada/i.test(txt);
  afirma('la pantalla dice que quedó firmada', firmo);
  afirma('saluda por su nombre', firmo && txt.includes('Juan Pérez'));
  afirma('el nombre llegó al buzón sin que lo escribiera',
    !!recibido && recibido.nombre === 'Juan Pérez');
  afirma('el celular también', !!recibido && recibido.celular === '664 000 0000');
  afirma('la firma va como imagen', !!recibido && /^data:image\/png/.test(recibido.img || ''));
  await ctx.close();
});

/* --- 3. Sin nada que poner, los campos salen a la vista ------------------ */
await bloque('3 · un documento sin destinatario (una orden de trabajo)', async () => {
  destinatario = {}; estado = 201; recibido = null;
  const { ctx, p } = await abrir();
  const hayCampos = await p.locator('#cfDatos').count() === 1;
  afirma('los campos salen a la vista', hayCampos && await p.locator('#cfDatos').isVisible());
  afirma('no hay renglón de confirmación',
    hayCampos && await p.locator('#cfCorregir').count() === 0);
  await trazar(p);
  await p.locator('#cfOk').click();
  await p.waitForTimeout(1200);
  const sinNombre = !!recibido && recibido.nombre === '';
  afirma('se firma igual, con el nombre vacío', sinNombre);
  afirma('y no queda un «Listo, .» suelto',
    sinNombre && !/Listo,\s*\./.test(await p.locator('#firmaCliente').innerText()));
  destinatario = CONVENIO.destinatario;
  await ctx.close();
});

/* --- 4. El rechazo del servidor, sin letra de técnico -------------------- */
for (const tema of ['light', 'dark'])
 await bloque('4 · el servidor rechaza la firma (401 · 42501) · ' + tema, async () => {
  estado = 401; recibido = null;
  const { ctx, p } = await abrir(tema);
  await trazar(p);
  await p.locator('#cfOk').click();
  await p.locator('#cfErr .note, #cfErr .errbox').waitFor({ timeout: 8000 });
  const txt = await p.locator('#cfErr').innerText();
  if (tema === 'light') console.log('     dice: ' + txt.replace(/\s+/g, ' '));
  /* Todo lo de aquí abajo se afirma por AUSENCIA, y una ausencia no vale nada
     si la firma nunca salió: una pantalla que se detuvo antes de depositar
     tampoco dice «firmas.sql». Primero se exige que el depósito haya llegado
     al servidor y haya sido rechazado. */
  const deposito = !!recibido;
  afirma('la firma sí se intentó depositar', deposito);
  afirma('le dice que no es culpa suya',
    deposito && /no es nada que usted haya hecho mal/i.test(txt));
  afirma('NO dice firmas.sql',         deposito && !/firmas\.sql/i.test(txt));
  afirma('NO dice row-level security', deposito && !/row-level|42501|policy/i.test(txt));
  afirma('NO le encarga avisar al hotel', deposito &&
    !/av[ií]s|wa\.me|whatsapp/i.test(txt) && await p.locator('#cfErr a').count() === 0);
  afirma('el botón vuelve a quedar disponible',
    deposito && !(await p.locator('#cfOk').isDisabled()));
  if (FOTOS){
    await p.locator('#zonaFirma').scrollIntoViewIfNeeded();
    await p.locator('#zonaFirma').screenshot({
      path:'firma-rechazada-' + (tema === 'light' ? 'claro' : 'oscuro') + '.png' });
  }
  await ctx.close();
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
