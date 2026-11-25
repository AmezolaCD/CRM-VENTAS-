/* ===========================================================================
   UNA FIRMA QUE NO LLEGÓ AL DOCUMENTO NO SE DA POR RECOGIDA

   CV-2026-089: el cliente lo firmó, se lo descargó firmado, y en el CRM seguía
   sin firma. La firma no se había perdido —estaba íntegra en el buzón del
   servidor— pero marcada como YA RECOGIDA, y como el sondeo sólo pide las que
   no lo están, era invisible para todos los equipos, para siempre. Once firmas
   de clientes del hotel acabaron así.

   Eran dos defectos sumados, los dos en `recogerFirmas()`:

   · el PATCH `aplicada:true` estaba FUERA del if, así que las tres ramas que
     DESCARTAN la firma también la marcaban; y
   · esa función corre dentro de `sincronizar()` ANTES de subir, así que incluso
     la rama que sí aplica marcaba la firma antes de saber si el documento
     llegaba al servidor. Si la subida rebotaba —y un equipo tenía ~107
     renglones rechazados por permisos—, la firma se daba por recogida y se
     perdía.

   Lo que se afirma aquí:

   1. Una firma con la clave cambiada NO se marca, y sigue ahí en la vuelta
      siguiente.
   2. Una firma de un contrato —que se firma en papel— tampoco se marca.
   3. Una firma aplicada cuyo documento NO logra subir, tampoco.
   4. Una firma aplicada cuyo documento SÍ sube, se marca.
   5. Una firma repetida de un documento ya firmado sí se marca: ahí sobra.
   6. Y las que ya se perdieron se recuperan: «Aplicar esta firma» cierra el
      documento, también cuando la clave ya no corresponde.
   7. Grupo de control: un documento que este equipo no tiene bajado sigue sin
      marcarse, como antes.

   Cómo correrla:  node pruebas/navegador/la-firma-que-se-dio-por-recogida.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8903;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

let buzon = [];                 // lo que hay sin recoger
let marcados = [];              // qué firmas se dieron por recogidas
let subidaOk = true;            // ¿el servidor acepta los documentos?
let subidos = [];

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/rest/v1/rpc/crm_buzon_ok'){ res.writeHead(200, cors); return res.end('true'); }

  if (u.pathname === '/rest/v1/crm_firmas'){
    if (req.method === 'PATCH'){
      const m = /id=eq\.(\d+)/.exec(u.search || '');
      if (m) marcados.push(Number(m[1]));
      res.writeHead(204, cors); return res.end('');
    }
    const soloPendientes = (u.search || '').includes('aplicada=is.false');
    res.writeHead(200, cors);
    return res.end(JSON.stringify(soloPendientes ? buzon.filter(f => !f.aplicada) : buzon));
  }

  if (u.pathname === '/rest/v1/crm_datos'){
    if (req.method !== 'POST'){ res.writeHead(200, cors); return res.end('[]'); }
    let cuerpo = '';
    req.on('data', t => cuerpo += t);
    req.on('end', () => {
      if (!subidaOk){
        res.writeHead(403, cors);
        return res.end('{"code":"42501","message":"new row violates row-level security policy"}');
      }
      try{ for (const f of JSON.parse(cuerpo)) subidos.push(f.id); }catch(e){}
      res.writeHead(201, cors); res.end('');
    });
    return;
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
const ctx = await br.newContext({ viewport:{ width:900, height:1000 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof recogerFirmas === 'function', null, { timeout:15000 });

const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

/** Deja el equipo con un convenio firmado por la ejecutiva y el buzón servido. */
const preparar = async (op = {}) => {
  marcados = []; subidos = []; subidaOk = op.subidaOk !== false;
  buzon = op.buzon;
  await p.evaluate(([url, op]) => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    nube.url = url; nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio', user:{ email:'ana@ejemplo.example' } };
    nube.enlazado = true; nube.ultimo = ''; nube.estado = 'listo';
    nube.sinBuzon = false; nube.sinBuzonAltas = true; nube.sinBuzonWa = true; nube.sinBuzonOdts = true;
    sincronizado = new Map();
    if (typeof soltarElFreno === 'function') soltarElFreno();
    _buzonOk = true;
    olvidarAvisosFirma();
    state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
      contacto:'Juan Pérez', telefono:'6640000000', email:'uno@ejemplo.example',
      estatus:'propuesta' })];
    state.convenios = op.sinConvenio ? [] : [saneaConv({ id:'v1', folio:'CV-2026-089',
      clienteId:'c1', tokenFirma:'laclave', fecha:'2026-10-01',
      vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
      estado:'firmado_ejecutiva',
      firmaHotel:{ nombre:'Ejecutivo de ejemplo' },
      firmaEmpresa: op.yaFirmado ? { nombre:'Alguien', img:'data:image/png;base64,AA==' } : null,
      habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                      grupo:'deluxe', publica:5300, convenio:2800 }] })];
    state.contratos = op.contrato ? [saneaContrato({ id:'k1', folio:'CT-2026-010',
      clienteId:'c1', tipo:'contrato', tokenFirma:'laclave',
      estado:'firmado_hotel', firmaHotel:{ nombre:'Ejecutivo de ejemplo' } })] : [];
    state.actividades = []; state.eventos = []; state.huespedes = [];
    guardar();
  }, [`http://127.0.0.1:${PUERTO}`, op]);
};

/** Una vuelta completa de sincronización, como el sondeo. */
const vuelta = () => p.evaluate(async () => {
  await sincronizar();
  const v = state.convenios[0];
  return { firmado: !!(v && v.firmaEmpresa && v.firmaEmpresa.img),
           estado: v && v.estado,
           estatusCliente: (state.clientes[0] || {}).estatus };
});

await bloque('1 · una firma con la clave cambiada NO se da por recogida', async () => {
  await preparar({ buzon:[{ id:1, convenio_id:'v1', token:'otra-clave', nombre:'Dr. Ejemplo Apellido',
                            puesto:'', celular:'', img:FIRMA, aplicada:false,
                            creado:'2026-10-26T20:45:44Z' }] });
  const r = await vuelta();
  afirma('no se aplicó, que es correcto',   r.firmado === false);
  afirma('y NO se marcó como recogida',     marcados.length === 0);
  // Segunda vuelta: tiene que seguir ahí, no haberse esfumado.
  await p.evaluate(() => sincronizar());
  afirma('sigue en el buzón, sin recoger',  buzon[0].aplicada === false);
});

await bloque('2 · la firma de un contrato en papel tampoco se marca', async () => {
  await preparar({ contrato:true, sinConvenio:true,
                   buzon:[{ id:2, convenio_id:'contratos:k1', token:'laclave', nombre:'Quien sea',
                            puesto:'', celular:'', img:FIRMA, aplicada:false,
                            creado:'2026-11-01T10:00:00Z' }] });
  await p.evaluate(() => sincronizar());
  afirma('no se marcó',                     marcados.length === 0);
});

await bloque('3 · si el documento NO logra subir, la firma no se da por recogida', async () => {
  await preparar({ subidaOk:false,
                   buzon:[{ id:3, convenio_id:'v1', token:'laclave', nombre:'Dr. Ejemplo Apellido',
                            puesto:'', celular:'', img:FIRMA, aplicada:false,
                            creado:'2026-10-26T20:45:44Z' }] });
  const r = await vuelta();
  afirma('la firma sí se aplicó en este equipo', r.firmado === true);
  afirma('pero NO se marcó como recogida',       marcados.length === 0);
});

await bloque('4 · si el documento sube, entonces sí se marca', async () => {
  await preparar({ buzon:[{ id:4, convenio_id:'v1', token:'laclave', nombre:'Dr. Ejemplo Apellido',
                            puesto:'', celular:'', img:FIRMA, aplicada:false,
                            creado:'2026-10-26T20:45:44Z' }] });
  const r = await vuelta();
  afirma('la firma se aplicó',              r.firmado === true);
  afirma('el convenio quedó cerrado',       r.estado === 'firmado_cliente');
  afirma('el cliente pasó a ganado',        r.estatusCliente === 'ganado');
  afirma('el convenio llegó al servidor',   subidos.includes('convenios:v1'));
  afirma('y la firma se marcó, una vez',    marcados.filter(x => x === 4).length === 1);
});

await bloque('5 · una firma repetida de un documento ya firmado sí se marca', async () => {
  await preparar({ yaFirmado:true,
                   buzon:[{ id:5, convenio_id:'v1', token:'laclave', nombre:'Otra vez',
                            puesto:'', celular:'', img:FIRMA, aplicada:false,
                            creado:'2026-11-02T10:00:00Z' }] });
  await p.evaluate(() => sincronizar());
  afirma('ahí sí sobra, y se marca',        marcados.includes(5));
});

await bloque('6 · las perdidas se recuperan desde «Firmas recibidas»', async () => {
  /* La firma ya marcada como recogida y el documento sin firma: el caso exacto
     de CV-2026-089, con la clave además cambiada. */
  await preparar({ buzon:[{ id:6, convenio_id:'v1', token:'la-vieja', nombre:'Dr. Ejemplo Apellido',
                            puesto:'', celular:'', img:FIRMA, aplicada:true,
                            creado:'2026-10-26T20:45:44Z' }] });
  const r = await p.evaluate(async () => {
    await firmasRecibidas();
    for (let i = 0; i < 100; i++){
      const b = document.querySelector('[data-aplicar]');
      if (b){
        b.click();
        for (let j = 0; j < 100; j++){
          const v = state.convenios[0];
          if (v && v.firmaEmpresa && v.firmaEmpresa.img)
            return { firmado:true, estado:v.estado,
                     estatusCliente:(state.clientes[0] || {}).estatus,
                     quien:v.firmaEmpresa.nombre };
          await new Promise(r => setTimeout(r, 100));
        }
        return { firmado:false, estado:'(no se aplicó)' };
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return { firmado:false, estado:'(no salió el botón)' };
  });
  afirma('el botón está y aplica la firma', r.firmado === true);
  afirma('el convenio queda cerrado',       r.estado === 'firmado_cliente');
  afirma('el cliente pasa a ganado',        r.estatusCliente === 'ganado');
  afirma('con el nombre de quien firmó',    r.quien === 'Dr. Ejemplo Apellido');
  /* La firma aparece en el estado antes de que la subida termine, así que aquí
     hay que ESPERARLA: comprobarla en el acto medía el reloj, no el código. */
  for (let i = 0; i < 100 && !subidos.includes('convenios:v1'); i++)
    await new Promise(r => setTimeout(r, 100));
  afirma('y el convenio sube al servidor',  subidos.includes('convenios:v1'));
  afirma('y la firma queda dada por recogida', marcados.includes(6));
});

await bloque('7 · control: un documento no bajado sigue sin marcarse', async () => {
  await preparar({ sinConvenio:true,
                   buzon:[{ id:7, convenio_id:'v9', token:'laclave', nombre:'Alguien',
                            puesto:'', celular:'', img:FIRMA, aplicada:false,
                            creado:'2026-11-03T10:00:00Z' }] });
  await p.evaluate(() => sincronizar());
  afirma('no se marcó: otro equipo la aplicará', marcados.length === 0);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
