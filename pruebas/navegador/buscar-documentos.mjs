/* ===========================================================================
   BUSCAR EN LAS LISTAS DE DOCUMENTOS

   Marco: «agrega un buscador de convenios y de contratos y cotizaciones».

   Las listas de documentos no tenían ninguno. Se nota el día que regresa un
   papel con su folio impreso: con treinta renglones hay que ir uno por uno.
   Se le puso a las CUATRO —convenios, contratos y cotizaciones de hospedaje,
   cotizaciones de evento y contratos de banquetes— porque tenerlo en unas y
   en otras no es algo que se quede así.

   Usan la caja de arriba de siempre, la misma de clientes y actividades.

   Lo que se cuida aquí:

   · que buscar por folio encuentre el documento y deje fuera a los demás, en
     las cuatro listas;
   · que también se pueda buscar por cliente;
   · QUE LA CAJA SE VEA en esas pantallas. Una caja escondida que filtra es
     peor que no tener buscador: los renglones desaparecen y no hay manera de
     vaciarla. Ya pasó una vez;
   · que diga cuántos coinciden y qué hacer cuando no hay ninguno;
   · y el grupo de control: con la caja vacía, las listas salen completas.

   Cómo correrla:  node pruebas/navegador/buscar-documentos.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8865;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

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
await p.goto(`http://127.0.0.1:${PUERTO}/`);
await p.waitForFunction(() => typeof render === 'function', null, { timeout:15000 });

/* Dos clientes y, de cada tipo de documento, uno de cada uno. */
await p.evaluate(() => {
  state.clientes = [
    saneaCliente({ id:'c1', empresa:'EMPRESA UNO SA DE CV', ejecutivo:'Quien Sea', estatus:'nuevo' }),
    saneaCliente({ id:'c2', empresa:'EMPRESA DOS SA DE CV', ejecutivo:'Quien Sea', estatus:'nuevo' })];
  state.convenios = [
    saneaConv({ id:'v1', folio:'CV-2026-001', clienteId:'c1', fecha:'2026-01-10' }),
    saneaConv({ id:'v2', folio:'CV-2026-002', clienteId:'c2', fecha:'2026-01-11' })];
  state.contratos = [
    saneaContrato({ id:'k1', folio:'CT-2026-001', clienteId:'c1', tipo:'cotizacion', fecha:'2026-02-10' }),
    saneaContrato({ id:'k2', folio:'CT-2026-002', clienteId:'c2', tipo:'contrato', fecha:'2026-02-11' })];
  state.eventos = [
    saneaEvento({ id:'e1', folio:'EV-2026-001', clienteId:'c1', tipo:'cotizacion', fecha:'2026-03-10' }),
    saneaEvento({ id:'e2', folio:'EV-2026-002', clienteId:'c2', tipo:'cotizacion', fecha:'2026-03-11' }),
    saneaEvento({ id:'e3', folio:'CB-2026-001', clienteId:'c1', tipo:'contrato', fecha:'2026-04-10' }),
    saneaEvento({ id:'e4', folio:'CB-2026-002', clienteId:'c2', tipo:'contrato', fecha:'2026-04-11' })];
  guardar();
});

/** Teclea en la caja de buscar y devuelve el texto de la lista de esa vista. */
const buscar = (pantalla, caja, texto) => p.evaluate(({ pantalla, caja, texto }) => {
  filtros.q = texto;
  const q = document.getElementById('q');
  q.value = texto;
  /* `vista` se declara con `let`, así que NO es una propiedad de `window`:
     asignarle por `window.vista` crea otra variable y la pantalla nunca
     cambia. Se le asigna directo, como lo hace la propia aplicación. */
  vista = pantalla;
  render();
  return { texto: document.getElementById(caja).innerText,
           cajaVisible: getComputedStyle(q).display !== 'none',
           ayuda: q.placeholder };
}, { pantalla, caja, texto });

const LISTAS = [
  ['convenios',   'tblConvenios',   'CV-2026-001', 'CV-2026-002'],
  ['contratos',   'tblContratos',   'CT-2026-001', 'CT-2026-002'],
  ['eventos',     'tblEventos',     'EV-2026-001', 'EV-2026-002'],
  ['contratosbq', 'tblContratosBq', 'CB-2026-001', 'CB-2026-002']
];

/* --- 1 ---------------------------------------------------------------------
   Grupo de control primero: sin buscar nada, están todos. */
await bloque('1 · con la caja vacía, las listas salen completas', async () => {
  for (const [vista, caja, uno, otro] of LISTAS){
    const r = await buscar(vista, caja, '');
    afirma(`${vista}: salen los dos`,
      r.texto.includes(uno) && r.texto.includes(otro));
  }
});

/* --- 2 ---------------------------------------------------------------------
   Lo que pidió Marco: teclear el folio y que aparezca. */
await bloque('2 · se busca por folio en las cuatro listas', async () => {
  for (const [vista, caja, uno, otro] of LISTAS){
    const r = await buscar(vista, caja, uno);
    afirma(`${vista}: ENCUENTRA ${uno}`, r.texto.includes(uno));
    afirma(`${vista}: y deja fuera al otro`, !r.texto.includes(otro));
  }
});

/* --- 3 ---------------------------------------------------------------------
   Y por cliente, que es como se busca cuando no se trae el papel. */
await bloque('3 · también se busca por cliente', async () => {
  for (const [vista, caja, uno, otro] of LISTAS){
    const r = await buscar(vista, caja, 'empresa dos');
    afirma(`${vista}: sale el de esa empresa`, r.texto.includes(otro));
    afirma(`${vista}: y no el del otro cliente`, !r.texto.includes(uno));
  }
});

/* --- 4 ---------------------------------------------------------------------
   LA CAJA SE TIENE QUE VER. Una caja escondida que filtra es peor que no
   tener buscador: los renglones desaparecen y nadie puede vaciarla. */
await bloque('4 · la caja se ve en las cuatro pantallas', async () => {
  for (const [vista, caja] of LISTAS){
    const r = await buscar(vista, caja, '');
    afirma(`${vista}: SE VE la caja de buscar`, r.cajaVisible);
    afirma(`${vista}: y dice que se busca por folio`, /folio/i.test(r.ayuda));
  }
});

/* --- 5 ---------------------------------------------------------------------
   Cuando no hay ninguno, que lo diga. */
await bloque('5 · sin coincidencias lo dice, no deja la lista muda', async () => {
  for (const [vista, caja] of LISTAS){
    const r = await buscar(vista, caja, 'zzzz-no-existe');
    afirma(`${vista}: avisa que ninguno coincide`,
      /ning[úu]n|no coincide|coinciden/i.test(r.texto));
  }
  const r = await buscar('convenios', 'tblConvenios', 'zzzz-no-existe');
  afirma('y dice por qué cosas se puede buscar', /folio, cliente/i.test(r.texto));
});

/* --- 6 ---------------------------------------------------------------------
   Grupo de control: la caja sigue sirviendo para lo de siempre. */
await bloque('6 · en Clientes la caja sigue buscando como antes', async () => {
  const r = await p.evaluate(() => {
    filtros.q = 'EMPRESA DOS';
    vista = 'clientes'; render();
    return { texto: document.getElementById('tblClientes').innerText,
             ayuda: document.getElementById('q').placeholder };
  });
  afirma('encuentra al cliente', r.texto.includes('EMPRESA DOS'));
  afirma('y no al otro', !r.texto.includes('EMPRESA UNO'));
  afirma('con su ayuda de siempre', /empresa, contacto/i.test(r.ayuda));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
