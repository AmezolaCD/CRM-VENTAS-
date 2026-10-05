/* ===========================================================================
   EL .SQL TIENE QUE LLEGAR ENTERO, SEA DEL LARGO QUE SEA

   A Marco el pegado se le ha cortado TRES veces —el .sql de las ODTs,
   firmas.sql y folios.sql—, siempre a los 100 renglones, y el editor de
   Supabase le contestó «Success» sin avisar de nada. La tercera fue peor: al
   detectar una tabla nueva, el editor pega al final de lo que recibió un
   «ALTER TABLE … ENABLE ROW LEVEL SECURITY», y como lo que recibió estaba
   cortado, ese renglón cayó DENTRO del cuerpo de una función, partió el $$ y
   reventó con «unterminated dollar-quoted string».

   Por eso el CRM ya no le dice a nadie «copia el archivo»: se lo trae él del
   servidor y se lo deja en el portapapeles. Esta prueba exige que lo que se
   copia sea el archivo ENTERO, para los dos archivos que tienen botón.

   Cómo correrla:  node pruebas/navegador/copiar-el-sql.mjs
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const RAIZ   = '/home/user/CRM-VENTAS-';
const PUERTO = 8803;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Qué contesta el servidor: 'falta' → no está montado; 'ok' → sí. */
let estado = 'falta';

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (/^\/(firmas|folios)\.sql$/.test(u.pathname)){
    res.writeHead(200, { 'Content-Type':'text/plain; charset=utf-8' });
    return res.end(fs.readFileSync(RAIZ + u.pathname, 'utf8'));
  }
  // El buzón de firmas
  if (u.pathname === '/rest/v1/rpc/crm_buzon_ok'){
    if (estado === 'falta'){ res.writeHead(404, cors); return res.end('{}'); }
    res.writeHead(200, cors); return res.end('true');
  }
  // El contador de folios
  if (u.pathname === '/rest/v1/crm_folios'){
    if (estado === 'falta'){
      res.writeHead(404, cors);
      return res.end('{"code":"PGRST205","message":"Could not find the table"}');
    }
    res.writeHead(200, cors); return res.end('[]');
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
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
try{
  await p.waitForFunction(() => typeof panelCorrerSql === 'function', null, { timeout:15000 });
}catch(e){
  console.log('\nFALLA · esta versión del index.html no tiene panelCorrerSql():');
  console.log('        no puede traerle el .sql a nadie sin pasar por una vista previa.\n');
  await br.close(); srv.close(); process.exit(1);
}
await p.evaluate(u => {
  nube.url = u; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio', user:{ email:'ana@ejemplo.example' } };
}, `http://127.0.0.1:${PUERTO}`);

/** Abre el panel de ese archivo y pica «Copiar el SQL». */
const copiar = cual => p.evaluate(async cual => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  let copiado = null;
  navigator.clipboard.writeText = t => { copiado = t; return Promise.resolve(); };
  panelCorrerSql(cual);
  await new Promise(r => setTimeout(r, 200));
  document.querySelector('#afCopiar').click();
  for (let i = 0; i < 80 && copiado === null; i++) await new Promise(r => setTimeout(r, 100));
  return { copiado, dicho: (document.querySelector('#afDicho') || {}).innerText || '',
           titulo: document.querySelector('.modal-head h2').innerText };
}, cual);

const esperado = {
  firmas: { titulo:/firma en pantalla/i, trae:['cliente deja su firma', 'crm_buzon_ok'] },
  folios: { titulo:/contador de folios/i, trae:['crm_aparta_folio', 'crm_folios'] }
};

for (const cual of ['firmas', 'folios']){
  await bloque(`· ${cual}.sql se copia ENTERO`, async () => {
    const r = await copiar(cual);
    const sql = String(r.copiado || '');
    const renglones = sql.trim().split('\n').length;
    console.log(`     ${renglones} renglones (el archivo tiene ` +
      `${fs.readFileSync(RAIZ + '/' + cual + '.sql', 'utf8').trim().split('\n').length})`);
    afirma('el panel es el de ese archivo', esperado[cual].titulo.test(r.titulo));
    afirma('empieza la transacción', /^begin;/.test(sql));
    afirma('la cierra', /\ncommit;/.test(sql));
    afirma('y termina con la prueba de que llegó completo',
      sql.trim().endsWith('as resultado;'));
    for (const t of esperado[cual].trae)
      afirma(`trae ${t}`, sql.includes(t));
    afirma('no se coló un renglón de comentario',
      !sql.split('\n').some(l => l.trim().startsWith('--')));
    /* Lo que más importa: que sea el archivo, no un pedazo. Se compara contra
       el del repositorio pasado por la misma compactación. */
    const real = fs.readFileSync(RAIZ + '/' + cual + '.sql', 'utf8');
    const mismo = await p.evaluate(([t, se]) => sqlSinComentarios(t, se),
                                   [real, esperado[cual].trae[0]]);
    afirma('es el archivo completo, no un pedazo', sql === mismo);
    afirma('se le dice cuántos renglones y cuál es el último',
      /renglones/.test(r.dicho) && r.dicho.includes('as resultado;'));
  });

  await bloque(`· ${cual}.sql: «Ya lo corrí» contesta la verdad`, async () => {
    estado = 'falta';
    const malo = await p.evaluate(async () => {
      document.querySelector('#afVerificar').click();
      for (let i = 0; i < 80; i++){
        const t = document.querySelector('#afDicho').innerText;
        if (/Todav[ií]a no|ya funciona/i.test(t)) return t;
        await new Promise(r => setTimeout(r, 100));
      }
      return '(no contestó)';
    });
    afirma('si no está montado, lo dice', /Todav[ií]a no/i.test(malo));
    estado = 'ok';
    const bueno = await p.evaluate(async () => {
      document.querySelector('#afVerificar').click();
      for (let i = 0; i < 80; i++){
        const t = document.querySelector('#afDicho').innerText;
        if (/ya funciona/i.test(t)) return t;
        await new Promise(r => setTimeout(r, 100));
      }
      return '(no contestó)';
    });
    afirma('y en cuanto se monta, lo dice ahí mismo', /ya funciona/i.test(bueno));
  });
}

await bloque('· y se puede bajar el archivo, por si el portapapeles también recorta', async () => {
  const r = await p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    let nombre = null, texto = null;
    const antes = window.descargarBlob;
    window.descargarBlob = async (blob, n) => { nombre = n; texto = await blob.text(); };
    panelCorrerSql('folios');
    await new Promise(r => setTimeout(r, 200));
    document.querySelector('#afBajar').click();
    for (let i = 0; i < 80 && texto === null; i++) await new Promise(r => setTimeout(r, 100));
    window.descargarBlob = antes;
    return { nombre, texto };
  });
  afirma('se baja con su nombre', r.nombre === 'folios.sql');
  afirma('y es el archivo entero, con comentarios y todo',
    r.texto === fs.readFileSync(RAIZ + '/folios.sql', 'utf8'));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
