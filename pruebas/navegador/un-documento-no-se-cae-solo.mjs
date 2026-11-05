/* ===========================================================================
   UN DOCUMENTO NO SE CAE SOLO

   Marco borró su contrato, registró uno nuevo con «Subir uno firmado» y:
   «después de un rato ese contrato se borró de la lista». No volvió al
   recargar, y tampoco le aparecía a Carmen.

   La cadena era ésta:

     1. `sanear()` descartaba todo contrato cuyo `clienteId` ya no resolviera
        —`conCliente`, con un `return false`—. Y `sanear` corre en cada
        reconstrucción del estado: al abrir y en cada sincronización.

     2. Y al recargar volvía a pasar, antes de que corriera ninguna de las dos
        protecciones que sí hay dentro de `sincronizar()` —`alDiaSinTumbar` y
        `olvidarHuerfanos`—. Por ahí puede convertirse en LÁPIDA
        (`anotarLoQueSeFue`), y entonces se borra para todo el hotel y ya no
        hay de dónde recuperarlo: una lápida viaja con los datos vacíos.

   ACLARACIÓN HONESTA sobre lo que esta prueba mide y lo que no. El paso 1
   —que el documento se caiga, en la sincronización y en la recarga— SÍ se
   reproduce aquí, y es lo que se ve en rojo contra la versión de antes. El
   paso 2 —que esa caída se convierta en lápida— NO se logró reproducir en
   este arnés: contra la versión vieja las dos aserciones de lápida salen
   verdes, así que son GUARDIAS, no mediciones. Quedan puestas porque lo que
   cuidan es lo irreversible, y si mañana alguien rompe esa protección, aquí
   se va a ver.

   Lo que se cuida aquí:

   · que un documento sin cliente SOBREVIVA a la sincronización;
   · que SOBREVIVA A LA RECARGA y que no le nazca una lápida;
   · que se vea marcado y se pueda volver a ligar;
   · que el importe de un documento subido ya firmado entre a los reportes;
   · y los grupos de control: borrar a propósito SIGUE mandando su lápida, y
     un documento con su cliente en orden se comporta igual que siempre.

   Cómo correrla:  node pruebas/navegador/un-documento-no-se-cae-solo.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del arreglo tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8873;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium';
const ANIO   = new Date().getFullYear();

/* El servidor de mentiras. Guarda lo que le suben, para poder preguntarle
   después si llegó una lápida. */
const servidor = { tabla: new Map() };
let reloj = 0;
const sello = () => new Date(Date.UTC(2026, 9, 30, 12, 0, reloj++)).toISOString();

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
      let filas = [...servidor.tabla.values()];
      if (desde) filas = filas.filter(f => f.actualizado > desde);
      return manda(200, filas.sort((a, b) => a.id < b.id ? -1 : 1));
    }
    if (req.method === 'POST'){
      let cuerpo = '';
      req.on('data', d => cuerpo += d);
      return req.on('end', () => {
        let lote = [];
        try{ lote = JSON.parse(cuerpo || '[]'); }catch(e){}
        for (const f of lote)
          servidor.tabla.set(f.id, Object.assign({}, f, { actualizado: sello() }));
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

let ctx, p;
/**
 * Un equipo con un contrato cuyo cliente NO está en la cartera: justo lo que
 * queda cuando alguien borra al cliente, o cuando el borrado llega de otro
 * equipo.
 */
async function equipo({ conCliente = false, conNube = true } = {}){
  if (ctx) await ctx.close().catch(() => {});
  ctx = await br.newContext();
  p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app`);
  await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
  await p.evaluate(({ conCliente, conNube, anio }) => {
    if (conNube){
      nube.url = location.origin;
      nube.anon = 'llave-de-mentiras';
      nube.sesion = { access_token:'ficticio', user:{ email:'admin@ejemplo.example' } };
      nube.ultimo = ''; nube.enlazado = true;
      state.usuarios = [saneaUsuario({ id:'u1', correo:'admin@ejemplo.example',
        nombre:'Quien Sea', rol:'admin' })];
    }
    state.clientes = conCliente
      ? [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
                        ejecutivo:'Quien Sea', estatus:'nuevo' })]
      : [];
    state.contratos = [saneaContrato({ id:'kA', folio:`CT-${anio}-027`, tipo:'contrato',
      clienteId:'c1', ejecutivo:'Quien Sea', estado:'aceptado', externo:true,
      fecha:`${anio}-10-28`, createdAt:'2026-10-28T10:00:00.000Z' })];
    guardar();
    if (typeof ponDepto === 'function') ponDepto('ventas');
  }, { conCliente, conNube, anio: ANIO });
  await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelectorAll('.overlay').forEach(o => o.remove()));
}

const contratos = () => p.evaluate(() => state.contratos.map(k => k.folio));
const lapidas   = () => p.evaluate(() => [...tumbas]);

/* --- 1 ---------------------------------------------------------------------
   EL CASO DE MARCO. El cliente ya no está y el documento tiene que quedarse. */
await bloque('1 · un contrato sin cliente sobrevive a la sincronización', async () => {
  servidor.tabla = new Map();
  await equipo();
  afirma('el contrato está ahí al empezar', (await contratos()).length === 1);

  await p.evaluate(() => sincronizar());
  await p.waitForTimeout(400);
  afirma('SIGUE AHÍ DESPUÉS DE SINCRONIZAR', (await contratos()).includes(`CT-${ANIO}-027`));
  afirma('y no se le puso lápida', !(await lapidas()).some(x => /^contratos:/.test(x)));
});

/* --- 2 ---------------------------------------------------------------------
   LA QUE DE VERDAD IMPORTA. La recarga era lo que lo mataba para todos. */
await bloque('2 · y sobrevive a la recarga, sin que le nazca una lápida', async () => {
  servidor.tabla = new Map();
  await equipo();
  await p.evaluate(() => sincronizar());
  await p.waitForTimeout(400);

  await p.reload();
  await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
  await p.waitForTimeout(600);

  afirma('EL CONTRATO SIGUE AHÍ DESPUÉS DE RECARGAR',
    (await contratos()).includes(`CT-${ANIO}-027`));
  // Guardia, no medición: ver la aclaración de arriba.
  afirma('y no le nació una lápida (guardia)',
    !(await lapidas()).some(x => /^contratos:/.test(x)));

  await p.evaluate(() => sincronizar());
  await p.waitForTimeout(500);
  const enElServidor = [...servidor.tabla.values()].find(f => /^contratos:/.test(f.id));
  afirma('y al servidor no le llegó un borrado (guardia)',
    !enElServidor || enElServidor.borrado !== true);
});

/* --- 3 ---------------------------------------------------------------------
   Que se vea, y que se pueda arreglar. */
await bloque('3 · sale marcado «sin cliente» y se puede volver a ligar', async () => {
  servidor.tabla = new Map();
  await equipo();
  const lista = await p.evaluate(() => {
    vista = 'contratos'; render();
    return document.getElementById('tblContratos').innerText;
  });
  afirma('el renglón lo dice', /sin cliente/i.test(lista));
  afirma('y hay un aviso arriba que los cuenta',
    /qued[oó] sin cliente|quedaron sin cliente/i.test(lista));

  // Y con un cliente en la cartera, se le asigna y vuelve a la normalidad.
  const quedo = await p.evaluate(() => {
    state.clientes = [saneaCliente({ id:'c9', empresa:'OTRA EMPRESA SA DE CV',
      ejecutivo:'Quien Sea', estatus:'nuevo' })];
    state.contratos[0].clienteId = 'c9';
    guardar(); render();
    return { suelto: sinCliente(state.contratos[0]),
             texto: document.getElementById('tblContratos').innerText };
  });
  afirma('ya no está suelto', quedo.suelto === false);
  afirma('y el aviso se fue', !/quedaron sin cliente/i.test(quedo.texto));
});

/* --- 4 ---------------------------------------------------------------------
   GRUPO DE CONTROL, EL QUE NO SE PUEDE ROMPER. Un borrado de verdad tiene que
   seguir viajando: costó encontrarlo y no se toca. */
await bloque('4 · borrar a propósito SIGUE mandando su lápida', async () => {
  servidor.tabla = new Map();
  await equipo({ conCliente: true });
  await p.evaluate(() => sincronizar());
  await p.waitForTimeout(400);

  await p.evaluate(() => {
    state.contratos = state.contratos.filter(k => k.id !== 'kA');
    guardar();
  });
  await p.evaluate(() => sincronizar());
  await p.waitForTimeout(500);

  const fila = [...servidor.tabla.values()].find(f => f.id === 'contratos:kA');
  afirma('AL SERVIDOR LE LLEGÓ EL BORRADO', !!fila && fila.borrado === true);
  afirma('y el contrato ya no está aquí', !(await contratos()).includes(`CT-${ANIO}-027`));
});

/* --- 5 ---------------------------------------------------------------------
   GRUPO DE CONTROL. Con su cliente en orden, todo igual que siempre. */
await bloque('5 · con su cliente en orden, nada cambia', async () => {
  servidor.tabla = new Map();
  await equipo({ conCliente: true });
  await p.evaluate(() => sincronizar());
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    vista = 'contratos'; render();
    return { suelto: sinCliente(state.contratos[0]),
             texto: document.getElementById('tblContratos').innerText };
  });
  afirma('no se marca nada', r.suelto === false && !/sin cliente/i.test(r.texto));
  afirma('no hay aviso', !/quedaron sin cliente/i.test(r.texto));
  afirma('sigue en la lista', (await contratos()).includes(`CT-${ANIO}-027`));
});

/* --- 6 ---------------------------------------------------------------------
   EL IMPORTE. «No sale el total de ese contrato así que afectará en los
   reportes de ingreso». */
await bloque('6 · un documento subido ya firmado cuenta con su importe', async () => {
  servidor.tabla = new Map();
  await equipo({ conCliente: true });

  const sinImporte = await p.evaluate(() => cuentasContrato(state.contratos[0]).total);
  afirma('sin capturar nada vale cero, como antes', sinImporte === 0);

  const con = await p.evaluate(() => {
    const k = state.contratos[0];
    k.importe = 73337; k.importeConImpuestos = true;
    guardar();
    return { total: cuentasContrato(k).total, sellado: k.total };
  });
  afirma('CON IMPORTE, EL TOTAL ES EL DEL PAPEL', con.total === 73337);
  afirma('y queda sellado en el registro', con.sellado === 73337);

  // Y lo que de verdad pedía Marco: que llegue al reporte de ingresos.
  const enReporte = await p.evaluate(a => {
    const fs_ = ingresos(`${a}-01-01`, `${a}-12-31`);
    const mio = fs_.filter(f => f.folio === `CT-${a}-027`);
    return { cuantos: mio.length, monto: mio.reduce((x, f) => x + f.monto, 0) };
  }, ANIO);
  afirma('SALE EN EL REPORTE DE INGRESOS', enReporte.cuantos === 1);
  afirma('y con su dinero, no en cero', enReporte.monto === 73337);

  // Sin impuestos incluidos, se le suman.
  const conImp = await p.evaluate(() => {
    const k = state.contratos[0];
    k.importe = 100; k.importeConImpuestos = false; k.impuestos = 13;
    return cuentasContrato(k).total;
  });
  afirma('si el importe no trae impuestos, se le suman', conImp === 113);
});

/* --- 7 ---------------------------------------------------------------------
   La caja de búsqueda, que yo mismo dejé escondida filtrando. */
await bloque('7 · la caja de buscar se ve en la pantalla de Contratos', async () => {
  servidor.tabla = new Map();
  await equipo({ conCliente: true });
  const visible = await p.evaluate(() => {
    vista = 'contratos'; render();
    return getComputedStyle(document.getElementById('q')).display !== 'none';
  });
  afirma('SE VE, para poder vaciarla', visible);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
