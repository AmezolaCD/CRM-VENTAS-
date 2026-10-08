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

/* --------------------------------------------------------------------------
   LEER DE LA BODEGA AL ARRANCAR

   Aquí es donde esto se puede romper caro. Sembrar IndexedDB antes de que la
   aplicación corra necesita una página del MISMO origen que no sea la
   aplicación: `/vacio`. Se entra ahí, se siembra con calma, y de ahí a `/`.
   -------------------------------------------------------------------------- */

/** Deja una copia puesta en la bodega, con su sello, antes de abrir la app. */
async function sembrarBodega(eq, estado, sello){
  await eq.p.goto(`http://127.0.0.1:${PUERTO}/vacio`);
  await eq.p.evaluate(async ([json, t]) => {
    const db = await new Promise((ok, no) => {
      const q = indexedDB.open('crm-hotel', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('copia');
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    });
    await new Promise((ok, no) => {
      const tx = db.transaction('copia', 'readwrite');
      tx.objectStore('copia').put({ v:1, t, json }, 'copia');
      tx.oncomplete = ok; tx.onerror = () => no(tx.error);
    });
    db.close();
  }, [JSON.stringify(estado), sello]);
}

/** Y una en la gaveta chica, con su sello y sus ids, como los deja guardar(). */
async function sembrarGaveta(eq, estado, sello, ids){
  await eq.p.goto(`http://127.0.0.1:${PUERTO}/vacio`);
  await eq.p.evaluate(([json, t, lista]) => {
    localStorage.setItem('crm-hotel-v3', json);
    if (t) localStorage.setItem('crm-hotel-v3:sello', String(t));
    if (lista) localStorage.setItem('crm-hotel-v3:ids', JSON.stringify(lista));
  }, [JSON.stringify(estado), sello, ids || null]);
}

const carteraDe = n => ({
  clientes: Array.from({ length:n }, (_, i) =>
    ({ id:'c' + i, empresa:'EMPRESA DE EJEMPLO ' + i, estatus:'nuevo' }))
});

await bloque('5 · la copia de la gaveta chica se muda sola a la bodega', async () => {
  const eq = await pestana();
  await sembrarGaveta(eq, carteraDe(3), Date.now());
  await abrir(eq);
  const r = await eq.p.evaluate(async () => {
    await new Promise(r => setTimeout(r, 500));
    const b = await leerDeBodega('copia');
    return { cuantos: state.clientes.length,
             enBodega: !!b && /EMPRESA DE EJEMPLO 2/.test(b.json),
             /* La de la gaveta chica NO se borra todavía, a propósito: así
                una pestaña con la versión de antes sigue trabajando y
                revertir una publicación no deja a nadie sin datos. */
             gavetaIntacta: /EMPRESA DE EJEMPLO 2/.test(localStorage.getItem(STORE) || '') };
  });
  afirma('los tres clientes siguen ahí', r.cuantos === 3);
  afirma('y ya quedaron copiados en la bodega', r.enBodega);
  afirma('sin borrar la copia de la gaveta chica', r.gavetaIntacta);
  afirma('sin un solo error en la página', eq.errores.length === 0);
  await eq.ctx.close();
});

await bloque('6 · una copia que JAMÁS cabría en la gaveta chica', async () => {
  /* Esto es lo que justifica el cambio entero: 12 MB es más del doble de lo
     que `localStorage` acepta, y tiene que abrir y poderse seguir usando. */
  const eq = await pestana();
  const gorda = carteraDe(2);
  gorda.clientes[0].notas = 'x'.repeat(12 * 1024 * 1024);
  await sembrarBodega(eq, gorda, Date.now());
  await abrir(eq);
  const r = await eq.p.evaluate(async () => {
    const antes = state.clientes[0].notas.length;
    state.clientes.push(saneaCliente({ id:'cNuevo', empresa:'AGREGADO CON 12 MB DENTRO' }));
    guardar();
    await new Promise(r => setTimeout(r, 700));
    const b = await leerDeBodega('copia');
    return { antes, cuantos: state.clientes.length,
             seGuardo: !!b && /AGREGADO CON 12 MB DENTRO/.test(b.json),
             letrero: !!document.getElementById('avisoAlmacen'),
             renglon: renglonDelPeso(),
             techo: techoDelAlmacen() };
  });
  afirma('abre con los 12 MB puestos', r.antes === 12 * 1024 * 1024);
  afirma('y se le puede agregar algo encima', r.cuantos === 3 && r.seGuardo);
  /* Con esto, el letrero rojo que le salió a Marco deja de tener razón de
     ser: ya no hay un tope de 10 MB contra el que estrellarse. */
  afirma('sin el letrero de «ya no puedo guardar»', !r.letrero);
  /* Y el aviso de «te estás acercando al tope» tampoco: desde que la copia
     vive en la bodega, el techo es lo que da el navegador para el sitio
     entero. Seguir midiendo contra los 10 MB de la gaveta chica pondría el
     letrero rojo a alguien que va por el 2% de su espacio. */
  afirma('ni el aviso rojo de que se está acercando al tope',
    !/acercando al tope/i.test(r.renglon));
  afirma('porque el techo ya es el del navegador, no el de la gaveta',
    r.techo > 100 * 1024 * 1024);
  afirma('sin un solo error en la página', eq.errores.length === 0);
  await eq.ctx.close();
});

await bloque('7 · gana la copia más nueva, no la de un lado fijo', async () => {
  /* Si la gaveta chica se llenó, la suya quedó vieja y la buena es la de la
     bodega. Pero puede pasar al revés —una pestaña con la versión de antes
     guardó después—, y entonces la buena es la otra. Se escoge por sello. */
  const eq = await pestana();
  const vieja = carteraDe(1); vieja.clientes[0].empresa = 'LA VIEJA';
  const nueva = carteraDe(1); nueva.clientes[0].empresa = 'LA NUEVA';
  await sembrarBodega(eq, vieja, 1000);
  await sembrarGaveta(eq, nueva, 9000);
  await abrir(eq);
  const a = await eq.p.evaluate(() => state.clientes[0].empresa);
  afirma('con la gaveta más nueva, gana la gaveta', a === 'LA NUEVA');
  await eq.ctx.close();

  const eq2 = await pestana();
  await sembrarGaveta(eq2, vieja, 1000);
  await sembrarBodega(eq2, nueva, 9000);
  await abrir(eq2);
  const b = await eq2.p.evaluate(() => state.clientes[0].empresa);
  afirma('y con la bodega más nueva, gana la bodega', b === 'LA NUEVA');
  await eq2.ctx.close();
});

await bloque('8 · LAS LÁPIDAS: no se borra una cartera por arrancar', async () => {
  /* El peor escenario posible, y el que encontró la revisión. `guardar()`
     compara los ids de ahora contra los de la última vez y sube como
     BORRADO todo lo que falte. Si el almacenamiento se vacía —o se entra con
     la cartera de demostración— y el punto de comparación sigue puesto, el
     arranque tumbaría la cartera entera y la subiría borrada a la nube.

     Se siembran 40 ids de comparación y NINGUNA copia. */
  const eq = await pestana();
  await eq.p.goto(`http://127.0.0.1:${PUERTO}/vacio`);
  await eq.p.evaluate(ids => {
    localStorage.setItem('crm-hotel-v3:ids', JSON.stringify(ids));
  }, Array.from({ length:40 }, (_, i) => 'clientes:c' + i));
  await abrir(eq);
  const r = await eq.p.evaluate(async () => {
    await new Promise(r => setTimeout(r, 400));
    return { lapidas: tumbas.size,
             enDisco: (() => {
               try{ return (JSON.parse(localStorage.getItem(STORE + ':tumbas')) || []).length; }
               catch(e){ return -1; }
             })() };
  });
  afirma('no se inventa ni una lápida', r.lapidas === 0);
  afirma('ni queda ninguna apuntada en el equipo', r.enDisco === 0);
  await eq.ctx.close();
});

await bloque('9 · la liga del cliente no toca la copia del hotel', async () => {
  /* El cliente abre su liga de firma en la computadora del dueño. Esa
     pantalla no es el CRM y no tiene por qué esperar a leer nada — pero el
     `guardar()` del arranque corría también para ella, y con la copia sin
     leer eso escribía el vacío encima de la cartera. */
  const eq = await pestana();
  await sembrarBodega(eq, carteraDe(5), Date.now());
  const liga = Buffer.from(JSON.stringify(
      { v:1, t:'convenio', u:'noexiste', k:'claveinventada' }), 'utf8')
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await eq.p.goto(`http://127.0.0.1:${PUERTO}/#firmar=${liga}`);
  await eq.p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });
  await eq.p.waitForTimeout(2500);
  const r = await eq.p.evaluate(async () => {
    const b = await leerDeBodega('copia');
    return { sigueEntera: !!b && /EMPRESA DE EJEMPLO 4/.test(b.json),
             cuantos: b ? (JSON.parse(b.json).clientes || []).length : -1,
             escribe: copiaViva,
             lapidas: tumbas.size };
  });
  afirma('la copia del hotel queda intacta', r.sigueEntera && r.cuantos === 5);
  afirma('y la pantalla del cliente tiene prohibido escribirla', r.escribe === false);
  afirma('sin inventar lápidas', r.lapidas === 0);
  await eq.ctx.close();
});

await bloque('10 · si la bodega se cuelga, la aplicación abre igual', async () => {
  /* Un `open()` que no contesta nunca. Es exactamente lo que dejaría la
     pantalla morada puesta hasta que el seguro del <head> enseñara la caja
     de «CORE no pudo abrir» — lo que ya pasó una vez. */
  /* `window.indexedDB` es de sólo lectura: asignarle encima no hace nada y la
     prueba pasaría sin haber probado nada. Va con defineProperty. */
  const eq = await pestana(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get(){ return { open(){ return { onsuccess:null, onerror:null,
                                       onupgradeneeded:null, onblocked:null }; } }; }
    });
  });
  const t0 = Date.now();
  await eq.p.goto(`http://127.0.0.1:${PUERTO}/`);
  await eq.p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });
  const seQuito = await eq.p.waitForFunction(
    () => !document.getElementById('intro'), null, { timeout:6000 }
  ).then(() => true).catch(() => false);
  const tardo = Date.now() - t0;

  const r = await eq.p.evaluate(async () => {
    const antes = JSON.stringify(state.clientes || []);
    state.clientes = [saneaCliente({ id:'cX', empresa:'ESTO NO DEBE GUARDARSE' })];
    guardar();
    await new Promise(r => setTimeout(r, 300));
    return { antes,
             escribe: copiaViva,
             letrero: (document.getElementById('avisoAlmacen') || {}).textContent || '',
             gaveta: localStorage.getItem(STORE) || '' };
  });
  afirma('la pantalla de entrada se quita antes de los 6 s', seQuito);
  afirma(`y no se tarda una eternidad (fueron ${tardo} ms)`, tardo < 6000);
  /* Lo medular: con la copia sin leer, NO se escribe. Escribir encima de lo
     que no se pudo leer es la manera de perder los nueve megas del dueño. */
  afirma('la aplicación queda de sólo lectura', r.escribe === false);
  afirma('y no escribe nada en el equipo', !/ESTO NO DEBE GUARDARSE/.test(r.gaveta));
  afirma('con un letrero que lo dice', /sólo lectura|SÓLO LECTURA/i.test(r.letrero));
  await eq.ctx.close();
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
