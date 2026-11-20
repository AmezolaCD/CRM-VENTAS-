/* ===========================================================================
   EL ENLACE TIENE QUE LLEGAR COMO ENLACE

   Al mandar un convenio por correo, el enlace de firma llegaba al borrador de
   Outlook como TEXTO MUERTO. Para que se volviera liga había que poner el
   cursor al final del enlace y dar Enter; si no, el cliente tenía que copiarlo
   y pegarlo a mano en su navegador. En un documento que se manda a firmar, eso
   es fricción en el peor sitio.

   La causa era el salto de línea: Outlook mete un `\n` suelto como SALTO DE
   LÍNEA, no como fin de párrafo, y su autoformato sólo convierte una URL en
   liga cuando un párrafo se cierra. Con CRLF cada renglón es un párrafo.

   Y como del autoformato de Outlook no se puede uno fiar, hay además una
   salida que no depende de él: copiar el mensaje con la liga YA puesta.

   Lo que se afirma aquí:

   1. El cuerpo del `mailto:` de un convenio lleva CRLF, sin un solo `\n`
      suelto.
   2. El enlace de firma va en su propio renglón, sin nada pegado.
   3. «Copiar el mensaje» deja una versión HTML con un `<a href>` de verdad
      apuntando al enlace de ese convenio.
   4. Y una versión en texto plano, legible, para quien pegue en un campo sin
      formato.
   5. Copiar el mensaje CON liga marca el documento como enviado; el del PDF
      no, porque ahí no va nada.
   6. Si el navegador no admite copiar con formato, se copia igual el texto.
   7. No es sólo el convenio: el contrato sale por el mismo camino.

   Cómo correrla:  node pruebas/navegador/la-liga-en-el-correo.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8899;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  // El buzón montado: si no, no se ofrece el enlace y no hay botón que picar.
  if (u.pathname === '/rest/v1/rpc/crm_buzon_ok'){
    res.writeHead(200, cors); return res.end('true');
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
p.on('dialog', d => d.dismiss().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof enviarConvenio === 'function', null, { timeout:15000 });
await p.evaluate(u => {
  nube.url = u; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio', user:{ email:'ana@ejemplo.example' } };
}, `http://127.0.0.1:${PUERTO}`);

const CLIENTE = { empresa:'EMPRESA DE EJEMPLO SA DE CV', contacto:'Juan Pérez',
                  telefono:'664 000 0000', email:'contacto@ejemplo.example' };

/**
 * Abre «Enviar al cliente» de un convenio o de una cotización, pica el botón
 * que se le diga, y devuelve lo que el CRM mandó o copió.
 *
 * `abrirMailto` y `navigator.clipboard.write` se sustituyen aquí: es
 * exactamente lo que se quiere mirar, y sustituirlos evita tener que
 * secuestrar `location` o pelearse con permisos del portapapeles.
 */
const picar = (que, boton, op = {}) => p.evaluate(async ([que, boton, c, sinFormato]) => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  state.actividades = [];
  window.__mailto = null; window.__copiado = null; window.__texto = null;
  abrirMailto = url => { window.__mailto = url; };
  navigator.clipboard.writeText = t => { window.__texto = t; return Promise.resolve(); };
  /* Se guarda el de verdad la primera vez: el bloque que simula un navegador
     viejo lo borra, y sin esto el borrado se quedaría puesto para los bloques
     siguientes —que fue justo lo que pasó la primera vez que se corrió—. */
  window.__CI = window.__CI || window.ClipboardItem;
  if (sinFormato){
    delete window.ClipboardItem;                 // navegador que no sabe copiar con formato
  } else {
    window.ClipboardItem = window.__CI;
    navigator.clipboard.write = async items => {
      const it = items[0];
      window.__copiado = {
        html:  it.types.includes('text/html')  ? await (await it.getType('text/html')).text()  : '',
        plain: it.types.includes('text/plain') ? await (await it.getType('text/plain')).text() : ''
      };
    };
  }

  let doc;
  if (que === 'convenio'){
    doc = saneaConv({ id:'v1', folio:'CV-2026-040', tokenFirma:'laclave', clienteId:'c1',
      fecha:'2026-10-01', vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
      habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                      grupo:'deluxe', publica:5300, convenio:2800 }],
      firmaHotel:{ nombre:'Ejecutivo de ejemplo' } });
    state.convenios = [doc];
    enviarConvenio(doc, c);
  } else {
    doc = saneaContrato({ id:'k1', folio:'CT-2026-007', tokenFirma:'laclave',
      clienteId:'c1', tipo:'cotizacion', estado:'firmado_hotel',
      firmaHotel:{ nombre:'Ejecutivo de ejemplo' } });
    state.contratos = [doc];
    enviarContrato(doc, c);
  }

  for (let i = 0; i < 150; i++){
    const b = document.querySelector(boton);
    if (b && !b.disabled){
      b.click();
      await new Promise(r => setTimeout(r, 400));
      return { mailto: window.__mailto, copiado: window.__copiado, texto: window.__texto,
               enviado: doc.enviado || null,
               liga: ligaFirma(doc, que === 'convenio' ? 'convenios' : 'contratos') };
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return { mailto:null, copiado:null, texto:null, enviado:null, liga:'(nunca salió el botón)' };
}, [que, boton, CLIENTE, !!op.sinFormato]);

/** El cuerpo del mailto, ya descodificado. */
const cuerpoDe = url => {
  const m = /[?&]body=([^&]*)/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : '';
};

await bloque('1 · el cuerpo del correo lleva fin de párrafo, no salto suelto', async () => {
  const r = await picar('convenio', '[data-mail="liga"]');
  const cuerpo = cuerpoDe(r.mailto);
  afirma('se abrió el correo',            !!r.mailto);
  afirma('con el cliente en el destinatario',
    (r.mailto || '').startsWith('mailto:contacto%40ejemplo.example'));
  afirma('el cuerpo lleva CRLF',          /\r\n/.test(cuerpo));
  afirma('y no queda un solo \\n suelto', !/(^|[^\r])\n/.test(cuerpo));
});

await bloque('2 · el enlace va en su propio renglón', async () => {
  const r = await picar('convenio', '[data-mail="liga"]');
  const cuerpo = cuerpoDe(r.mailto);
  const renglones = cuerpo.split('\r\n');
  afirma('el enlace está en el cuerpo',   cuerpo.includes(r.liga));
  afirma('ocupa un renglón él solo',      renglones.includes(r.liga));
});

await bloque('3 · «Copiar el mensaje» copia el enlace COMO enlace', async () => {
  const r = await picar('convenio', '[data-copia="liga"]');
  const html = (r.copiado && r.copiado.html) || '';
  afirma('se copió algo con formato',     !!html);
  afirma('con un <a href> de verdad',     /<a href="/.test(html));
  afirma('apuntando a este convenio',
    html.includes(`<a href="${r.liga.replace(/&/g, '&amp;')}"`) || html.includes(`<a href="${r.liga}"`));
  afirma('y los renglones se respetan',   /<br>/.test(html));
});

await bloque('4 · y también en texto plano, para quien pegue sin formato', async () => {
  const r = await picar('convenio', '[data-copia="liga"]');
  const plano = (r.copiado && r.copiado.plain) || '';
  afirma('va la versión de texto',        !!plano);
  afirma('con el enlace entero',          plano.includes(r.liga));
  afirma('sin etiquetas de HTML',         !/<a |<br>|<div>/.test(plano));
});

await bloque('5 · copiar el mensaje con enlace es mandarlo; el del PDF no', async () => {
  const conLiga = await picar('convenio', '[data-copia="liga"]');
  afirma('con enlace, queda marcado como enviado',
    !!(conLiga.enviado && conLiga.enviado.via === 'enlace'));
  const soloPdf = await picar('convenio', '[data-copia="pdf"]');
  afirma('el del PDF no marca nada',      soloPdf.enviado === null);
  afirma('pero sí copia el mensaje',      !!(soloPdf.copiado && soloPdf.copiado.plain));
  afirma('y ése va sin enlace dentro',
    !((soloPdf.copiado || {}).html || '').includes('<a href='));
});

await bloque('6 · si el navegador no sabe copiar con formato, copia el texto', async () => {
  const r = await picar('convenio', '[data-copia="liga"]', { sinFormato:true });
  afirma('no se quedó sin copiar nada',   !!r.texto);
  afirma('y el enlace va completo',       (r.texto || '').includes(r.liga));
});

await bloque('7 · no es sólo el convenio: el contrato sale igual', async () => {
  const r = await picar('cotización', '#kMailLiga');
  const cuerpo = cuerpoDe(r.mailto);
  afirma('se abrió el correo',            !!r.mailto);
  afirma('el cuerpo lleva CRLF',          /\r\n/.test(cuerpo));
  afirma('y no queda un \\n suelto',      !/(^|[^\r])\n/.test(cuerpo));
  const c = await picar('cotización', '#kCopiarMsg');
  afirma('y también se puede copiar con el enlace puesto',
    /<a href="/.test((c.copiado || {}).html || ''));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
