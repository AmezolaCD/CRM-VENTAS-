/* ===========================================================================
   LAS FIRMAS NO PUEDEN LLENAR EL NAVEGADOR

   Marco, a media jornada: «No se pudo guardar en este navegador
   (almacenamiento lleno o bloqueado)».

   El navegador le da a cada sitio unos 5 MB. Una firma se guardaba como el
   lienzo COMPLETO a la resolución de la pantalla —en un teléfono, 1,360 px de
   ancho por puro `devicePixelRatio`—, con fondo blanco y en PNG: 115 KB cada
   una, dos por documento. A los veintitantos documentos firmados la
   aplicación dejaba de poder guardar NADA.

   Lo que se prueba:
     · que una firma nueva pesa una fracción de lo que pesaba;
     · que se recorta lo BLANCO y no el trazo —la firma se ve igual—;
     · que un lienzo sin trazar no se rompe ni se encoge a un punto;
     · que el compactador achica las que ya estaban guardadas;
     · y que lo hace sin tocar el nombre, el puesto ni la fecha de la firma.

   Cómo correrla:  node pruebas/navegador/firmas-que-no-llenan.mjs
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8809;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const srv = http.createServer((q, r) => {
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
const p  = await br.newPage({ viewport:{ width:1280, height:900 } });
p.on('pageerror', e => { console.log('  FALLA ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/`);
await p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });

/* Un lienzo como el del teléfono de un ejecutivo: el ancho de la pantalla por
   el `devicePixelRatio` de 3, y la firma trazada a lo largo de casi todo él,
   que es como firma la gente. */
const lienzo = (ancho, alto, deAncho) => `(() => {
  const cv = document.createElement('canvas');
  cv.width = ${ancho}; cv.height = ${alto};
  const c = cv.getContext('2d');
  c.strokeStyle = '#39104e'; c.lineWidth = ${ancho} / 170;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  const x0 = cv.width * (1 - ${deAncho}) / 2, w = cv.width * ${deAncho};
  for (let i = 0; i <= 400; i++){
    const t = i / 400;
    const x = x0 + w * t;
    const y = cv.height / 2 + Math.sin(t * 18) * cv.height * 0.33
                            + Math.sin(t * 47) * cv.height * 0.1;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke();
  return cv;
})()`;
/** La firma de un teléfono: llena el pad. Es el caso que llenaba el navegador. */
const LIENZO = lienzo(1020, 480, 0.86);

await bloque('1 · una firma nueva no puede pesar lo de antes', async () => {
  const r = await p.evaluate(`(() => {
    const cv = ${LIENZO};
    // Lo de antes: el lienzo entero, con su fondo blanco, tal cual.
    const antes = (() => {
      const o = document.createElement('canvas');
      o.width = cv.width; o.height = cv.height;
      const c = o.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, o.width, o.height);
      c.drawImage(cv, 0, 0);
      return o.toDataURL('image/png');
    })();
    const ahora = padAPng(cv);
    return { antes: antes.length, ahora: ahora.length, img: ahora };
  })()`);
  const kb = n => Math.round(n * 2 / 1024);
  console.log(`         antes ${kb(r.antes)} KB → ahora ${kb(r.ahora)} KB`);
  /* El número exacto depende del trazo; lo que no puede pasar es que siga
     costando lo mismo. Con el lienzo del teléfono, la diferencia es de
     más de 5 a 1. */
  afirma('pesa menos de la cuarta parte', r.ahora * 4 < r.antes);
  afirma('y por debajo de 30 KB en el navegador', kb(r.ahora) < 30);
  afirma('sigue siendo un PNG', /^data:image\/png;base64,/.test(r.img));
});

await bloque('2 · lo que se recorta es blanco, no el trazo', async () => {
  const r = await p.evaluate(`(async () => {
    const cv = ${LIENZO};
    const img = new Image();
    img.src = padAPng(cv);
    await img.decode();
    const o = document.createElement('canvas');
    o.width = img.naturalWidth; o.height = img.naturalHeight;
    const c = o.getContext('2d');
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, o.width, o.height).data;
    let tinta = 0, blancoBorde = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 236 || d[i+1] < 236 || d[i+2] < 236) tinta++;
    // El renglón de más arriba y el de más abajo deben ser casi todo blanco:
    // es el aire que se deja a propósito para que la firma no quede pegada.
    for (const y of [0, o.height - 1])
      for (let x = 0; x < o.width; x++){
        const i = (y * o.width + x) * 4;
        if (d[i] > 236 && d[i+1] > 236 && d[i+2] > 236) blancoBorde++;
      }
    return { w:o.width, h:o.height, tinta, total:o.width * o.height,
             blancoBorde, bordeTotal:o.width * 2 };
  })()`);
  console.log(`         queda ${r.w}x${r.h}, ${Math.round(r.tinta * 100 / r.total)}% de tinta`);
  /* En el lienzo de 1020x480 el trazo ocupa 420x~140. Lo guardado tiene que
     parecerse a ESO, no al lienzo. */
  afirma('el ancho se queda en el del trazo, no en el del lienzo', r.w <= 600);
  afirma('y la altura también', r.h < 300);
  /* Lo medular: que no se haya recortado el trazo. Si se hubiera comido un
     pedazo, la tinta tocaría el borde. */
  afirma('el trazo no toca el borde: no se cortó nada',
    r.blancoBorde === r.bordeTotal);
  afirma('y la firma sigue ahí, no se borró', r.tinta > 500);
});

await bloque('3 · un lienzo sin trazar no se rompe', async () => {
  const r = await p.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 800; cv.height = 300;
    const img = padAPng(cv);
    const caja = cajaDeLoTrazado(cv);
    return { img: img.slice(0, 22), caja };
  });
  /* Sin trazo no hay caja que recortar: se devuelve el lienzo entero. Un «0x0»
     aquí sería un PNG inválido y una firma rota en un documento. */
  afirma('devuelve el lienzo completo', r.caja.w === 800 && r.caja.h === 300);
  afirma('y un PNG de verdad', r.img === 'data:image/png;base64,');
});

await bloque('4 · el compactador achica las que ya estaban guardadas', async () => {
  const r = await p.evaluate(`(async () => {
    const cv = ${LIENZO};
    // Una firma «de las de antes»: lienzo entero con fondo blanco.
    const o = document.createElement('canvas');
    o.width = cv.width; o.height = cv.height;
    const c = o.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, o.width, o.height);
    c.drawImage(cv, 0, 0);
    const vieja = o.toDataURL('image/png');
    const nueva = await compactarUnaFirma(vieja);
    // Y una ya compactada: no se debe tocar dos veces.
    const otraVez = nueva ? await compactarUnaFirma(nueva) : 'no hubo';
    return { vieja: vieja.length, nueva: nueva && nueva.length,
             esPng: !!nueva && /^data:image\\/png;base64,/.test(nueva),
             otraVez: otraVez };
  })()`);
  const kb = n => Math.round(n * 2 / 1024);
  console.log(`         ${kb(r.vieja)} KB → ${kb(r.nueva)} KB`);
  afirma('la compacta', !!r.nueva && r.nueva * 4 < r.vieja);
  afirma('y sigue siendo un PNG', r.esPng);
  /* Volver a darle no debe achicarla otra vez: si cada pasada la encogiera,
     darle dos veces acabaría con una firma ilegible. */
  afirma('una ya compactada se deja en paz', r.otraVez === null);
});

await bloque('5 · compactar no toca el nombre ni la fecha', async () => {
  const r = await p.evaluate(`(async () => {
    const cv = ${LIENZO};
    const o = document.createElement('canvas');
    o.width = cv.width; o.height = cv.height;
    const c = o.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, o.width, o.height);
    c.drawImage(cv, 0, 0);
    const img = o.toDataURL('image/png');

    state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO',
                                     ejecutivo:'Sistemas' })];
    state.convenios = [saneaConv({ id:'cv1', clienteId:'c1', folio:'CONV-EJEMPLO',
      estado:'firmado',
      firmaHotel:{ nombre:'Quien firma de ejemplo', puesto:'Ventas',
                   celular:'000', fecha:'2026-10-07', img },
      firmaEmpresa:{ nombre:'Cliente de ejemplo', puesto:'Compras',
                     celular:'111', fecha:'2026-10-07', img } })];
    guardar();

    const halladas = firmasDelEstado();
    const antes = halladas.reduce((a, f) => a + f.img.length, 0);
    for (const f of halladas){
      const n = await compactarUnaFirma(f.img);
      if (n) f.img = n;
    }
    guardar();
    const cv1 = state.convenios[0];
    return { cuantas: halladas.length, antes,
             despues: firmasDelEstado().reduce((a, f) => a + f.img.length, 0),
             hotel: [cv1.firmaHotel.nombre, cv1.firmaHotel.puesto,
                     cv1.firmaHotel.fecha].join('|'),
             empresa: cv1.firmaEmpresa.nombre,
             sigueSiendoPng: /^data:image\\/png;base64,/.test(cv1.firmaHotel.img) };
  })()`);
  afirma('encuentra las dos firmas del convenio', r.cuantas === 2);
  afirma('y las dos adelgazan', r.despues * 4 < r.antes);
  /* Lo que NO se puede perder: quién firmó y cuándo. Es lo que hace que el
     documento valga algo. */
  afirma('el nombre, el puesto y la fecha quedan intactos',
    r.hotel === 'Quien firma de ejemplo|Ventas|2026-10-07');
  afirma('los de la empresa también', r.empresa === 'Cliente de ejemplo');
  afirma('y la imagen sigue siendo una imagen', r.sigueSiendoPng);
});

await bloque('6 · se puede ver qué está llenando el navegador', async () => {
  const r = await p.evaluate(() => {
    const d = queLlenaElAlmacen();
    return { total: d.total, nFirmas: d.nFirmas, firmas: d.firmas,
             partes: d.partes.map(x => x.que),
             ordenado: d.partes.every((x, i) => !i || d.partes[i-1].peso >= x.peso),
             kb: enKB(1024 * 300), mb: enKB(1024 * 1024 * 2) };
  });
  afirma('dice cuánto pesa la copia de este equipo', r.total > 0);
  afirma('y cuántas firmas hay dentro', r.nFirmas === 2 && r.firmas > 0);
  afirma('nombra lo que pesa, de lo más a lo menos',
    r.partes.length > 0 && r.ordenado);
  afirma('en kilobytes y megabytes, no en números pelones',
    r.kb === '300 KB' && r.mb === '2.0 MB');
});

await bloque('7 · cuando el navegador se llena, se entera y no se repite', async () => {
  const r = await p.evaluate(async () => {
    const avisos = [];
    const orig = window.alert;
    window.alert = m => avisos.push(String(m));
    /* Se simula el navegador lleno: `setItem` truena como truena de verdad,
       con una QuotaExceededError. Llenarlo a mano con megabytes de basura
       tarda y deja el equipo de pruebas sucio para los bloques de abajo. */
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k){
      if (k === STORE){ const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; }
      return real.apply(this, arguments);
    };
    try{
      guardar();
      guardar();
      guardar();                       // tres veces: un solo aviso
    } finally {
      Storage.prototype.setItem = real;
      window.alert = orig;
    }
    const letrero = document.getElementById('avisoAlmacen');
    const r = { avisos, texto: avisos[0] || '',
                hayLetrero: !!letrero,
                letrero: letrero ? letrero.textContent : '',
                hayRespaldo: !!document.getElementById('avisoAlmacenResp') };
    // Y que al volver a guardar bien, deje de insistir la próxima vez.
    guardar();
    r.sePuedeVolverAAvisar = !avisadoAlmacenLleno;
    if (letrero) letrero.remove();
    return r;
  });

  /* Antes salía la MISMA ventana en cada tecla: con el almacenamiento lleno,
     `guardar()` corre en cada cambio y la aplicación se volvía inusable. */
  afirma('avisa una sola vez, no en cada tecla', r.avisos.length === 1);
  /* Y el aviso tiene que servir de algo: decir cuánto pesa y qué hacer. */
  afirma('dice cuánto pesa la copia de este equipo', /pesa \d/.test(r.texto));
  afirma('y manda a bajar el respaldo', /Respaldo completo \(JSON\)/.test(r.texto));
  afirma('advierte que lo que se escriba ya no se guarda aquí',
    /NO se está guardando/.test(r.texto));
  /* La ventana se cierra y se olvida. El letrero no: mientras no se pueda
     guardar, quien esté capturando tiene que poder verlo. */
  afirma('deja un letrero fijo', r.hayLetrero && /ya no puede guardar/i.test(r.letrero));
  afirma('con el botón del respaldo a la mano', r.hayRespaldo);
  /* Y si el problema se resuelve, el aviso vuelve a estar disponible: no se
     queda callado para siempre después del primero. */
  afirma('tras un guardado bueno, puede volver a avisar', r.sePuedeVolverAAvisar);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
