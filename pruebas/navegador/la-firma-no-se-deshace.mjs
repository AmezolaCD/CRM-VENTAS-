/* ===========================================================================
   UNA COPIA VIEJA NO PISA A UNA NUEVA, Y UNA FIRMA NO SE DESHACE

   Marco, del hotel: «este convenio ya se encontraba firmado dentro del CRM…
   pero desapareció la firma y el estado cambió a firmado por el ejecutivo». Le
   pasó al menos a dos: CV-2026-089 y CV-2027-079.

   No es que la firma no se aplicara: SE APLICÓ, estaba en el servidor, y
   después se deshizo sola. El culpable es un renglón de la fusión:

     if (local && !mismoQueSincronizado && deMiIncumbencia(local)) continue;

   «No pises lo de aquí si es una edición mía sin subir». La pregunta se le
   hacía a `sincronizado`, un Map EN MEMORIA que arranca vacío al recargar: sin
   él, TODO lo local parecía una edición sin subir. Así que al bajar no se
   aplicaba el convenio firmado que mandaba el servidor, y en la misma vuelta se
   volvía a subir la copia vieja ENCIMA. Firma y estado, los dos para atrás.

   Lo que se afirma aquí:

   1. **La que importa**: tras recargar, un convenio que llega firmado del
      servidor SE APLICA, aunque aquí esté la copia sin firmar.
   2. Y no se vuelve a subir la copia vieja encima.
   3. Lo ya confirmado por el servidor se recuerda entre recargas: no se
      reenvía el equipo entero en cada arranque.
   4. Una edición local de verdad SÍ se sigue protegiendo: no se pisa y sube.
   5. El seguro de la firma funciona aunque lo demás falle: con el registro
      vacío a la fuerza, el documento firmado del servidor gana igual.
   6. Las huellas no sirven para deducir borrados: lo que no está bajado no se
      tumba.
   7. La huella distingue dos renglones que se parecen mucho.

   Cómo correrla:  node pruebas/navegador/la-firma-no-se-deshace.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8907;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const base = {
  id:'v1', folio:'CV-2026-089', clienteId:'c1', fecha:'2026-10-01',
  vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
  firmaHotel:{ nombre:'Ejecutiva de ejemplo', img:FIRMA },
  habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                  grupo:'deluxe', publica:5300, convenio:2800 }]
};
/* Lo que el servidor tiene: FIRMADO por el cliente. */
const EN_EL_SERVIDOR = Object.assign({}, base, {
  estado:'firmado_cliente', tokenFirma:'',
  firmaEmpresa:{ nombre:'Quien firmó', puesto:'', celular:'',
                 fecha:'2026-10-26T20:45:44.000Z', img:FIRMA } });
/* Lo que quedó en el equipo de la ejecutiva: la copia de antes de firmar. */
const EN_EL_EQUIPO = Object.assign({}, base, {
  estado:'firmado_ejecutiva', tokenFirma:'laclave', firmaEmpresa:null });

let subidos = [];

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*',
                 'Access-Control-Allow-Headers':'*' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/rest/v1/crm_datos'){
    if (req.method !== 'POST'){
      res.writeHead(200, cors);
      return res.end(JSON.stringify([{ id:'convenios:v1', tipo:'convenios', borrado:false,
        actualizado:'2026-10-26T20:45:44.000Z', datos: EN_EL_SERVIDOR }]));
    }
    let cuerpo = '';
    req.on('data', t => cuerpo += t);
    return req.on('end', () => {
      try{ for (const f of JSON.parse(cuerpo)) subidos.push(f); }catch(e){}
      res.writeHead(201, cors); res.end('');
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
const ctx = await br.newContext({ viewport:{ width:1000, height:900 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });

/**
 * Deja el equipo como queda tras RECARGAR: con la copia vieja guardada y el
 * registro de memoria en blanco, que es la situación exacta del defecto.
 */
const comoTrasRecargar = (op = {}) => p.evaluate(([url, EN_EL_EQUIPO, op]) => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  nube.url = url; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio', user:{ email:'ana@ejemplo.example' } };
  nube.enlazado = true; nube.ultimo = ''; nube.estado = 'listo';
  nube.sinBuzon = true; nube.sinBuzonAltas = true; nube.sinBuzonWa = true; nube.sinBuzonOdts = true;
  if (typeof soltarElFreno === 'function') soltarElFreno();
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
    contacto:'Juan Pérez', telefono:'6640000000', email:'uno@ejemplo.example',
    estatus:'propuesta' })];
  state.convenios = [saneaConv(EN_EL_EQUIPO)];
  state.actividades = []; state.contratos = []; state.eventos = []; state.huespedes = [];
  guardar();
  // El registro EN MEMORIA en blanco: eso es lo que deja una recarga.
  sincronizado = new Map();
  if (op.sinHuellas && typeof huellas !== 'undefined'){ huellas = new Map(); guardarHuellas(); }
}, [`http://127.0.0.1:${PUERTO}`, EN_EL_EQUIPO, op]);

const mirar = () => p.evaluate(() => {
  const v = state.convenios[0];
  return { estado: v && v.estado, firmado: !!(v && v.firmaEmpresa && v.firmaEmpresa.img) };
});

await bloque('1 · lo que llega firmado del servidor se aplica', async () => {
  subidos = [];
  await comoTrasRecargar();
  await p.evaluate(() => sincronizar());
  const r = await mirar();
  afirma('el convenio queda firmado aquí',     r.firmado === true);
  afirma('y con el estado del servidor',       r.estado === 'firmado_cliente');
});

await bloque('2 · y no se sube la copia vieja encima', async () => {
  const pisados = subidos.filter(f => f.id === 'convenios:v1' &&
    !(f.datos && f.datos.firmaEmpresa && f.datos.firmaEmpresa.img));
  afirma('no se mandó ninguna versión sin firma', pisados.length === 0);
});

await bloque('3 · lo confirmado se recuerda entre recargas', async () => {
  const guardadas = await p.evaluate(() =>
    (JSON.parse(localStorage.getItem('crm-hotel-huellas') || '[]')).length);
  afirma('quedó apuntado en el navegador', guardadas > 0);
  // Otra vuelta, ya sin nada que cambiar: no se reenvía el equipo entero.
  subidos = [];
  await p.evaluate(() => { sincronizado = new Map(); return sincronizar(); });
  afirma('no se reenvía lo que el servidor ya tiene', subidos.length === 0);
});

await bloque('4 · una edición local de verdad sí se protege y sube', async () => {
  subidos = [];
  await p.evaluate(async () => {
    state.convenios[0].observaciones = 'algo que escribió la ejecutiva';
    guardar();
    await sincronizar();
  });
  const mandado = subidos.find(f => f.id === 'convenios:v1');
  afirma('la edición local subió', !!mandado);
  afirma('con lo que se escribió',
    !!mandado && mandado.datos.observaciones === 'algo que escribió la ejecutiva');
  afirma('y sin perder la firma del cliente',
    !!mandado && !!(mandado.datos.firmaEmpresa && mandado.datos.firmaEmpresa.img));
});

await bloque('5 · el seguro de la firma aguanta aunque no haya nada apuntado', async () => {
  subidos = [];
  await comoTrasRecargar({ sinHuellas:true });     // ni memoria ni navegador
  await p.evaluate(() => sincronizar());
  const r = await mirar();
  afirma('gana el documento firmado del servidor', r.firmado === true);
  afirma('y el estado también',                    r.estado === 'firmado_cliente');
});

await bloque('6 · lo apuntado no sirve para deducir borrados', async () => {
  const r = await p.evaluate(async () => {
    /* Un id apuntado que ya no vive en el estado NO puede convertirse en
       lápida por venir del navegador: si no, un localStorage a medias
       borraría media cartera. */
    huellas.set('convenios:fantasma', 'loquesea');
    guardarHuellas();
    sincronizado = new Map();
    const antes = [...tumbas];
    await sincronizar();
    return { tumbaNueva: [...tumbas].includes('convenios:fantasma'), antes: antes.length };
  });
  afirma('no se tumbó nada por estar apuntado', r.tumbaNueva === false);
});

await bloque('7 · la huella distingue dos renglones muy parecidos', async () => {
  const r = await p.evaluate(() => {
    const a = { id:'x', nota:'uno' }, b = { id:'x', nota:'dos' };
    return { distintas: huella(a) !== huella(b), iguales: huella(a) === huella({ id:'x', nota:'uno' }) };
  });
  afirma('dos contenidos distintos dan huellas distintas', r.distintas === true);
  afirma('y el mismo contenido, la misma huella',          r.iguales === true);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
