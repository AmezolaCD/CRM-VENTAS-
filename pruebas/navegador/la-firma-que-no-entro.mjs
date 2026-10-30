/* ===========================================================================
   UNA FIRMA DE CLIENTE NO SE PUEDE PERDER EN SILENCIO

   Marco: «el contrato se le mandó al cliente y el cliente lo firmó, pero no
   se ve en sistema».

   Lo que pasaba: cuando un cliente firma, su firma no se escribe en el
   documento —se deposita en el buzón `crm_firmas`— y el CRM la levanta con
   `recogerFirmas()` EN CADA SINCRONIZACIÓN AUTOMÁTICA. Esa función tiene tres
   desenlaces en los que la firma no se aplica:

     · el documento es un CONTRATO, y los contratos se firman en papel;
     · el documento YA estaba firmado;
     · la clave del enlace YA NO CORRESPONDE (se rehízo el enlace).

   Los tres dejaban su explicación en `parte.notas`… y el sondeo automático
   hacía `if (parte.hubo) render()` y tiraba el resto. La fila del buzón, en
   cambio, sí quedaba marcada como recogida. O sea: la firma se consumía, la
   explicación se evaporaba, y el botón de «Buscar firmas de clientes» —que sí
   la habría enseñado— ya no encontraba nada, porque el sondeo siempre llega
   primero.

   El rechazo en sí está bien. Lo que estaba mal era rechazar sin decirlo.

   Lo que se cuida aquí:

   · que el aviso quede GUARDADO, por los tres motivos;
   · que AGUANTE UNA RECARGA (si viviera en memoria, como `nube.rechazados`,
     sería el mismo defecto con otro disfraz);
   · que se vea en el chip, sin que nadie vaya a buscarlo a Ajustes;
   · que lo sin subir le gane al aviso de firmas, que es la prioridad a
     propósito;
   · que «Firmas recibidas» encuentre una firma YA MARCADA como recogida, que
     es lo único que permite recuperar una perdida;
   · que esa pantalla NO imprima la imagen de la firma;
   · y el grupo de control que no se puede romper: una firma buena se sigue
     aplicando sola, en silencio, sin avisos de nada.

   Cómo correrla:  node pruebas/navegador/la-firma-que-no-entro.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del arreglo tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público y aquí no entra el
   nombre de ningún cliente de verdad.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8871;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Una imagen de firma de mentiras, para poder afirmar que NO se imprime. */
const IMG = 'data:image/png;base64,SOLOPARALAPRUEBA';

/* --------------------------------------------------------------------------
   El servidor de mentiras: el buzón de firmas y poco más.
   -------------------------------------------------------------------------- */
const servidor = { buzon: [], parcheadas: [] };

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

  if (u.pathname === '/rest/v1/crm_firmas'){
    if (req.method === 'GET'){
      /* El filtro que esconde el caso. `recogerFirmas` lo manda; la pantalla
         de «Firmas recibidas» tiene que NO mandarlo. */
      const soloPend = (u.searchParams.get('aplicada') || '') === 'is.false';
      return manda(200, servidor.buzon.filter(f => !soloPend || !f.aplicada));
    }
    if (req.method === 'PATCH'){
      const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
      const f = servidor.buzon.find(x => String(x.id) === id);
      if (f){ f.aplicada = true; servidor.parcheadas.push(id); }
      return manda(204, {});
    }
  }
  if (u.pathname === '/rest/v1/crm_datos'){
    if (req.method === 'GET') return manda(200, []);
    return manda(201, {});
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

/* Pestaña nueva por bloque: el CRM se sincroniza solo cada tanto y una vuelta
   de fondo del bloque anterior mediría lo que no es. */
let ctx, p;
async function equipo(docs){
  if (ctx) await ctx.close().catch(() => {});
  ctx = await br.newContext();
  p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app`);
  await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
  await p.evaluate((d) => {
    nube.url = location.origin;
    nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio', user:{ email:'admin@ejemplo.example' } };
    nube.ultimo = ''; nube.sinDuenio = false; nube.rechazados = [];
    state.clientes  = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
                                      ejecutivo:'Ana', estatus:'nuevo' })];
    state.contratos = (d || []).map(saneaContrato);
    guardar();
    localStorage.removeItem('crm-hotel-firmas-avisos');
    avisosFirma = [];
  }, docs);
}

/** Lo guardado en el navegador, que es lo que tiene que aguantar la recarga. */
const guardados = () => p.evaluate(() => {
  try{ return JSON.parse(localStorage.getItem('crm-hotel-firmas-avisos') || '[]'); }
  catch(e){ return 'NO SE PUDO LEER'; }
});

const chip = () => p.evaluate(() => {
  const el = document.getElementById('estadoNube');
  return { txt: el ? el.innerText : '', titulo: el ? el.title : '' };
});

const sincronizar1 = () => p.evaluate(() => sincronizar().then(() => nube.estado));

/* --- 1 -------------------------------------------------------------------
   EL CASO DE MARCO. Un contrato firmado en pantalla. */
await bloque('1 · firmó un contrato en pantalla: el aviso queda, no se evapora', async () => {
  servidor.buzon = [{ id:1, convenio_id:'contratos:k1', token:'la-clave', nombre:'Ana Ruiz',
                      puesto:'Gerente', celular:'664 000 0000', img:IMG,
                      aplicada:false, creado:'2026-10-28T18:00:00Z' }];
  servidor.parcheadas = [];
  await equipo([{ id:'k1', folio:'CT-2026-008', tipo:'contrato', clienteId:'c1',
                  estado:'firmado_hotel' }]);

  // El camino automático, que es el que tiraba la nota. No el botón.
  afirma('la sincronización terminó sin error', await sincronizar1() === 'listo');

  const g = await guardados();
  afirma('QUEDÓ APUNTADO QUE LLEGÓ UNA FIRMA Y NO ENTRÓ', g.length === 1);
  afirma('dice quién firmó',   !!g[0] && /Ana Ruiz/.test(g[0].txt));
  afirma('y de qué documento', !!g[0] && /CT-2026-008/.test(g[0].txt));
  afirma('y qué hacer: firmarlo en papel',
    !!g[0] && /en papel/i.test(g[0].txt) && /Registrar que se firmó en papel/.test(g[0].txt));
  afirma('tiene fecha', !!g[0] && !!g[0].fecha);

  const c = await chip();
  afirma('EL CHIP LO DICE, sin que nadie entre a Ajustes', /firma sin aplicar/i.test(c.txt));
  afirma('y al pasar el ratón explica qué pasó', /no entró al documento/i.test(c.titulo));

  // Lo que NO cambia: la fila se sigue marcando, para no repetir el aviso
  // cada quince segundos para siempre.
  afirma('la fila del buzón se sigue marcando como recogida',
    servidor.parcheadas.includes('1'));
});

/* --- 2 -------------------------------------------------------------------- */
await bloque('2 · la clave del enlace ya no corresponde', async () => {
  servidor.buzon = [{ id:2, convenio_id:'contratos:k2', token:'la-vieja', nombre:'Luis Mora',
                      img:IMG, aplicada:false, creado:'2026-10-28T19:00:00Z' }];
  servidor.parcheadas = [];
  await equipo([{ id:'k2', folio:'CT-2026-009', tipo:'cotizacion', clienteId:'c1',
                  tokenFirma:'la-de-ahora', estado:'firmado_hotel' }]);
  await sincronizar1();

  const g = await guardados();
  afirma('quedó apuntado', g.length === 1);
  afirma('dice que la clave ya no corresponde',
    !!g[0] && /clave que ya no corresponde/i.test(g[0].txt));
  afirma('y que hay que volver a mandarle el enlace',
    !!g[0] && /mandarle el enlace/i.test(g[0].txt));
  afirma('el documento NO se dio por firmado',
    await p.evaluate(() => state.contratos[0].estado) === 'firmado_hotel');
});

/* --- 3 -------------------------------------------------------------------- */
await bloque('3 · el documento ya estaba firmado', async () => {
  servidor.buzon = [{ id:3, convenio_id:'contratos:k3', token:'clave3', nombre:'Luis Mora',
                      img:IMG, aplicada:false, creado:'2026-10-28T20:00:00Z' }];
  servidor.parcheadas = [];
  await equipo([{ id:'k3', folio:'CT-2026-010', tipo:'cotizacion', clienteId:'c1',
                  tokenFirma:'clave3', estado:'aceptado',
                  firmaCliente:{ nombre:'Luis Mora', fecha:'2026-10-20T10:00:00Z', img:IMG } }]);
  await sincronizar1();

  const g = await guardados();
  afirma('quedó apuntado', g.length === 1);
  afirma('dice que se descartó una firma repetida',
    !!g[0] && /repetida/i.test(g[0].txt) && /CT-2026-010/.test(g[0].txt));
});

/* --- 4 -------------------------------------------------------------------
   Lo que `nube.rechazados` NO hace: aguantar una recarga. */
await bloque('4 · el aviso aguanta la recarga de la página', async () => {
  servidor.buzon = [{ id:4, convenio_id:'contratos:k1', token:'la-clave', nombre:'Ana Ruiz',
                      img:IMG, aplicada:false, creado:'2026-10-28T18:00:00Z' }];
  servidor.parcheadas = [];
  await equipo([{ id:'k1', folio:'CT-2026-008', tipo:'contrato', clienteId:'c1',
                  estado:'firmado_hotel' }]);
  await sincronizar1();
  afirma('antes de recargar está', (await guardados()).length === 1);

  await p.reload();
  await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });
  afirma('DESPUÉS DE RECARGAR SIGUE GUARDADO', (await guardados()).length === 1);
  afirma('y el programa lo tiene en la mano',
    await p.evaluate(() => avisosFirma.length) === 1);
});

/* --- 5 -------------------------------------------------------------------
   La prioridad del chip, que es a propósito: lo que no subió primero. */
await bloque('5 · lo que falta subir le gana al aviso de firmas', async () => {
  servidor.buzon = [];
  await equipo([]);
  await p.evaluate(() => {
    apuntarAvisosFirma(['Llegó una firma de prueba y no entró.']);
    nube.rechazados = [{ id:'clientes:c1', tipo:'clientes', motivo:'de mentiras' }];
    /* El estado que de verdad deja `sincronizar` cuando el servidor rebota un
       renglón: `nube.estado = nube.rechazados.length ? "rechazado" : "listo"`. */
    nube.estado = 'rechazado';
    pintarNube();
  });
  const c = await chip();
  afirma('el chip dice lo que falta subir', /falta subir/i.test(c.txt));
  afirma('Y NO TAPA ESO con el aviso de firmas', !/firma sin aplicar/i.test(c.txt));

  await p.evaluate(() => { nube.rechazados = []; nube.estado = 'listo'; pintarNube(); });
  afirma('en cuanto no falta nada por subir, sale el de firmas',
    /firma sin aplicar/i.test((await chip()).txt));
});

/* --- 6 -------------------------------------------------------------------
   LA QUE RECUPERA EL CASO: el buzón se lee sin el filtro que lo esconde. */
await bloque('6 · «Firmas recibidas» encuentra una firma YA recogida', async () => {
  servidor.buzon = [{ id:6, convenio_id:'contratos:k1', token:'la-clave', nombre:'Ana Ruiz',
                      puesto:'Gerente', img:IMG,
                      aplicada:true,                      // el sondeo ya pasó por ella
                      creado:'2026-10-28T18:00:00Z' }];
  await equipo([{ id:'k1', folio:'CT-2026-008', tipo:'contrato', clienteId:'c1',
                  estado:'firmado_hotel' }]);
  afirma('el buzón de pendientes la da por recogida: así se perdía',
    (await p.evaluate(() => recogerFirmas().then(x => x.pendientes))) === 0);

  await p.evaluate(() => firmasRecibidas());
  await p.locator('.overlay .modal-body').waitFor({ timeout:10000 });
  const txt = await p.locator('.overlay .modal-body').innerText();
  const html = await p.locator('.overlay .modal-body').innerHTML();

  afirma('LA ENCUENTRA, aunque esté marcada como recogida', /Ana Ruiz/.test(txt));
  afirma('dice de qué documento', /CT-2026-008/.test(txt));
  afirma('dice cuándo firmó',     /oct/i.test(txt) && /2026/.test(txt));
  afirma('dice que ya se había recogido', /ya recogida/i.test(txt));
  afirma('y dice qué hacer con ella', /en papel/i.test(txt));
  afirma('NO IMPRIME LA IMAGEN DE LA FIRMA',
    !html.includes('SOLOPARALAPRUEBA') && !/data:image/.test(html));
});

/* --- 7 -------------------------------------------------------------------
   EL GRUPO DE CONTROL. Lo que se arregló es el silencio, no el camino feliz:
   una firma buena se sigue aplicando sola y sin avisarle nada a nadie. */
await bloque('7 · una firma buena se sigue aplicando sola, y sin avisos', async () => {
  servidor.buzon = [{ id:7, convenio_id:'contratos:k7', token:'la-buena', nombre:'Ana Ruiz',
                      puesto:'Gerente', celular:'664 000 0000', img:IMG,
                      aplicada:false, creado:'2026-10-29T10:00:00Z' }];
  servidor.parcheadas = [];
  await equipo([{ id:'k7', folio:'CT-2026-011', tipo:'cotizacion', clienteId:'c1',
                  tokenFirma:'la-buena', estado:'firmado_hotel' }]);
  await sincronizar1();

  const k = await p.evaluate(() => {
    const x = state.contratos[0];
    return { estado:x.estado, firma:!!(x.firmaCliente && x.firmaCliente.img),
             quien:(x.firmaCliente || {}).nombre, token:x.tokenFirma };
  });
  afirma('el documento quedó aceptado', k.estado === 'aceptado');
  afirma('con la firma del cliente adentro', k.firma && k.quien === 'Ana Ruiz');
  afirma('y la clave del enlace se apagó', k.token === '');
  afirma('NO SE LE AVISÓ NADA A NADIE', (await guardados()).length === 0);
  afirma('y el chip sigue diciendo que está en línea',
    /en línea/i.test((await chip()).txt) === true ||
    !/firma sin aplicar/i.test((await chip()).txt));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
