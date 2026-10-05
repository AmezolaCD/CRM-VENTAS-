/* ===========================================================================
   DOS DOCUMENTOS CON EL MISMO FOLIO TIENEN QUE VERSE Y PODERSE ARREGLAR

   A Marco se le repitieron CT-2026-002 y CT-2026-004 «sin razón aparente», y
   estuvieron ahí sin que nadie lo notara hasta que los vio a ojo en la lista.
   La razón de que nadie lo notara: toda la maquinaria de folios repetidos
   —detectarlos al sincronizar, el aviso de arriba de la lista, el botón para
   pedirle números nuevos al contador— existía SÓLO para los convenios.

   Aquí se comprueba que funciona también en contratos, que es donde le pasó.

   Cómo correrla:  node pruebas/navegador/folios-repetidos.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8802;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* El contador del hotel, que es quien reparte los números nuevos. */
let siguiente = 20;
const repartidos = [];

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/rest/v1/rpc/crm_aparta_folio'){
    let cuerpo = '';
    req.on('data', d => cuerpo += d);
    return req.on('end', () => {
      let q = {};
      try{ q = JSON.parse(cuerpo || '{}'); }catch(e){}
      const folio = `${q.p_prefijo}-${q.p_anio}-${String(siguiente++).padStart(3, '0')}`;
      repartidos.push({ tipo:q.p_tipo, folio });
      res.writeHead(200, cors); res.end(JSON.stringify(folio));
    });
  }
  res.writeHead(200, cors); res.end('[]');
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
const ctx = await br.newContext({ viewport:{ width:1200, height:900 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));   // se acepta el «¿continuar?»
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof resolverFoliosRepetidos === 'function', null, { timeout:15000 });
await p.evaluate(u => {
  nube.url = u; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio', user:{ email:'ana@ejemplo.example' } };
  try{ terminarEntrada(); }catch(e){}
  document.documentElement.classList.remove('intro-activa');
}, `http://127.0.0.1:${PUERTO}`);

/** Deja la cartera como la de Marco: dos contratos firmados con el mismo folio. */
const montar = () => p.evaluate(() => {
  /* Quien mira es la administradora: si no, la lista se filtra por cartera y
     la prueba se quedaría sin renglones por una razón que no es la suya. */
  state.usuarios = [saneaUsuario({ id:'u1', nombre:'Ana', correo:'ana@ejemplo.example',
                                   rol:'admin', activo:true })];
  state.clientes = [
    saneaCliente({ id:'c1', nombre:'EMPRESA DE EJEMPLO SA DE CV', ejecutivo:'Ana' }),
    saneaCliente({ id:'c2', nombre:'OTRA EMPRESA DE EJEMPLO',     ejecutivo:'Ana' })];
  const ct = (id, folio, cli, creado) => saneaContrato({
    id, folio, clienteId:cli, tipo:'cotizacion', estado:'firmado_hotel',
    fecha:'2026-09-24', createdAt:creado,
    firmaHotel:{ nombre:'Ana', fecha:creado } });
  state.contratos = [
    ct('k1', 'CT-2026-002', 'c1', '2026-09-24T10:00:00.000Z'),   // el de siempre
    ct('k2', 'CT-2026-002', 'c2', '2026-10-02T10:00:00.000Z'),   // el repetido
    ct('k3', 'CT-2026-007', 'c1', '2026-10-01T10:00:00.000Z')];  // uno sano
  state.actividades = [];
});

await bloque('1 · al sincronizar se detecta el repetido', async () => {
  await montar();
  const r = await p.evaluate(() => {
    const hubo = resolverFoliosRepetidos();
    return { hubo, marcados: state.contratos.filter(k => k.folioRepetido).map(k => k.id),
             folios: state.contratos.map(k => k.id + ':' + k.folio) };
  });
  afirma('se marca el que se creó después, no el de siempre',
    r.marcados.length === 1 && r.marcados[0] === 'k2');
  afirma('y NO se le cambia el folio por detrás —ya está firmado—',
    r.folios.includes('k2:CT-2026-002'));
  afirma('el sano no se toca', r.folios.includes('k3:CT-2026-007'));
});

await bloque('2 · la lista lo enseña, en vez de callárselo', async () => {
  await p.evaluate(() => renderContratos());
  await p.waitForTimeout(300);
  /* innerHTML y no innerText: la pestaña no está a la vista en la prueba, y de
     un elemento escondido innerText devuelve cadena vacía — la prueba pasaría
     o fallaría por una razón que no tiene nada que ver. */
  const t = await p.evaluate(() => document.querySelector('#tblContratos').innerHTML);
  afirma('la lista de verdad trae los contratos',
    await p.evaluate(() => document.querySelectorAll('#tblContratos tr[data-id]').length) === 3);
  afirma('sale el aviso de arriba', /folio repetido/i.test(t));
  afirma('dice de cuál se trata', /CT-2026-002/.test(t));
  afirma('y ofrece arreglarlo', /Darles un folio\s+nuevo/i.test(t));
  /* Que haya «una pastilla» no dice nada: en esa celda ya vive la de «externo».
     Se pide la que avisa del folio. */
  afirma('la fila trae su marca', await p.evaluate(() =>
    [...document.querySelectorAll('#tblContratos td .pill')]
      .some(e => /mismo folio/i.test(e.title || ''))));
});

await bloque('3 · el botón le pide un número nuevo al contador del hotel', async () => {
  await p.evaluate(async () => {
    document.querySelector('#bRenumTodos').click();
  });
  await p.waitForFunction(() => !state.contratos.some(k => k.folioRepetido), null, { timeout:10000 });
  const r = await p.evaluate(() => ({
    folios: state.contratos.map(k => k.id + ':' + k.folio),
    bitacora: state.actividades.map(a => a.asunto) }));
  afirma('el de siempre conserva su folio', r.folios.includes('k1:CT-2026-002'));
  afirma('el repetido se lleva uno nuevo del contador', r.folios.includes('k2:CT-2026-020'));
  afirma('ya no queda ninguno marcado',
    !(await p.evaluate(() => state.contratos.some(k => k.folioRepetido))));
  afirma('queda escrito en la bitácora del cliente',
    r.bitacora.some(a => /CT-2026-002 se renumeró como CT-2026-020/.test(a)));
  afirma('se le pidió al contador por la serie de contratos',
    repartidos.some(x => x.tipo === 'contratos' && x.folio === 'CT-2026-020'));
});

await bloque('4 · un borrador repetido se arregla solo, sin molestar a nadie', async () => {
  const r = await p.evaluate(() => {
    state.contratos.push(saneaContrato({ id:'k4', folio:'CT-2026-007', clienteId:'c2',
      tipo:'cotizacion', estado:'borrador', createdAt:'2026-10-03T10:00:00.000Z' }));
    resolverFoliosRepetidos();
    const k4 = state.contratos.find(k => k.id === 'k4');
    return { folio:k4.folio, marcado:!!k4.folioRepetido };
  });
  afirma('se le da otro folio sin preguntar', r.folio !== 'CT-2026-007');
  afirma('y no queda marcado como problema', !r.marcado);
});

await bloque('5 · el campo no nace en los documentos sanos', async () => {
  /* Un campo nuevo en TODOS los renglones los haría verse editados y los
     volvería a subir enteros en la primera sincronización. Ya pasó antes. */
  const r = await p.evaluate(() =>
    JSON.stringify(saneaContrato({ id:'kz', folio:'CT-2026-099' })));
  afirma('un contrato recién saneado no trae folioRepetido',
    !/folioRepetido/.test(r));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
