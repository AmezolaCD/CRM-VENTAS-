/* ===========================================================================
   «NO PUEDO VER MIS PROPIAS ACTIVIDADES»

   Lo reportó la gerencia de ventas: veía las actividades de todo el equipo
   menos las suyas. Y su papel es justo el que ve el trabajo de todos.

   Dos cosas distintas, y las dos se cuidan aquí.

   LA PRIMERA, un defecto. Cada departamento lleva su propia bitácora, y para
   no mezclarlas `otrosDepartamentos()` arma una lista negra DE NOMBRES con la
   gente que no es de este departamento. La armaba renglón por renglón: bastaba
   UN renglón con ese nombre y un papel de otra área para que el nombre entrara
   a la lista, aunque la misma persona tuviera su renglón bueno en ésta. Y eso
   pasa de verdad —un duplicado, uno viejo de quien cambió de área, uno a medio
   llenar—. Resultado: a esa persona se le escondía su propia bitácora en su
   propio departamento.

   LA SEGUNDA, lo que la pantalla no decía. El periodo trae «Últimos 30 días»
   por omisión, así que lo de hace cinco semanas no sale. La pantalla decía
   cuántas había en el periodo y se callaba cuántas quedaban fuera, que es
   exactamente el dato que contesta «¿y las mías?».

   Cómo correrla:  node pruebas/navegador/la-bitacora-de-cada-quien.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8888;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

const srv = http.createServer((req, res) => {
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
const p  = await br.newPage({ viewport:{ width:1280, height:900 } });
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/`);
await p.waitForFunction(() => typeof actividadesVisibles === 'function', null, { timeout:15000 });

const GERENTA = 'Ana Gerencia', EJECUTIVO = 'Beto Luna', DE_MKT = 'Dora Sainz';

/**
 * El equipo de ventas con su bitácora. `duplicada` agrega un renglón DE SOBRA
 * con el nombre de la gerenta y un papel de marketing: lo que pasa cuando
 * alguien cambia de área, o cuando un renglón se captura dos veces.
 */
const montar = ({ duplicada = false, hoyMismo = true } = {}) =>
  p.evaluate(({ GERENTA, EJECUTIVO, DE_MKT, duplicada, hoyMismo }) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const viejo = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    state.usuarios = [
      saneaUsuario({ id:'u1', correo:'admin@ejemplo.example', nombre:'Quien Administra', rol:'admin' }),
      saneaUsuario({ id:'u2', correo:'gerencia@ejemplo.example', nombre:GERENTA, rol:'gerente' }),
      saneaUsuario({ id:'u3', correo:'ventas@ejemplo.example', nombre:EJECUTIVO, rol:'ejecutivo' }),
      saneaUsuario({ id:'u4', correo:'mkt@ejemplo.example', nombre:DE_MKT, rol:'marketing' })];
    if (duplicada)
      state.usuarios.push(saneaUsuario({ id:'u9', correo:'ana.vieja@ejemplo.example',
                                         nombre:GERENTA, rol:'marketing' }));
    state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA UNO SA DE CV',
                                     ejecutivo:EJECUTIVO, estatus:'nuevo' })];
    state.actividades = [
      saneaAct({ id:'a1', clienteId:'c1', asunto:'Llamada de la gerencia',
                 responsable:GERENTA,   fecha:(hoyMismo ? hoy : viejo) + 'T10:00' }),
      saneaAct({ id:'a2', clienteId:'c1', asunto:'Visita del ejecutivo',
                 responsable:EJECUTIVO, fecha:hoy + 'T11:00' }),
      saneaAct({ id:'a3', clienteId:'c1', asunto:'Correo de marketing',
                 responsable:DE_MKT,    fecha:hoy + 'T12:00' })];
    ponDepto('ventas');
    filtroAct.periodo = '30'; filtroAct.ejecutivo = ''; filtroAct.tipo = '';
    filtros.q = '';
    guardar();
    vista = 'actividades'; render();
    return true;
  }, { GERENTA, EJECUTIVO, DE_MKT, duplicada, hoyMismo });

const enPantalla = () => p.evaluate(() => document.getElementById('tblAct').innerText);
/* Sólo las TABLAS, sin los filtros: el nombre de la gerenta sale en el select
   de ejecutivo aunque sus actividades estén escondidas, así que mirar la caja
   entera daba por bueno lo que no lo era. */
const enLasTablas = () => p.evaluate(() =>
  [...document.querySelectorAll('#tblAct table')].map(t => t.innerText).join('\n'));
const quienesSalen = () => p.evaluate(() =>
  actividadesVisibles().map(a => a.responsable));

/* --- 1 ---------------------------------------------------------------------
   GRUPO DE CONTROL, Y VA PRIMERO: con un solo renglón por persona todo sale
   como siempre, y lo de marketing sigue sin mezclarse. */
await bloque('1 · con un renglón por persona, cada quien ve su área', async () => {
  await montar();
  const r = await quienesSalen();
  afirma('la gerenta ve lo suyo', r.includes(GERENTA));
  afirma('y lo del ejecutivo', r.includes(EJECUTIVO));
  afirma('y NO lo de marketing, que es de otra área', !r.includes(DE_MKT));
});

/* --- 2 ---------------------------------------------------------------------
   EL CASO QUE REPORTÓ. Hoy nace en rojo: un renglón de sobra con su nombre la
   mete a la lista negra y le esconde su propia bitácora. */
await bloque('2 · un renglón de sobra no le esconde su propia bitácora', async () => {
  await montar({ duplicada:true });
  const r = await quienesSalen();
  afirma('SIGUE VIENDO LAS SUYAS', r.includes(GERENTA));
  afirma('y las del ejecutivo', r.includes(EJECUTIVO));
  afirma('y marketing sigue fuera', !r.includes(DE_MKT));
  afirma('Y SU NOMBRE SALE EN LA TABLA, no sólo en el filtro',
    (await enLasTablas()).includes(GERENTA));
});

/* --- 3 ---------------------------------------------------------------------
   GRUPO DE CONTROL: quien de verdad es de otra área sigue sin mezclarse,
   aunque tenga dos renglones. Si esto se rompe, el arreglo rompió la regla que
   separa las bitácoras. */
await bloque('3 · quien es de otra área sigue fuera, con uno o con dos renglones', async () => {
  await p.evaluate(n => {
    state.usuarios.push(saneaUsuario({ id:'u8', correo:'dora.otra@ejemplo.example',
                                       nombre:n, rol:'gte_marketing' }));
    guardar(); render();
  }, DE_MKT);
  const r = await quienesSalen();
  afirma('marketing sigue fuera', !r.includes(DE_MKT));
  afirma('y la gerenta dentro', r.includes(GERENTA));
});

/* --- 4 ---------------------------------------------------------------------
   LA SEGUNDA MITAD: lo que la pantalla no decía. Sus actividades eran de hace
   dos meses y el periodo trae treinta días. */
await bloque('4 · dice cuántas quedaron fuera del periodo', async () => {
  await montar({ hoyMismo:false });
  const t = await enPantalla();
  afirma('no salen las suyas, porque son viejas', !(await quienesSalen()).includes(GERENTA));
  afirma('PERO LA PANTALLA DICE QUE HAY MÁS FUERA', /fuera de este periodo/i.test(t));
  afirma('y cuántas', /\b1\b/.test(t));
  afirma('y dice qué hacer', /ponlo en/i.test(t) && /Todo/.test(t));

  /* Y en «Todo» salen, sin la frase: ya no hay nada fuera. */
  await p.evaluate(() => { filtroAct.periodo = 'todo'; render(); });
  const t2 = await enPantalla();
  afirma('con el periodo en Todo sí salen', (await quienesSalen()).includes(GERENTA));
  afirma('y la frase ya no sale', !/fuera de este periodo/i.test(t2));
});

/* --- 5 ---------------------------------------------------------------------
   GRUPO DE CONTROL: sin nada fuera, la frase no aparece —no se le pone un
   aviso a quien no tiene problema—. */
await bloque('5 · si no hay nada fuera, no dice nada', async () => {
  await montar();
  const t = await enPantalla();
  afirma('no hay frase de más', !/fuera de este periodo/i.test(t));
  afirma('pero sí la cuenta de siempre', /actividad\(es\)/.test(t));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
