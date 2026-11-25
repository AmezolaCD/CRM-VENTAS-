/* ===========================================================================
   UN ENLACE QUE NO SE PUEDE LEER NO ABRE EL CRM

   Un cliente del hotel abrió el enlace de firma de su convenio y le salió EL
   CRM: la pestaña Clientes, con cartera, pestañas y botones. Al enlace le
   faltaba un carácter —se mandó por correo, donde ocupa cuatro renglones—, así
   que `enlaceDeFirma()` devolvió null, el arranque entendió «esto no es una
   liga de cliente» y siguió con la aplicación del hotel. Que lo que viera
   fuera el catálogo de ejemplo y no el del hotel fue suerte, no diseño.

   Lo que se afirma aquí:

   1. Con un `#firmar=` ilegible NO se ve el CRM: se ve una pantalla que dice
      que el enlace llegó incompleto.
   2. Y no se asoma ni la cartera ni la versión del CRM.
   3. Un enlace partido en renglones —con espacios dentro— SÍ se abre: eso es
      lo que hace el correo, y se puede rescatar.
   4. Un enlace bueno sigue abriendo el documento.
   5. Con la conexión del hotel dentro de la aplicación, el enlace sale CORTO
      —sin la dirección ni la llave— y se abre igual.
   6. Lo mismo con `alta=` y `odt=` ilegibles: tampoco abren el CRM.
   7. Control: sin liga en la dirección, el CRM arranca como siempre.

   Cómo correrla:  node pruebas/navegador/el-enlace-que-llego-roto.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8908;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

const CONVENIO = {
  id:'v1', folio:'CV-2027-116', tokenFirma:'laclave', clienteId:'c1',
  fecha:'2026-10-01', vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
  estado:'firmado_ejecutiva', firmaHotel:{ nombre:'Ejecutiva de ejemplo' },
  habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                  grupo:'deluxe', publica:5300, convenio:2800 }],
  destinatario:{ empresa:'EMPRESA DE EJEMPLO SA DE CV', contacto:'Juan Pérez',
                 telefono:'664 000 0000' }
};

/* `conNubeDentro` sirve la aplicación como quedaría si el hotel metiera su
   conexión dentro: es lo que hace corto al enlace. */
let conNubeDentro = false;

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const manda = (c, b) => {
    res.writeHead(c, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*',
                       'Access-Control-Allow-Headers':'*' });
    res.end(JSON.stringify(b));
  };
  if (req.method === 'OPTIONS') return manda(200, {});
  if (u.pathname === '/app'){
    let html = fs.readFileSync(APP, 'utf8');
    if (conNubeDentro)
      html = html.replace('window.CORE_NUBE = { url:"", anon:"" };',
        `window.CORE_NUBE = { url:"http://127.0.0.1:${PUERTO}", anon:"llave-de-mentiras" };`);
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(html);
  }
  if (u.pathname === '/rest/v1/crm_datos')
    return manda(200, [{ id:'convenios:v1', tipo:'convenios', borrado:false,
      actualizado:'2026-11-01T00:00:00.000Z', datos: CONVENIO }]);
  manda(200, []);
});
await new Promise(r => srv.listen(PUERTO, '127.0.0.1', r));

const haz = o => Buffer.from(JSON.stringify(o)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const LIGA_BUENA = haz({ v:'v1', d:'convenios', t:'laclave',
  u:'http://127.0.0.1:' + PUERTO, k:'llave-de-mentiras' });
/* Le quitamos un carácter de enmedio, igual que el enlace de verdad. */
const LIGA_ROTA = LIGA_BUENA.slice(0, 12) + LIGA_BUENA.slice(13);
const LIGA_CORTA = haz({ v:'v1', d:'convenios', t:'laclave' });

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

/** Abre una dirección como la abre el cliente y cuenta lo que se ve. */
async function abrir(hash){
  const ctx = await br.newContext({ viewport:{ width:1000, height:900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  await p.goto(`http://127.0.0.1:${PUERTO}/app` + (hash || ''));
  await p.waitForTimeout(2500);
  const v = await p.evaluate(() => ({
    texto: document.body.innerText.slice(0, 900),
    hayCrm: !!document.querySelector('#v-clientes, nav .tab, #estadoNube'),
    hayPad: !!document.querySelector('#pad'),
    version: (document.getElementById('versionCore') || {}).textContent || ''
  }));
  await ctx.close();
  return v;
}

await bloque('1 · un enlace ilegible no abre el CRM', async () => {
  const v = await abrir('#firmar=' + LIGA_ROTA);
  afirma('NO se ve el CRM',                     v.hayCrm === false);
  afirma('se dice que el enlace llegó incompleto',
    /enlace lleg[óo] incompleto/i.test(v.texto));
  afirma('y que no es culpa suya',              /no es su computadora/i.test(v.texto));
  afirma('y qué hacer: que se lo manden otra vez',
    /vuelva a enviar/i.test(v.texto));
});

await bloque('2 · y no se asoma nada del hotel', async () => {
  const v = await abrir('#firmar=' + LIGA_ROTA);
  afirma('ni un cliente de la cartera',  !/Cl[íi]nica del Valle|Grupo Mar[íi]n|Textiles/i.test(v.texto));
  afirma('ni las pestañas del CRM',      !/Convenios\s+Contratos|Tablero de marketing/i.test(v.texto));
  afirma('ni la versión del CRM',        !/CORE 20\d\d\./.test(v.texto + v.version));
});

await bloque('3 · un enlace partido en renglones sí se abre', async () => {
  /* Lo que hace el correo: parte el enlace y al copiarlo se cuelan espacios. */
  const partido = LIGA_BUENA.slice(0, 60) + ' ' + LIGA_BUENA.slice(60, 140) +
                  '%20' + LIGA_BUENA.slice(140);
  const v = await abrir('#firmar=' + partido);
  afirma('se abre el documento para firmar',    v.hayPad === true);
  afirma('y no sale la pantalla de roto',       !/lleg[óo] incompleto/i.test(v.texto));
});

await bloque('4 · un enlace bueno sigue abriendo el documento', async () => {
  const v = await abrir('#firmar=' + LIGA_BUENA);
  afirma('sale el recuadro de la firma',        v.hayPad === true);
  afirma('y no se ve el CRM',                   v.hayCrm === false);
});

await bloque('5 · con la nube dentro, el enlace sale corto y se abre igual', async () => {
  conNubeDentro = true;
  const corta = await abrir('#firmar=' + LIGA_CORTA);
  afirma('el enlace corto abre el documento',   corta.hayPad === true);
  const largos = await (async () => {
    const ctx = await br.newContext();
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${PUERTO}/app`);
    await p.waitForFunction(() => typeof ligaFirma === 'function', null, { timeout:15000 });
    const r = await p.evaluate(() => {
      nube.url = 'http://127.0.0.1:8908'; nube.anon = 'llave-de-mentiras';
      return ligaFirma({ id:'v1', tokenFirma:'laclave' }, 'convenios').length;
    });
    await ctx.close();
    return r;
  })();
  conNubeDentro = false;
  const conTodo = await (async () => {
    const ctx = await br.newContext();
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${PUERTO}/app`);
    await p.waitForFunction(() => typeof ligaFirma === 'function', null, { timeout:15000 });
    const r = await p.evaluate(() => {
      nube.url = 'http://127.0.0.1:8908'; nube.anon = 'llave-de-mentiras';
      return ligaFirma({ id:'v1', tokenFirma:'laclave' }, 'convenios').length;
    });
    await ctx.close();
    return r;
  })();
  afirma(`y es más corto que el de hoy (${largos} contra ${conTodo})`, largos < conTodo);
});

await bloque('6 · lo mismo con las otras ligas públicas', async () => {
  const a = await abrir('#alta=');
  afirma('un «alta» ilegible no abre el CRM',   a.hayCrm === false);
  afirma('y lo dice',                           /lleg[óo] incompleto/i.test(a.texto));
  const o = await abrir('#odt=');
  afirma('una «odt» ilegible tampoco',          o.hayCrm === false);
});

await bloque('7 · control: sin liga, el CRM arranca como siempre', async () => {
  const v = await abrir('');
  afirma('se ve el CRM',                        v.hayCrm === true);
  afirma('y no la pantalla de enlace roto',     !/lleg[óo] incompleto/i.test(v.texto));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
