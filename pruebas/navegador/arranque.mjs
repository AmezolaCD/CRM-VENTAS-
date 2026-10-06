/* ===========================================================================
   QUE LA APLICACIÓN ABRA

   Marco se quedó mirando el logo morado de la entrada y ya no pasaba nada. En
   una ventana de incógnito sí abría, y eso dijo todo: el archivo publicado
   estaba bien, lo que la mataba eran LOS DATOS GUARDADOS de ese navegador.

   El motivo: `cargar()` corría arriba en el archivo y tocaba cosas declaradas
   más abajo —`TIPOS_CERT`, `cargaRota`, `nuevoId`—. En JavaScript una `const`
   no existe todavía antes de su renglón: tocarla revienta, y como pasa en el
   nivel de arriba del script se cae TODO, sin mensaje y sin consola abierta.
   Con el almacenamiento vacío no se notaba —las listas venían vacías y esas
   líneas nunca llegaban a correr—; con datos de verdad, sí.

   Esta prueba es la que faltaba: se le pone al navegador un almacenamiento
   como el de Marco y se EXIGE que la aplicación abra. Y de pasada se exige lo
   otro que falló, que es lo que más dolió: que una pantalla morada nunca más
   se quede callada.

   Cómo correrla:  node pruebas/navegador/arranque.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8809;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const STORE = 'crm-hotel-v3';

/* El archivo se sirve tal cual; /roto sirve el mismo con una bomba metida al
   principio del script grande, para probar el seguro. */
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/roto'){
    const html = fs.readFileSync(APP, 'utf8');
    const i = html.lastIndexOf('<script>');
    const roto = html.slice(0, i + 8) +
      '\nnoExisteEstaFuncion();\n' + html.slice(i + 8);
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(roto);
  }
  res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
  res.end(fs.readFileSync(APP, 'utf8'));
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
 * Abre la aplicación con un almacenamiento puesto a mano, como el del equipo
 * de alguien que ya la venía usando, y devuelve en qué estado quedó.
 *
 * Cada caso en su propia ventana limpia: así lo guardado es exactamente lo
 * que se le puso y nada más.
 */
async function abrirCon(guardado, ruta = '/'){
  const ctx = await br.newContext({ viewport:{ width:1200, height:900 } });
  const errores = [], avisos = [];
  await ctx.addInitScript(([k, v]) => {
    try{ if (v !== null) localStorage.setItem(k, v); }catch(e){}
  }, [STORE, guardado]);
  const p = await ctx.newPage();
  p.on('pageerror', e => errores.push(e.message));
  p.on('dialog', d => { avisos.push(d.message()); d.accept().catch(() => {}); });
  await p.goto(`http://127.0.0.1:${PUERTO}${ruta}`);

  /* Lo único que se espera es tiempo: a los 2.25 s la entrada se quita sola y
     a los 6 s la quita el seguro. Pasados los 7 no hay excusa. */
  await p.waitForTimeout(7200);

  const est = await p.evaluate(() => {
    const vale = f => { try{ return f(); }catch(e){ return null; } };
    const board = document.getElementById('board');
    return {
      entrada:   !!document.getElementById('intro'),
      claseIntro: document.documentElement.classList.contains('intro-activa'),
      caja:      !!document.getElementById('core-falla'),
      textoCaja: vale(() => (document.getElementById('core-falla') || {}).innerText) || '',
      tablero:   !!board && board.children.length > 0,
      pestañas:  document.querySelectorAll('nav button[data-view]').length,
      clientes:  vale(() => state.clientes.length),
      certs:     vale(() => state.certificados.length),
      sinId:     vale(() => state.clientes.filter(c => !c.id).length),
      rota:      vale(() => cargaRota),
      enDisco:   vale(() => localStorage.getItem('crm-hotel-v3'))
    };
  });
  await ctx.close();
  return { ...est, errores, avisos };
}

/** Una cartera creíble: dos clientes, una actividad y un convenio. */
const cartera = extra => JSON.stringify(Object.assign({
  clientes: [
    { id:'c1', empresa:'EMPRESA UNO', contacto:'Quien Sea',
      telefono:'6640000000', email:'uno@ejemplo.example', estatus:'propuesta', tarifa:1200 },
    { id:'c2', empresa:'EMPRESA DOS', contacto:'Alguien Más',
      telefono:'6640000001', email:'dos@ejemplo.example', estatus:'ganado', tarifa:1800 }],
  actividades: [{ id:'a1', clienteId:'c1', tipo:'llamada', fecha:'2026-10-01', nota:'Se le marcó' }],
  convenios:   [{ id:'v1', clienteId:'c2', folio:'CV-2026-001', estado:'borrador' }]
}, extra || {}));

/* ---------------------------------------------------------------------------
   1 · El caso de Marco: un borrador de certificado guardado.

   Probó la pestaña nueva, guardó un borrador, y desde ese momento cada vez
   que ese navegador arrancaba leía ese renglón, tocaba `TIPOS_CERT` —que
   vivía 1400 renglones más abajo— y se caía antes de pintar nada.
   --------------------------------------------------------------------------- */
await bloque('1 · con un certificado guardado, la aplicación ABRE', async () => {
  const guardado = cartera({ certificados: [
    { id:'ce1', folio:'', tipo:'spa_facial', paraQuien:'DÍA DE LAS MADRES',
      desde:'2026-05-10', hasta:'2026-06-30', estado:'borrador' }] });
  const r = await abrirCon(guardado);
  if (r.errores.length) console.log('        ↳ ' + r.errores[0]);
  afirma('no reventó nada', r.errores.length === 0);
  afirma('el logo de entrada se quitó', !r.entrada && !r.claseIntro);
  afirma('el tablero se pintó', r.tablero);
  afirma('con sus pestañas', r.pestañas > 0);
  afirma('los clientes guardados están ahí', r.clientes === 2);
  afirma('y el certificado también', r.certs === 1);
  afirma('no se dio por rota la carga', r.rota === false);
  afirma('no salió la caja de "no pudo abrir"', !r.caja);
});

/* ---------------------------------------------------------------------------
   2 · La otra bomba, más vieja: un renglón sin `id`.

   `saneaCliente` le pone uno con `nuevoId`, que también se declaraba después
   de `cargar()`. Le tocaba a cualquiera que hubiera importado un Excel.
   --------------------------------------------------------------------------- */
await bloque('2 · con un renglón sin id, la aplicación ABRE y se lo pone', async () => {
  const guardado = cartera({ clientes: [
    { empresa:'SIN IDENTIFICADOR', contacto:'Vino de un Excel', estatus:'contactado' },
    { id:'c2', empresa:'EMPRESA DOS', contacto:'Alguien Más', estatus:'ganado' }] });
  const r = await abrirCon(guardado);
  if (r.errores.length) console.log('        ↳ ' + r.errores[0]);
  afirma('no reventó nada', r.errores.length === 0);
  afirma('el logo de entrada se quitó', !r.entrada && !r.claseIntro);
  afirma('el tablero se pintó', r.tablero);
  afirma('los dos clientes están', r.clientes === 2);
  afirma('ninguno quedó sin id', r.sinId === 0);
  afirma('no salió la caja de "no pudo abrir"', !r.caja);
});

/* ---------------------------------------------------------------------------
   3 · El almacenamiento echado a perder.

   Aquí lo que importa no es sólo que abra, sino que NO PISE lo que había: si
   cayera a los clientes de ejemplo y guardara encima, la cartera de verdad se
   perdería por un error de programación y nadie se enteraría.
   --------------------------------------------------------------------------- */
await bloque('3 · con el almacenamiento corrupto, abre, avisa y NO pisa nada', async () => {
  const basura = '{"clientes":[{"empresa":"ESTO ESTÁ CORTADO",';
  const r = await abrirCon(basura);
  afirma('el logo de entrada se quitó', !r.entrada && !r.claseIntro);
  afirma('el tablero se pintó', r.tablero);
  afirma('avisó al ejecutivo', r.avisos.some(a => /no se pudieron leer/i.test(a)));
  afirma('dice que no se borró nada', r.avisos.some(a => /no se borr/i.test(a)));
  afirma('se marcó la carga como rota', r.rota === true);
  afirma('abrió y NO escribió encima de lo que había', r.tablero && r.enDisco === basura);
  afirma('tampoco metió los clientes de ejemplo', r.clientes === 0);
});

/* ---------------------------------------------------------------------------
   4 · Que una pantalla morada no se quede callada.

   Esto es lo que de verdad falló: hubo un error y nadie lo supo —ni el
   ejecutivo, ni yo— hasta que Marco probó el incógnito. Se sirve el mismo
   archivo con una bomba al principio del script grande: lo que se exige no es
   que funcione, es que SE VEA que no funcionó.
   --------------------------------------------------------------------------- */
await bloque('4 · si el script grande muere, se dice QUÉ pasó', async () => {
  const r = await abrirCon(cartera(), '/roto');
  afirma('el logo de entrada no se quedó eterno', !r.entrada && !r.claseIntro);
  afirma('salió la caja con el aviso', r.caja);
  afirma('dice que no pudo abrir', /no pudo abrir/i.test(r.textoCaja));
  afirma('dice que los datos no se perdieron', /no se perdió nada/i.test(r.textoCaja));
  afirma('enseña el error de verdad', /noExisteEstaFuncion/.test(r.textoCaja));
  afirma('y en qué renglón', /renglón \d+/.test(r.textoCaja));
  afirma('se puede copiar el aviso', /copiar el aviso/i.test(r.textoCaja));
});

/* ---------------------------------------------------------------------------
   5 · Sin nada guardado, como la primera vez.
   --------------------------------------------------------------------------- */
await bloque('5 · un equipo nuevo abre como siempre', async () => {
  const r = await abrirCon(null);
  if (r.errores.length) console.log('        ↳ ' + r.errores[0]);
  afirma('no reventó nada', r.errores.length === 0);
  afirma('el logo de entrada se quitó', !r.entrada && !r.claseIntro);
  afirma('el tablero se pintó', r.tablero);
  afirma('trae los clientes de ejemplo', r.clientes > 0);
  afirma('la carga no se dio por rota', r.rota === false);
  afirma('y sí guardó', typeof r.enDisco === 'string' && r.enDisco.length > 100);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
