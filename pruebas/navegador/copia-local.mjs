/* ===========================================================================
   LA COPIA DE ESTE NAVEGADOR

   Marco, con 58 clientes y 49 convenios —o sea, con casi nada—: «No puedo
   tener tan poco almacenamiento, ya que es un CRM empresarial y no me
   gustaría tener este problema en un futuro. Si ahorita que estamos en fase
   de pruebas ya se llenó…».

   Tenía razón. `localStorage` acepta 5,177,344 caracteres y se acabó; ese
   tope no lo sube nadie. El MISMO navegador ofrece IndexedDB, donde la cuota
   se mide en cientos de megas. La copia se muda ahí.

   Lo que se prueba aquí es lo que puede salir mal al mudarse, que es mucho
   más que «¿cabe?»:
     · que la copia se escriba en las dos partes mientras dure la mudanza;
     · que doscientos guardados seguidos no sean doscientas escrituras;
     · que la gaveta chica llena deje de ser una desgracia;
     · y que sin IndexedDB —modo privado— todo siga como el primer día.

   Cómo correrla:  node pruebas/navegador/copia-local.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8810;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Dos rutas del MISMO origen: la aplicación, y una página pelona.

   La pelona es la que permite sembrar IndexedDB ANTES de que la aplicación
   corra: `addInitScript` no puede esperar a nada asíncrono, así que se entra
   a `/vacio`, se siembra con calma, y de ahí se va a `/`. */
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/vacio')){
    r.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return r.end('<!doctype html><meta charset="utf-8"><title>vacio</title><body>');
  }
  r.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
  r.end(fs.readFileSync(APP, 'utf8'));
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

/** Una pestaña limpia, con su propio almacenamiento. */
async function pestana(antes){
  const ctx = await br.newContext({ viewport:{ width:1280, height:900 } });
  if (antes) await ctx.addInitScript(antes);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  p.on('dialog', d => d.accept().catch(() => {}));
  return { ctx, p, errores };
}

const abrir = async eq => {
  await eq.p.goto(`http://127.0.0.1:${PUERTO}/`);
  await eq.p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });
};

await bloque('1 · la copia se escribe en las dos partes', async () => {
  const eq = await pestana();
  await abrir(eq);
  const r = await eq.p.evaluate(async () => {
    state.clientes = [saneaCliente({ id:'cA', empresa:'EMPRESA DE EJEMPLO UNO' })];
    guardar();
    await new Promise(r => setTimeout(r, 400));
    const b = await leerDeBodega('copia');
    return {
      enBodega: !!b && /EMPRESA DE EJEMPLO UNO/.test(b.json),
      enGaveta: /EMPRESA DE EJEMPLO UNO/.test(localStorage.getItem(STORE) || ''),
      selloCuadra: !!b && String(b.t) === localStorage.getItem(STORE + ':sello')
    };
  });
  afirma('queda en la bodega grande', r.enBodega);
  /* Y también en la chica, a propósito, mientras dure la mudanza: así una
     pestaña con la versión vieja sigue trabajando, y revertir una publicación
     no deja a nadie sin datos. */
  afirma('y también en la gaveta chica', r.enGaveta);
  /* El sello es lo único que se escribe de forma síncrona. Sirve para saber,
     al arrancar, si el último cambio alcanzó a llegar a la bodega. */
  afirma('con el mismo sello en las dos', r.selloCuadra);
  afirma('sin un solo error en la página', eq.errores.length === 0);
  await eq.ctx.close();
});

await bloque('2 · doscientos guardados no son doscientas escrituras', async () => {
  const eq = await pestana();
  await abrir(eq);
  const r = await eq.p.evaluate(async () => {
    /* Importar una lista llama a `guardar()` en cada renglón. Encolar una
       escritura por cada uno pondría a la bodega a escribir diez megas
       doscientas veces; lo que se hace es quedarse siempre con la última. */
    let escrituras = 0;
    const real = window.escribirEnBodega;
    window.escribirEnBodega = (...a) => { escrituras++; return real(...a); };
    state.clientes = [saneaCliente({ id:'cB', empresa:'V0' })];
    for (let i = 0; i < 200; i++){ state.clientes[0].empresa = 'V' + i; guardar(); }
    await new Promise(r => setTimeout(r, 700));
    window.escribirEnBodega = real;
    const b = await leerDeBodega('copia');
    return { escrituras, ultimo: !!b && /"empresa":"V199"/.test(b.json) };
  });
  afirma('gana lo último que se escribió', r.ultimo);
  /* El número exacto depende de cuánto tarde cada escritura; lo que no puede
     pasar es que sean doscientas. */
  afirma(`y se escribió un puñado de veces, no 200 (fueron ${r.escrituras})`,
    r.escrituras > 0 && r.escrituras < 20);
  await eq.ctx.close();
});

await bloque('3 · la gaveta chica llena deja de ser una desgracia', async () => {
  const eq = await pestana();
  await abrir(eq);
  const r = await eq.p.evaluate(async () => {
    const avisos = [];
    const orig = window.alert;
    window.alert = m => avisos.push(String(m));
    /* Se simula lo que le pasó a él: `localStorage` lleno de verdad contesta
       con una QuotaExceededError. */
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k){
      if (k === STORE){ const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; }
      return real.apply(this, arguments);
    };
    try{
      state.clientes = [saneaCliente({ id:'cC', empresa:'CON LA GAVETA LLENA' })];
      guardar();
      await new Promise(r => setTimeout(r, 500));
    } finally { Storage.prototype.setItem = real; window.alert = orig; }
    const b = await leerDeBodega('copia');
    return { salvado: !!b && /CON LA GAVETA LLENA/.test(b.json),
             avisos: avisos.length,
             letrero: !!document.getElementById('avisoAlmacen') };
  });
  /* Esto es lo medular del cambio: lo que antes era «la aplicación ya no
     puede guardar nada» ahora es un cajón chico que se llenó y ya. */
  afirma('lo que no cupo en la chica se guardó en la grande', r.salvado);
  afirma('y no se asusta a nadie con un aviso', r.avisos === 0);
  afirma('ni se pone el letrero rojo', !r.letrero);
  await eq.ctx.close();
});

await bloque('4 · sin IndexedDB, todo sigue como el primer día', async () => {
  /* Modo privado, o un navegador con el almacenamiento bloqueado. No puede
     ser peor que antes de la mudanza. */
  const eq = await pestana(() => {
    Object.defineProperty(window, 'indexedDB', { get(){ return undefined; } });
  });
  await abrir(eq);
  /* La entrada tarda 2.25 s de animación: eso es normal. Lo que NO puede
     pasar es que se quede, porque a los 6 s el seguro del <head> la quita y
     enseña la caja de «CORE no pudo abrir». Así que se mide contra los 6 s,
     no contra cero. */
  const seQuito = await eq.p.waitForFunction(
    () => !document.getElementById('intro'), null, { timeout:6000 }
  ).then(() => true).catch(() => false);

  const r = await eq.p.evaluate(async () => {
    state.clientes = [saneaCliente({ id:'cD', empresa:'SIN BODEGA' })];
    guardar();
    await new Promise(r => setTimeout(r, 300));
    return { enGaveta: /SIN BODEGA/.test(localStorage.getItem(STORE) || ''),
             hayBodega: hayBodega(),
             caja: /no pudo abrir/i.test(document.body.innerText || '') };
  });
  afirma('se guarda en la gaveta chica, como siempre', r.enGaveta);
  afirma('y la aplicación sabe que no hay bodega', r.hayBodega === false);
  /* Lo que no se puede permitir: que la falta de IndexedDB deje la pantalla
     de entrada puesta. Es el fallo que ya costó caro una vez. */
  afirma('la pantalla de entrada se quita antes de los 6 s', seQuito);
  afirma('y no sale la caja de «no pudo abrir»', !r.caja);
  afirma('sin un solo error en la página', eq.errores.length === 0);
  await eq.ctx.close();
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
