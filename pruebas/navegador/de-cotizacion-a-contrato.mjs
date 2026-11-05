/* ===========================================================================
   CO PARA COTIZAR, CT PARA CONTRATAR · Y EL MISMO NÚMERO

   Marco: «quiero que el folio de cotizaciones sea CO-yyyy-00X, y que de la
   cotización CO-2026-001 pase a contrato CT-2026-001».

   Lo que hay detrás de esa frase: dos letras y UN SOLO NÚMERO. El contador
   del hotel sigue siendo uno por año para toda la serie de hospedaje, y lo
   único que cambia es la letra según lo que sea el documento. Con dos
   contadores separados el ejemplo de Marco no se podría cumplir: el
   CT-2026-001 ya sería de otro trato.

   Lo que se cuida aquí:

   · que una cotización nueva se numere CO y un contrato CT;
   · que el contador no reparta el mismo número a una CO y a un CT distintos;
   · que al pasar a contrato se conserve el número y SÓLO cambie la letra;
   · que la cotización se quede —es lo que el cliente recibió— y que su
     dinero NO se cuente dos veces en el reporte de ingresos;
   · que no se pueda convertir dos veces;
   · y el grupo de control: las cotizaciones viejas, con CT, no se tocan.

   Cómo correrla:  node pruebas/navegador/de-cotizacion-a-contrato.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8864;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium';
const ANIO   = new Date().getFullYear();

/* El contador del hotel, de mentiras pero con su regla: reparte de uno en
   uno por (tipo, año) y nunca repite, sin importar la letra que le pidan. */
const servidor = { libro: [] };
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
  if (u.pathname === '/rest/v1/rpc/crm_aparta_folio'){
    let cuerpo = '';
    req.on('data', d => cuerpo += d);
    return req.on('end', () => {
      const pp = JSON.parse(cuerpo || '{}');
      const suyos = servidor.libro.filter(x => x.tipo === pp.p_tipo && x.anio === pp.p_anio);
      const n = suyos.reduce((m, x) => Math.max(m, x.numero), 0) + 1;
      const folio = `${pp.p_prefijo}-${pp.p_anio}-${String(n).padStart(3, '0')}`;
      servidor.libro.push({ tipo:pp.p_tipo, anio:pp.p_anio, numero:n, folio, quien:'' });
      manda(200, folio);
    });
  }
  if (u.pathname === '/rest/v1/rpc/crm_anota_folio'){ req.resume(); return manda(200, null); }
  if (u.pathname === '/rest/v1/crm_datos')
    return manda(req.method === 'GET' ? 200 : 201, req.method === 'GET' ? [] : {});
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
let ctx, p;
async function equipo(docs){
  if (ctx) await ctx.close().catch(() => {});
  ctx = await br.newContext();
  p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app`);
  await p.waitForFunction(() => typeof emitirContrato === 'function', null, { timeout:15000 });
  await p.evaluate(({ d, anio }) => {
    nube.url = location.origin; nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio', user:{ email:'admin@ejemplo.example' } };
    nube.ultimo = ''; nube.sinFolios = false;
    state.usuarios = [saneaUsuario({ id:'u1', correo:'admin@ejemplo.example',
      nombre:'Quien Sea', rol:'admin' })];
    state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
      ejecutivo:'Quien Sea', estatus:'nuevo' })];
    state.contratos = (d || []).map(saneaContrato);
    guardar();
    if (typeof ponDepto === 'function') ponDepto('ventas');
  }, { d: docs, anio: ANIO });
  await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelectorAll('.overlay').forEach(o => o.remove()));
}

const folios = () => p.evaluate(() => state.contratos.map(k => ({
  id:k.id, folio:k.folio, tipo:k.tipo, estado:k.estado, de:k.cotizacionId || '' })));

/* --- 1 ---------------------------------------------------------------------
   La letra que pidió Marco. */
await bloque('1 · una cotización se numera CO y un contrato CT', async () => {
  servidor.libro = [];
  await equipo([
    { id:'k1', tipo:'cotizacion', clienteId:'c1', fecha:`${ANIO}-02-01`, estado:'borrador' },
    { id:'k2', tipo:'contrato',   clienteId:'c1', fecha:`${ANIO}-02-02`, estado:'borrador' }]);

  await p.evaluate(() => emitirContrato(state.contratos[0], null));
  await p.evaluate(() => emitirContrato(state.contratos[1], null));
  const ks = await folios();
  afirma('LA COTIZACIÓN LLEVA CO', ks[0].folio === `CO-${ANIO}-001`);
  afirma('EL CONTRATO LLEVA CT',   ks[1].folio === `CT-${ANIO}-002`);
  afirma('y el contador no repitió el número', ks[0].folio !== ks[1].folio);
});

/* --- 2 ---------------------------------------------------------------------
   EL CASO DE MARCO. */
await bloque('2 · al pasar a contrato conserva el número y cambia la letra', async () => {
  servidor.libro = [];
  await equipo([{ id:'k1', tipo:'cotizacion', clienteId:'c1', fecha:`${ANIO}-02-01`,
                  estado:'borrador' }]);
  await p.evaluate(() => emitirContrato(state.contratos[0], null));
  afirma('la cotización quedó en CO-001', (await folios())[0].folio === `CO-${ANIO}-001`);

  p.once('dialog', d => d.accept());        // el aviso de «¿Continuar?»
  await p.evaluate(() => pasarAContratoCt(state.contratos[0]));
  await p.waitForTimeout(400);

  const ks = await folios();
  const cot = ks.find(x => x.tipo === 'cotizacion');
  const ct  = ks.find(x => x.tipo === 'contrato');
  afirma('AHORA HAY DOS DOCUMENTOS', ks.length === 2);
  afirma('EL CONTRATO ES CT CON EL MISMO NÚMERO', !!ct && ct.folio === `CT-${ANIO}-001`);
  afirma('y la cotización se queda como estaba', !!cot && cot.folio === `CO-${ANIO}-001`);
  afirma('el contrato sabe de qué cotización salió', !!ct && ct.de === cot.id);
  afirma('nace en borrador, para imprimirlo y firmarlo', !!ct && ct.estado === 'borrador');
  afirma('Y NO SE GASTÓ OTRO NÚMERO DEL CONTADOR', servidor.libro.length === 1);
});

/* --- 3 ---------------------------------------------------------------------
   Que no se cuente el mismo dinero dos veces. */
await bloque('3 · el ingreso no se cuenta dos veces', async () => {
  servidor.libro = [];
  await equipo([{ id:'k1', tipo:'cotizacion', clienteId:'c1', fecha:`${ANIO}-02-01`,
                  estado:'borrador',
                  hospedaje:[{ concepto:'2 HAB', noches:2, precio:1000 }] }]);
  await p.evaluate(() => emitirContrato(state.contratos[0], null));

  const antes = await p.evaluate(a => ingresos(`${a}-01-01`, `${a}-12-31`)
    .filter(f => f.area === 'Hospedaje').length, ANIO);
  afirma('con la cotización sola, un renglón', antes === 1);

  p.once('dialog', d => d.accept());
  await p.evaluate(() => pasarAContratoCt(state.contratos[0]));
  await p.waitForTimeout(400);

  const r = await p.evaluate(a => {
    const fs_ = ingresos(`${a}-01-01`, `${a}-12-31`).filter(f => f.area === 'Hospedaje');
    return { cuantos: fs_.length, folios: fs_.map(f => f.folio) };
  }, ANIO);
  afirma('YA CONVERTIDA, SIGUE SIENDO UN RENGLÓN', r.cuantos === 1);
  afirma('y el que cuenta es el contrato', r.folios[0] === `CT-${ANIO}-001`);
});

/* --- 4 ---------------------------------------------------------------------
   No dos veces. */
await bloque('4 · una cotización ya convertida no se vuelve a ofrecer', async () => {
  servidor.libro = [];
  await equipo([{ id:'k1', tipo:'cotizacion', clienteId:'c1', fecha:`${ANIO}-02-01`,
                  estado:'borrador' }]);
  await p.evaluate(() => emitirContrato(state.contratos[0], null));
  p.once('dialog', d => d.accept());
  await p.evaluate(() => pasarAContratoCt(state.contratos[0]));
  await p.waitForTimeout(400);
  afirma('el programa sabe que ya tiene contrato',
    await p.evaluate(() => yaTieneContratoCt(state.contratos[0])) === true);
});

/* --- 5 ---------------------------------------------------------------------
   GRUPO DE CONTROL. Las cotizaciones viejas traen CT y no se tocan: su folio
   está impreso en un PDF que el cliente tiene. */
await bloque('5 · una cotización vieja con CT se queda con su folio', async () => {
  servidor.libro = [];
  await equipo([{ id:'k1', tipo:'cotizacion', clienteId:'c1', fecha:`${ANIO}-02-01`,
                  folio:`CT-${ANIO}-007`, estado:'firmado_hotel' }]);
  await p.evaluate(() => emitirContrato(state.contratos[0], null));
  afirma('NO SE LE CAMBIA LA LETRA', (await folios())[0].folio === `CT-${ANIO}-007`);
  afirma('y no se gastó un número por mirarla', servidor.libro.length === 0);

  // Y se puede pasar a contrato igual, conservando su número.
  p.once('dialog', d => d.accept());
  await p.evaluate(() => pasarAContratoCt(state.contratos[0]));
  await p.waitForTimeout(400);
  const ct = (await folios()).find(x => x.tipo === 'contrato');
  afirma('pasa a contrato con el mismo número', !!ct && ct.folio === `CT-${ANIO}-007`);
});

/* --- 6 ---------------------------------------------------------------------
   GRUPO DE CONTROL. El contador local —sin nube— también ve las dos letras. */
await bloque('6 · sin servidor, el número no se repite entre CO y CT', async () => {
  const r = await p.evaluate(a => {
    state.contratos = [
      saneaContrato({ id:'k1', folio:`CO-${a}-001`, tipo:'cotizacion', clienteId:'c1' }),
      saneaContrato({ id:'k2', folio:`CT-${a}-002`, tipo:'contrato',   clienteId:'c1' })];
    return { cot: folioContrato(a, '', 'CO'), ct: folioContrato(a, '', 'CT') };
  }, ANIO);
  afirma('la siguiente cotización es la 003', r.cot === `CO-${ANIO}-003`);
  afirma('y el siguiente contrato también', r.ct === `CT-${ANIO}-003`);
});

/* --- 7 -------------------------------------------------------------------
   Y lo que ese caso destapa: con una cotización vieja los DOS folios quedan
   idénticos, y el detector de repetidos los marcaría como un error que no
   existe. Son el mismo trato. */
await bloque('7 · un contrato y su cotización no son un folio repetido', async () => {
  servidor.libro = [];
  await equipo([{ id:'k1', tipo:'cotizacion', clienteId:'c1', fecha:`${ANIO}-02-01`,
                  folio:`CT-${ANIO}-007`, estado:'firmado_hotel',
                  createdAt:'2026-02-01T10:00:00.000Z' }]);
  p.once('dialog', d => d.accept());
  await p.evaluate(() => pasarAContratoCt(state.contratos[0]));
  await p.waitForTimeout(400);

  const iguales = await p.evaluate(() =>
    state.contratos.filter(k => k.folio).map(k => k.folio));
  afirma('en efecto, los dos traen el mismo folio',
    iguales.length === 2 && iguales[0] === iguales[1]);

  await p.evaluate(() => resolverFoliosRepetidos());
  const r = await p.evaluate(() => state.contratos.map(k => ({
    folio:k.folio, rep: k.folioRepetido || '' })));
  afirma('NINGUNO QUEDA MARCADO COMO REPETIDO', r.every(x => !x.rep));
  afirma('y a ninguno se le cambió el folio',
    r.every(x => x.folio === `CT-${ANIO}-007`));
  afirma('ni se gastó un número del contador por esto', servidor.libro.length === 0);

  // Grupo de control: dos documentos SIN parentesco sí se detectan.
  await p.evaluate(a => {
    state.contratos.push(saneaContrato({ id:'kz', tipo:'cotizacion', clienteId:'c1',
      folio:`CT-${a}-007`, estado:'firmado_hotel',
      createdAt:'2026-03-01T10:00:00.000Z' }));
    guardar();
  }, ANIO);
  await p.evaluate(() => resolverFoliosRepetidos());
  const z = await p.evaluate(() =>
    (state.contratos.find(k => k.id === 'kz') || {}).folioRepetido || '');
  afirma('UN REPETIDO DE VERDAD SÍ SE MARCA', z === `CT-${ANIO}-007`);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
