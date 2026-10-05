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

/**
 * Abre el panel y pica «Copiar» tantas veces como pasos haya.
 *
 * El .sql va en DOS pegados cuando crea tablas: el editor de Supabase, al ver
 * una tabla nueva, le agrega SQL suyo partiendo el texto en cada `;` sin
 * respetar los `$$`, y ese agregado cae dentro del cuerpo de una función.
 */
const copiar = cual => p.evaluate(async cual => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  const copias = [];
  navigator.clipboard.writeText = t => { copias.push(t); return Promise.resolve(); };
  panelCorrerSql(cual);
  await new Promise(r => setTimeout(r, 200));
  for (let v = 0; v < 2; v++){
    const antes = copias.length;
    document.querySelector('#afCopiar').click();
    for (let i = 0; i < 80 && copias.length === antes; i++)
      await new Promise(r => setTimeout(r, 100));
  }
  return { copias, dicho: (document.querySelector('#afDicho') || {}).innerText || '',
           titulo: document.querySelector('.modal-head h2').innerText,
           boton: document.querySelector('#afCopiar').textContent };
}, cual);

const esperado = {
  firmas: { titulo:/firma en pantalla/i, trae:['cliente deja su firma', 'crm_buzon_ok'] },
  folios: { titulo:/contador de folios/i, trae:['crm_aparta_folio', 'crm_folios'] }
};

for (const cual of ['firmas', 'folios']){
  await bloque(`· ${cual}.sql se copia ENTERO`, async () => {
    const r = await copiar(cual);
    const [paso1, paso2] = r.copias;
    console.log(`     paso 1: ${String(paso1||'').trim().split('\n').length} renglones · ` +
      `paso 2: ${String(paso2||'').trim().split('\n').length} (el archivo tiene ` +
      `${fs.readFileSync(RAIZ + '/' + cual + '.sql', 'utf8').trim().split('\n').length})`);
    afirma('el panel es el de ese archivo', esperado[cual].titulo.test(r.titulo));
    afirma('son dos pegados', r.copias.length === 2 && paso1 !== paso2);

    /* El paso 1 es el que puede disparar el agregado de Supabase, y por eso no
       lleva ni una función: si el editor lo parte, no hay `$$` que partir. */
    afirma('el paso 1 trae la tabla', /create table if not exists/.test(paso1));
    afirma('y NINGUNA función', !/\$\$/.test(paso1));
    afirma('el paso 1 es cortito', paso1.trim().split('\n').length < 40);
    afirma('el paso 1 avisa que terminó', paso1.trim().endsWith('as resultado;'));

    /* Y el paso 2 es al revés: trae las funciones y NINGUNA tabla nueva, que es
       lo único que dispara el agregado. */
    afirma('el paso 2 NO trae create table', !/create table/i.test(paso2));
    afirma('el paso 2 sí trae las funciones', /\$\$/.test(paso2));
    afirma('empieza la transacción', /^begin;/.test(paso2));
    afirma('la cierra', /\ncommit;/.test(paso2));
    afirma('y termina con la prueba de que llegó completo',
      paso2.trim().endsWith('as resultado;'));
    for (const t of esperado[cual].trae)
      afirma(`trae ${t}`, (paso1 + paso2).includes(t));
    afirma('no se coló un renglón de comentario',
      !paso2.split('\n').some(l => l.trim().startsWith('--')));
    afirma('los dos caben por debajo de los 100 renglones',
      paso1.trim().split('\n').length < 100 && paso2.trim().split('\n').length < 100);

    /* Y lo que más importa: que entre los dos esté TODO lo del archivo. */
    const real = fs.readFileSync(RAIZ + '/' + cual + '.sql', 'utf8');
    const falta = await p.evaluate(([t, se, p1, p2]) => {
      const juntos = (p1 + '\n' + p2).replace(/\s+/g, ' ');
      return sqlSinComentarios(t.replace(/^-- @(fin-)?tabla$/gm, ''), se)
        .split('\n').map(l => l.trim()).filter(Boolean)
        .filter(l => !juntos.includes(l.replace(/\s+/g, ' ')));
    }, [real, esperado[cual].trae[0], paso1, paso2]);
    if (falta.length) console.log('     se quedó fuera: ' + falta.slice(0,3).join(' / '));
    afirma('entre los dos pegados está TODO el archivo', falta.length === 0);
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
