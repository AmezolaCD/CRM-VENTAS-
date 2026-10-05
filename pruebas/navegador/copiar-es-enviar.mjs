/* ===========================================================================
   COPIAR EL ENLACE ES MANDARLO

   La columna ENVIADO decía «Sin enviar» aunque el ejecutivo ya hubiera copiado
   el enlace de firma y se lo hubiera mandado al cliente por su cuenta —un
   WhatsApp desde su teléfono, un correo de la empresa—. Sólo se apuntaba
   cuando se usaba uno de los dos botones de aquí dentro, y así la columna
   mentía justo en el caso más común.

   Copiar el enlace ES mandarlo: a partir de ese momento anda fuera del hotel.

   Cómo correrla:  node pruebas/navegador/copiar-es-enviar.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8800;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  // El buzón de firmas montado: si no, no se ofrece el enlace y no hay botón.
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
 * Abre «Enviar al cliente», pica «Copiar el enlace» y dice cómo quedó.
 *
 * Se mira el documento REAL, el que vive en state: que la pastilla cambie sin
 * que el documento cambie no serviría de nada, porque lo que viaja a los demás
 * equipos es el documento.
 */
async function copiarYMirar(que){
  return p.evaluate(async ([que, c]) => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    state.actividades = [];
    let doc, boton;
    if (que === 'convenio'){
      doc = saneaConv({ id:'v1', folio:'CV-2026-040', tokenFirma:'laclave', clienteId:'c1',
        fecha:'2026-10-01', vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
        habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                        grupo:'deluxe', publica:5300, convenio:2800 }],
        firmaHotel:{ nombre:'Ejecutivo de ejemplo' } });
      state.convenios = [doc];
      enviarConvenio(doc, c);
      boton = '#cCopiar';
    } else {
      doc = saneaContrato({ id:'k1', folio:'CT-2026-007', tokenFirma:'laclave',
        clienteId:'c1', tipo:'contrato', estado:'firmado_hotel',
        firmaHotel:{ nombre:'Ejecutivo de ejemplo' } });
      state.contratos = [doc];
      enviarContrato(doc, c);
      boton = '#kCopiar';
    }
    const antes = JSON.parse(JSON.stringify(doc.enviado || null));
    for (let i = 0; i < 150; i++){
      const b = document.querySelector(boton);
      if (b){
        navigator.clipboard.writeText = () => Promise.resolve();
        b.click();
        await new Promise(r => setTimeout(r, 300));
        return { antes, enviado: doc.enviado, sello: selloEnvio(doc),
                 bitacora: state.actividades.map(a => a.asunto + ' — ' + a.notas) };
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return { antes, enviado:null, sello:'(nunca salió el botón)', bitacora:[] };
  }, [que, CLIENTE]);
}

for (const que of ['convenio', 'contrato']){
  await bloque(`· ${que}: copiar el enlace lo marca como enviado`, async () => {
    const r = await copiarYMirar(que);
    afirma('antes de copiar estaba sin enviar', r.antes === null);
    afirma('al copiar queda marcado', !!r.enviado);
    afirma('y la vía dice que fue por el enlace',
      !!r.enviado && r.enviado.via === 'enlace');
    afirma('queda con quién y cuándo',
      !!r.enviado && !!r.enviado.fecha && r.enviado.quien === 'ana@ejemplo.example');
    afirma('la columna ENVIADO ya no dice «Sin enviar»',
      !/Sin enviar/.test(r.sello));
    afirma('y dice por dónde fue', /enlace/.test(r.sello));
    afirma('queda escrito en la bitácora del cliente',
      r.bitacora.length === 1 && /enviad[oa] por enlace/i.test(r.bitacora[0]));
    /* El texto de la bitácora salía de un «¿fue correo? entonces el correo, si
       no el teléfono», así que un enlace copiado habría quedado apuntado como
       mandado al teléfono del cliente, que no es verdad. */
    afirma('sin inventar que se mandó al teléfono',
      !r.bitacora[0] || !/664 000 0000/.test(r.bitacora[0]));
  });
}

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
