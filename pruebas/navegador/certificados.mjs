/* ===========================================================================
   CERTIFICADOS DE CORTESÍA

   Antes se hacían en un PowerPoint de 279 diapositivas: se duplicaba la última
   y se le cambiaban a mano el nombre, las fechas y el número. En ese archivo se
   ven las consecuencias —folios repetidos, folios saltados, «31 DE DICIEMBRE
   224»—, y por eso Marco puso dos condiciones que son las que se prueban aquí:

     «es importante los folios en este certificado, no se pueden repetir»
     «los certificados solo los puede generar Carmen, Alicia y el
      administrador, nadie más»

   Cómo correrla:  node pruebas/navegador/certificados.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const RAIZ   = path.dirname(APP);
const PUERTO = 8804;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* El contador del hotel. `vivo` en false es un servidor sin folios.sql. */
let vivo = true, siguiente = 7;
const repartidos = [];
/* Las fotos de los certificados se sirven DE VERDAD, desde el repositorio.
   Antes la hoja se probaba con `cuerpoCertificado(c, null)` —o sea, la imagen
   no se probaba nunca—, y Marco acabó reportando que «no se inserta».
   `fotos` en false es un servidor que no las entrega, para probar el aviso. */
let fotos = true;

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname.startsWith('/certificados/')){
    /* El mismo Cache-Control que pone vercel.json, y TAMBIÉN en el 404: es lo
       que hace que el navegador lo guarde, que es de lo que trata el bloque 13. */
    const cache = { 'Cache-Control':'public, max-age=0, must-revalidate' };
    const f = path.join(RAIZ, u.pathname);
    if (!fotos || !f.startsWith(path.join(RAIZ, 'certificados')) || !fs.existsSync(f)){
      res.writeHead(404, Object.assign({ 'Content-Type':'text/plain' }, cache));
      return res.end('no');
    }
    res.writeHead(200, Object.assign({ 'Content-Type':'image/jpeg' }, cache));
    return res.end(fs.readFileSync(f));
  }
  if (u.pathname === '/rest/v1/rpc/crm_aparta_folio'){
    if (!vivo){
      res.writeHead(404, cors);
      return res.end('{"code":"PGRST202","message":"Could not find the function"}');
    }
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
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
try{
  await p.waitForFunction(() => typeof renderCertificados === 'function', null, { timeout:15000 });
}catch(e){
  console.log('\nFALLA · esta versión del index.html no tiene certificados.\n');
  await br.close(); srv.close(); process.exit(1);
}
await p.evaluate(u => {
  nube.url = u; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio', user:{ email:'carmen@ejemplo.example' } };
  try{ terminarEntrada(); }catch(e){}
  document.documentElement.classList.remove('intro-activa');
}, `http://127.0.0.1:${PUERTO}`);

/** Deja el equipo con una persona concreta adentro. */
const entrarComo = (correo, rol, conCert) => p.evaluate(([correo, rol, conCert]) => {
  state.usuarios = [
    saneaUsuario({ id:'u1', nombre:'Carmen', correo:'carmen@ejemplo.example',
                   rol:'ejecutivo', certificados:true }),
    saneaUsuario({ id:'u2', nombre:'Eduardo', correo:'eduardo@ejemplo.example',
                   rol:'ejecutivo' }),
    saneaUsuario({ id:'u3', nombre:'Sistemas', correo:'admin@ejemplo.example', rol:'admin' })];
  if (!state.usuarios.some(u => u.correo === correo))
    state.usuarios.push(saneaUsuario({ id:'u9', nombre:'Otra', correo, rol,
                                       certificados: !!conCert }));
  nube.sesion = { access_token:'ficticio', user:{ email:correo } };
  state.certificados = [];
  render();
}, [correo, rol, conCert]);

/** Captura un certificado y le pica a «Emitir con folio». */
const emitir = (quien, hasta) => p.evaluate(async ([quien, hasta]) => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  editarCertificado(null);
  await new Promise(r => setTimeout(r, 150));
  document.querySelector('#ceTipo').value = 'spa_masaje';
  document.querySelector('#ceQuien').value = quien;
  document.querySelector('#ceDesde').value = '2026-10-01';
  document.querySelector('#ceHasta').value = hasta;
  document.querySelector('#ceEmitir').click();
  for (let i = 0; i < 80; i++){
    await new Promise(r => setTimeout(r, 100));
    const c = state.certificados.find(x => x.paraQuien === quien);
    if (c && c.estado === 'emitido') return { folio:c.folio, estado:c.estado };
    if (!document.querySelector('#ceEmitir')) break;   // se cerró sin emitir
  }
  const c = state.certificados.find(x => x.paraQuien === quien);
  return { folio: c ? c.folio : null, estado: c ? c.estado : null };
}, [quien, hasta]);

await bloque('1 · el folio lo reparte el contador y no se repite', async () => {
  await entrarComo('carmen@ejemplo.example', 'ejecutivo', true);
  vivo = true; siguiente = 7;
  const a = await emitir('CLIENTE UNO', '2026-12-31');
  const b = await emitir('CLIENTE DOS', '2026-12-31');
  afirma('el primero se lleva el del contador', a.folio === 'CE-2026-007');
  afirma('el segundo se lleva el siguiente',    b.folio === 'CE-2026-008');
  afirma('no son el mismo', a.folio !== b.folio);
  afirma('se le pidió por la serie de certificados',
    repartidos.filter(x => x.tipo === 'certificados').length === 2);
  afirma('quedan emitidos', a.estado === 'emitido' && b.estado === 'emitido');
});

await bloque('2 · sin contador NO se emite —ni a medias—', async () => {
  vivo = false;
  const r = await emitir('CLIENTE TRES', '2026-12-31');
  afirma('no se le puso folio', !r.folio);
  afirma('y NO quedó emitido', r.estado !== 'emitido');
  /* Lo que importa de verdad: que no se haya gastado un número. Al volver el
     contador, el siguiente que emita se lleva el que tocaba. */
  vivo = true;
  const s = await emitir('CLIENTE CUATRO', '2026-12-31');
  afirma('al volver el contador, sigue la cuenta sin saltos', s.folio === 'CE-2026-009');
});

await bloque('3 · no se emite sin nombre ni sin vencimiento', async () => {
  const r = await p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    editarCertificado(null);
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('#ceEmitir').click();
    await new Promise(r => setTimeout(r, 400));
    const sinNombre = document.querySelector('#ceErr').innerText;
    document.querySelector('#ceQuien').value = 'ALGUIEN';
    document.querySelector('#ceEmitir').click();
    await new Promise(r => setTimeout(r, 400));
    return { sinNombre, sinFecha: document.querySelector('#ceErr').innerText };
  });
  afirma('reclama el cliente al que va dirigido', /cliente/i.test(r.sinNombre));
  afirma('y reclama hasta cuándo vale', /hasta cu[aá]ndo/i.test(r.sinFecha));
});

await bloque('4 · sólo lo ve quien lo puede emitir', async () => {
  const ve = () => p.evaluate(() => ({
    pestaña: puedeVer('certificados'),
    boton: document.querySelector('nav button[data-view="certificados"]').style.display,
    puede: puedeCertificados()
  }));
  await entrarComo('carmen@ejemplo.example', 'ejecutivo', true);
  const carmen = await ve();
  afirma('Carmen, con la palomita, sí', carmen.pestaña && carmen.puede && carmen.boton !== 'none');

  await entrarComo('eduardo@ejemplo.example', 'ejecutivo', false);
  const eduardo = await ve();
  afirma('Eduardo, sin la palomita, NO la alcanza', !eduardo.pestaña && !eduardo.puede);
  afirma('y ni el botón de la pestaña se le enseña', eduardo.boton === 'none');

  await entrarComo('admin@ejemplo.example', 'admin', false);
  const admin = await ve();
  afirma('la administración siempre puede, con palomita o sin ella', admin.puede);
});

await bloque('5 · la palomita no nace en todas las fichas', async () => {
  /* Un campo nuevo en cada usuario los haría verse editados y se volverían a
     subir enteros en la primera sincronización. Ya pasó con otro campo. */
  const r = await p.evaluate(() => ({
    sin: JSON.stringify(saneaUsuario({ id:'uz', correo:'z@ejemplo.example' })),
    con: JSON.stringify(saneaUsuario({ id:'uy', correo:'y@ejemplo.example', certificados:true }))
  }));
  afirma('quien no la tiene no gana el campo', !/certificados/.test(r.sin));
  afirma('quien sí la tiene, lo conserva', /"certificados":true/.test(r.con));
});

await bloque('6 · la hoja dice lo que tiene que decir', async () => {
  await entrarComo('carmen@ejemplo.example', 'ejecutivo', true);
  vivo = true;
  const r = await p.evaluate(async () => {
    state.ajustes.hotel.director = 'Nombre De Ejemplo';
    state.ajustes.hotel.puestoDirector = 'Dirección General';
    state.ajustes.hotel.emailSpa = 'spa@ejemplo.example';
    state.ajustes.hotel.telSpa = '664 000 0000';
    const c = saneaCertificado({ id:'ce1', folio:'CE-2026-012', tipo:'spa_masaje',
      paraQuien:'DÍA DE LAS MADRES', desde:'2026-05-10', hasta:'2026-06-30',
      estado:'emitido' });
    state.certificados = [c];
    const caja = document.createElement('div');
    caja.innerHTML = cuerpoCertificado(c, null);
    return { html: caja.innerHTML, texto: caja.innerText, vig: vigenciaCert(c) };
  });
  afirma('la vigencia se redacta sola',
    r.vig === '10 de mayo al 30 de junio del 2026');
  afirma('sale en la hoja', r.texto.includes('10 de mayo al 30 de junio del 2026'));
  /* El título va en dos renglones con una raya en medio, como el machote. */
  afirma('el título por omisión del tipo, en sus dos renglones',
    r.texto.includes('MASAJE RELAJANTE') && r.texto.includes('DE CORTESÍA'));
  afirma('con su rayita en medio', /cert-raya/.test(r.html));
  afirma('y el nombre del lugar en la esquina', r.texto.includes('SENSES'));
  afirma('el folio sale rotulado', /No\. Folio/.test(r.texto));
  afirma('a nombre de quién va', r.texto.includes('DÍA DE LAS MADRES'));
  afirma('las condiciones de su tipo', /45 min/.test(r.texto));
  afirma('el contacto del SPA, no el de reservaciones',
    r.texto.includes('spa@ejemplo.example'));
  afirma('quién firma', r.texto.includes('Nombre De Ejemplo'));
  afirma('y el folio', r.texto.includes('CE-2026-012'));
});

await bloque('7 · un año a caballo se redacta completo', async () => {
  const r = await p.evaluate(() => vigenciaCert(saneaCertificado({
    desde:'2026-11-15', hasta:'2027-02-28' })));
  afirma('dice los dos años', /2026/.test(r) && /2027/.test(r));
});

await bloque('8 · escoger el tipo LLENA los dos textos, y se pueden corregir', async () => {
  const r = await p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    editarCertificado(null);
    await new Promise(r => setTimeout(r, 150));
    const t = () => document.querySelector('#ceTitulo');
    const k = () => document.querySelector('#ceCond');
    const cambiar = async v => {
      const sel = document.querySelector('#ceTipo');
      sel.value = v; sel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 60));
    };
    const alAbrir = { titulo:t().value, cond:k().value };

    await cambiar('spa_facial');
    const facial = { titulo:t().value, cond:k().value };

    // Una redacción a mano NO se pierde al cambiar de tipo por equivocación.
    t().value = 'DOS FACIALES PARA LA PAREJA';
    k().value = 'Condiciones especiales de este certificado.';
    await cambiar('hospedaje');
    const propio = { titulo:t().value, cond:k().value };

    // Pero lo que no se tocó sí sigue al tipo.
    t().value = ''; k().value = '';
    await cambiar('temazcal');
    return { alAbrir, facial, propio, hereda:{ titulo:t().value, cond:k().value } };
  });
  afirma('al abrir ya viene lleno, no vacío', !!r.alAbrir.titulo && !!r.alAbrir.cond);
  afirma('al escoger facial, el título es el del facial', /FACIAL/.test(r.facial.titulo));
  afirma('y las condiciones son las del facial', /facial de 45 min/.test(r.facial.cond));
  afirma('lo escrito a mano NO se pierde al cambiar de tipo',
    r.propio.titulo === 'DOS FACIALES PARA LA PAREJA' &&
    r.propio.cond === 'Condiciones especiales de este certificado.');
  afirma('y un campo vacío sí se llena con el del tipo nuevo',
    /TEMAZCAL/.test(r.hereda.titulo) && !!r.hereda.cond);
});

/* ---------------------------------------------------------------------------
   9 · LA FOTO.

   «sigue sin insertar la imagen», dijo Marco. La estaba buscando en la ventana
   de captura, donde no había ninguna vista previa: la foto sólo aparecía
   después de guardar. Estos tres bloques cubren lo que faltaba — que se vea al
   capturar, que llegue hasta el PDF, y que si NO llega se diga por qué.
   --------------------------------------------------------------------------- */
await bloque('9 · al capturar se ve la hoja, con su foto', async () => {
  fotos = true;
  await entrarComo('carmen@ejemplo.example', 'ejecutivo', true);
  const r = await p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    editarCertificado(null);
    const fondoDe = async () => {
      for (let i = 0; i < 60; i++){
        await new Promise(r => setTimeout(r, 100));
        const f = document.querySelector('#cePrevia .cert-foto');
        const b = f && f.style.backgroundImage;
        if (b && /data:image/.test(b)) return b;
      }
      const f = document.querySelector('#cePrevia .cert-foto');
      return f ? f.style.backgroundImage : null;
    };
    const sel = document.querySelector('#ceTipo');
    sel.value = 'spa_facial'; sel.dispatchEvent(new Event('change'));
    const facial = await fondoDe();

    sel.value = 'temazcal'; sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 250));
    const temazcal = await fondoDe();

    const quien = document.querySelector('#ceQuien');
    quien.value = 'DÍA DE LAS MADRES';
    quien.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 400));
    const hoja = document.querySelector('#cePrevia').innerText;

    return { facial, temazcal, hoja, enCartera: state.certificados.length };
  });
  afirma('la hoja se pinta al abrir la captura', !!r.facial);
  afirma('y su foto es una imagen de verdad, no el morado',
    /^url\("data:image\//.test(r.facial || ''));
  afirma('al cambiar de tipo, cambia la foto',
    !!r.temazcal && /^url\("data:image\//.test(r.temazcal) && r.temazcal !== r.facial);
  afirma('el título sigue al tipo en la hoja', /TEMAZCAL/.test(r.hoja));
  afirma('y el cliente tecleado sale en la hoja', r.hoja.includes('DÍA DE LAS MADRES'));
  /* Lo que se está capturando NO es un certificado todavía: un borrador a
     medias no tiene nada que hacer en la cartera hasta que le piquen Guardar. */
  afirma('capturar no mete nada a la cartera', r.enCartera === 0);
});

await bloque('10 · la foto llega hasta el PDF', async () => {
  fotos = true;
  const r = await p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    const c = saneaCertificado({ id:'cf', folio:'CE-2026-030', tipo:'spa_facial',
      paraQuien:'PRUEBA', desde:'2026-05-10', hasta:'2026-06-30', estado:'emitido' });
    const caja = document.createElement('div');
    caja.innerHTML = cuerpoCertificado(c, await fondoCertificado(c.tipo));
    document.body.appendChild(caja);
    const jpeg = await rasterizarHoja(caja.firstElementChild, { sangrada:true });
    const im = new Image(); im.src = jpeg;
    await new Promise(ok => im.onload = ok);
    const cv = document.createElement('canvas');
    cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d');
    g.drawImage(im, 0, 0);
    /* La mitad de arriba es la foto. Una foto trae cientos de colores; el
       morado de respaldo es un degradado de muy pocos. */
    const d = g.getImageData(0, 0, cv.width, Math.round(cv.height * 0.45)).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) set.add(d[i] + ',' + d[i+1] + ',' + d[i+2]);
    caja.remove();
    return { colores: set.size, bytes: jpeg.length };
  });
  afirma('la zona de la foto trae una foto, no el degradado', r.colores > 500);
  afirma('y la hoja se rasterizó completa', r.bytes > 50000);
});

await bloque('11 · si la foto NO llega, se dice por qué', async () => {
  fotos = false;                      // el servidor deja de entregar las fotos
  /* A propósito un tipo que NINGÚN bloque anterior pidió: el navegador guarda
     lo que ya bajó y `force-cache` se lo daría aunque el servidor conteste
     404, así que limpiar `fondosCert` no basta para probar esto. */
  const r = await p.evaluate(async () => {
    fondosCert.clear(); motivosCert.clear(); reintentoCert.clear();
    const f = await fondoCertificado('restaurante');
    return { fondo:f, motivo: motivoFondoCert('restaurante'),
             avisa: avisoPendientesCert('restaurante', 'x') };
  }).catch(e => ({ error:e.message }));
  if (r.error) console.log('        ↳ ' + r.error);
  afirma('sin foto no revienta: la hoja sale con el fondo del hotel', r.fondo === null);
  afirma('y se anota el motivo', /404/.test(r.motivo || ''));
  afirma('que además se le enseña al ejecutivo', /404/.test(r.avisa || ''));
  fotos = true;
});

await bloque('12 · un certificado sin quién firma lo avisa', async () => {
  const r = await p.evaluate(() => {
    state.ajustes.hotel.director = '';
    const sin = avisoPendientesCert('spa_facial', 'x');
    state.ajustes.hotel.director = 'Nombre De Ejemplo';
    const con = avisoPendientesCert('spa_facial', 'x');
    const c = saneaCertificado({ id:'cz', tipo:'spa_facial', paraQuien:'X' });
    const caja = document.createElement('div');
    caja.innerHTML = cuerpoCertificado(c, null);
    return { sin, con, hoja: caja.innerText };
  });
  afirma('sin el nombre, avisa que la firma va a salir en blanco', /Falta qui[eé]n firma/.test(r.sin));
  afirma('y manda a donde se captura', /Ajustes/.test(r.sin));
  afirma('con el nombre puesto, ya no avisa', !/Falta qui[eé]n firma/.test(r.con));
  afirma('y el nombre sale impreso en la hoja', r.hoja.includes('Nombre De Ejemplo'));

  /* El aviso es un renglón largo. Si la columna de la hoja se deja a su aire,
     el aviso la ensancha y los campos se quedan en un palmo: pasó, y así se
     ve. La columna tiene que medir lo que mide la hoja, no lo que mida el
     aviso que le toque abajo. */
  const anchos = await p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    state.ajustes.hotel.director = '';
    editarCertificado(null);
    await new Promise(r => setTimeout(r, 700));
    const an = sel => Math.round(document.querySelector(sel).getBoundingClientRect().width);
    return { campos:an('.cert-campos'), previa:an('.cert-previa'),
             avisa: /Falta qui[eé]n firma/.test(document.querySelector('#ceFalta').innerText) };
  });
  afirma('el aviso está a la vista en la captura', anchos.avisa);
  afirma('y NO aplasta los campos', anchos.campos > anchos.previa);
});

/* ---------------------------------------------------------------------------
   13 · UN 404 NO SE QUEDA PEGADO.

   Esto es lo que de verdad le pasaba a Marco. La foto se pedía con
   `cache:"force-cache"` —«usa lo que tengas guardado, sin volver a
   preguntar»—, y el navegador guarda también las respuestas 404. Él abrió
   Certificados cuando la función ya existía pero las cinco fotos todavía no se
   publicaban; desde entonces el 404 se lo devolvía su propio navegador. Ni
   recargando se componía: comprobado, `force-cache` daba 404 mientras el mismo
   archivo pedido con `reload` daba 200.
   --------------------------------------------------------------------------- */
await bloque('13 · publicada la foto, entra sin tener que recargar', async () => {
  /* `restaurante` a propósito: es el ÚNICO tipo que en toda esta prueba nunca
     se ha llegado a bajar bien —el bloque 11 lo pidió con el servidor sin
     fotos—, así que el navegador trae su 404 guardado y nada más. Con
     cualquier otro, el 200 que quedó de un bloque anterior taparía justo lo
     que se quiere medir, y la prueba se pasaría sola. */
  const TIPO = 'restaurante';
  fotos = false;
  /* Lo de `typeof` no es adorno: así, contra la versión anterior, esta prueba
     falla por el COMPORTAMIENTO —el 404 pegado— y no por que le falte una
     función. Una prueba que se cae con un ReferenceError no demuestra nada. */
  const antes = await p.evaluate(async t => {
    fondosCert.clear(); motivosCert.clear();
    if (typeof reintentoCert !== 'undefined') reintentoCert.clear();
    return { fondo: await fondoCertificado(t), motivo: motivoFondoCert(t),
             liga: typeof rutaFondoCert === 'function' ? rutaFondoCert(t) : null,
             avisa: avisoPendientesCert(t, 'x') };
  }, TIPO);
  afirma('mientras no está, se avisa con el motivo', /404/.test(antes.motivo || ''));
  afirma('y con la dirección exacta que intentó',
    /\/certificados\/restaurante\.jpg$/.test(antes.liga || ''));
  afirma('que además sale en el aviso, para abrirla',
    (antes.avisa || '').includes(antes.liga));

  // Se publican las fotos. NO se recarga nada: es el caso de Marco.
  fotos = true;
  const despues = await p.evaluate(async t => {
    /* Se olvida lo recordado por la aplicación —como si se volviera a abrir la
       pestaña—, pero el almacén del NAVEGADOR sigue con el 404 adentro. */
    fondosCert.clear(); motivosCert.clear();
    if (typeof reintentoCert !== 'undefined') reintentoCert.clear();
    const f = await fondoCertificado(t);
    return { hay: !!f, esImagen: /^data:image\//.test(f || ''), motivo: motivoFondoCert(t) };
  }, TIPO);
  afirma('en cuanto está, la foto entra', despues.hay);
  afirma('y es una imagen de verdad', despues.esImagen);
  afirma('ya no queda ningún motivo que avisar', despues.motivo === '');
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
