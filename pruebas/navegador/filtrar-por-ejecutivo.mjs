/* ===========================================================================
   FILTRAR CONVENIOS Y CONTRATOS POR EJECUTIVO

   Marco: «haz que los convenios y contratos el administrador y la gerente de
   ventas lo puedan filtrar por ejecutivo».

   El filtro ya existía —el select «Todos» de arriba, `filtros.ejecutivo`—
   pero sólo se enseñaba en Tablero y Clientes. Las dos listas de documentos
   ya saben de quién es cada papel y ya enseñan la columna Ejecutivo a quien
   ve el trabajo de todo el equipo; lo que faltaba era poder filtrar por ella.

   Lo que se cuida aquí:

   · que el select se vea en Convenios y Contratos, y que filtre;
   · que filtre por LO MISMO QUE IMPRIME LA COLUMNA —lo que diga el propio
     documento, y si no dice nada, el dueño del cliente—;
   · que la cuenta y el vacío digan que hay un filtro puesto y cómo quitarlo;
   · que los avisos de documento suelto y de folio repetido NO se escondan
     detrás del filtro;
   · y el grupo de control que no se puede romper: a un ejecutivo el select no
     se le enseña y su lista le sale COMPLETA, aunque `filtros.ejecutivo`
     traiga un nombre de otra pantalla. Un filtro que muerde donde su control
     no se ve deja la lista vacía sin manera de vaciarlo.

   Cómo correrla:  node pruebas/navegador/filtrar-por-ejecutivo.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del cambio tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8883;
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
await p.waitForFunction(() => typeof renderConvenios === 'function', null, { timeout:15000 });

const ANA = 'Ana Pérez', BETO = 'Beto Luna';

/* Dos ejecutivas, un cliente de cada una, y de cada tipo de documento uno de
   cada quien. `v3` es el caso que hay que cuidar: lo levantó Beto para un
   cliente de Ana, y eso es justo lo que dice la columna. */
await p.evaluate(({ ANA, BETO }) => {
  ponDepto('ventas');
  state.usuarios = [
    saneaUsuario({ id:'u1', correo:'uno@ejemplo.example',  nombre:ANA,  rol:'ejecutivo' }),
    saneaUsuario({ id:'u2', correo:'dos@ejemplo.example',  nombre:BETO, rol:'ejecutivo' })];
  state.clientes = [
    saneaCliente({ id:'c1', empresa:'EMPRESA UNO SA DE CV', ejecutivo:ANA,  estatus:'nuevo' }),
    saneaCliente({ id:'c2', empresa:'EMPRESA DOS SA DE CV', ejecutivo:BETO, estatus:'nuevo' })];
  state.convenios = [
    saneaConv({ id:'v1', folio:'CV-2026-001', clienteId:'c1', fecha:'2026-01-10' }),
    saneaConv({ id:'v2', folio:'CV-2026-002', clienteId:'c2', fecha:'2026-01-11' }),
    saneaConv({ id:'v3', folio:'CV-2026-003', clienteId:'c1', ejecutivo:BETO, fecha:'2026-01-12' })];
  state.contratos = [
    saneaContrato({ id:'k1', folio:'CT-2026-001', clienteId:'c1', tipo:'cotizacion', fecha:'2026-02-10' }),
    saneaContrato({ id:'k2', folio:'CT-2026-002', clienteId:'c2', tipo:'contrato',   fecha:'2026-02-11' })];
  state.actividades = [];
  guardar();
}, { ANA, BETO });

/** Pone el filtro (y la búsqueda), dibuja la pantalla y devuelve qué se ve. */
const ver = (pantalla, caja, eje, q) => p.evaluate(({ pantalla, caja, eje, q }) => {
  if (eje !== null) filtros.ejecutivo = eje;
  if (q   !== null) filtros.q = q;
  /* `vista` y `filtros` se declaran con `let`: NO son propiedades de
     `window`. Se les asigna directo, como lo hace la propia aplicación. */
  vista = pantalla; render();
  const sel = document.getElementById('fEje');
  return { texto: document.getElementById(caja).innerText,
           selVisible: getComputedStyle(sel).display !== 'none',
           opciones: [...sel.options].map(o => o.text),
           valor: sel.value };
}, { pantalla, caja, eje, q });

const LISTAS = [['convenios','tblConvenios'], ['contratos','tblContratos']];

/* --- 1 ---------------------------------------------------------------------
   GRUPO DE CONTROL, Y VA PRIMERO: sin filtro, las listas salen como siempre. */
await bloque('1 · sin filtro, las dos listas salen completas', async () => {
  const c = await ver('convenios', 'tblConvenios', '', '');
  afirma('convenios: están los tres',
    ['CV-2026-001','CV-2026-002','CV-2026-003'].every(f => c.texto.includes(f)));
  afirma('y la cuenta dice «3 en total»', /3\s*en total/.test(c.texto));
  const k = await ver('contratos', 'tblContratos', '', '');
  afirma('contratos: están los dos',
    k.texto.includes('CT-2026-001') && k.texto.includes('CT-2026-002'));
  afirma('y la cuenta dice «2 en total»', /2\s*en total/.test(k.texto));
});

/* --- 2 ---------------------------------------------------------------------
   Lo que pidió Marco: que el control esté ahí. */
await bloque('2 · a la administración el select se le ve en las dos listas', async () => {
  for (const [vista, caja] of LISTAS){
    const r = await ver(vista, caja, '', '');
    afirma(`${vista}: EL SELECT SE VE`, r.selVisible);
    afirma(`${vista}: trae a las dos`,
      r.opciones.includes(ANA) && r.opciones.includes(BETO));
    afirma(`${vista}: y el «Todos»`, r.opciones.includes('Todos'));
  }
});

/* --- 3 ---------------------------------------------------------------------
   Y que filtre. Ojo con v3: es de un cliente de Ana pero lo levantó Beto, y
   manda lo que diga el documento, igual que la columna. */
await bloque('3 · escoger a una deja sólo lo suyo', async () => {
  const c = await ver('convenios', 'tblConvenios', ANA, '');
  afirma('convenios: SÓLO EL DE ANA', c.texto.includes('CV-2026-001'));
  afirma('no el de Beto', !c.texto.includes('CV-2026-002'));
  afirma('NI EL QUE BETO LEVANTÓ PARA UN CLIENTE DE ELLA',
    !c.texto.includes('CV-2026-003'));
  afirma('y la cuenta dice de quién', c.texto.includes('1 de ' + ANA));

  const k = await ver('contratos', 'tblContratos', ANA, '');
  afirma('contratos: SÓLO EL DE ANA', k.texto.includes('CT-2026-001'));
  afirma('no el de Beto', !k.texto.includes('CT-2026-002'));
  afirma('y la cuenta dice de quién', k.texto.includes('1 de ' + ANA));

  const b = await ver('convenios', 'tblConvenios', BETO, '');
  afirma('con Beto salen los suyos, el que levantó incluido',
    b.texto.includes('CV-2026-002') && b.texto.includes('CV-2026-003'));
  afirma('y no el de Ana', !b.texto.includes('CV-2026-001'));
});

/* --- 4 --------------------------------------------------------------------- */
await bloque('4 · volver a «Todos» los trae de vuelta', async () => {
  await ver('convenios', 'tblConvenios', ANA, '');
  const c = await ver('convenios', 'tblConvenios', '', '');
  afirma('están los tres otra vez',
    ['CV-2026-001','CV-2026-002','CV-2026-003'].every(f => c.texto.includes(f)));
  afirma('y el select volvió a «Todos»', c.valor === '');
});

/* --- 5 ---------------------------------------------------------------------
   Es el mismo select de arriba, así que lo escogido se queda. */
await bloque('5 · el filtro sigue puesto al pasar de una lista a la otra', async () => {
  await ver('convenios', 'tblConvenios', ANA, '');
  const k = await ver('contratos', 'tblContratos', null, null);
  afirma('contratos llega ya filtrado', k.texto.includes('CT-2026-001') &&
                                        !k.texto.includes('CT-2026-002'));
  afirma('y el select lo dice', k.valor === ANA);
});

/* --- 6 --------------------------------------------------------------------- */
await bloque('6 · se combina con el buscador', async () => {
  const c = await ver('convenios', 'tblConvenios', BETO, 'cv-2026-002');
  afirma('sale el que cumple las dos cosas', c.texto.includes('CV-2026-002'));
  afirma('y no el otro de Beto', !c.texto.includes('CV-2026-003'));
  afirma('la cuenta dice las dos razones',
    /coinciden con/.test(c.texto) && c.texto.includes('de ' + BETO));

  const v = await ver('convenios', 'tblConvenios', ANA, 'cv-2026-002');
  afirma('y cuando no hay ninguno, el vacío menciona el filtro',
    /Se está viendo sólo lo de/.test(v.texto) && v.texto.includes(ANA));
  await ver('convenios', 'tblConvenios', '', '');
});

/* --- 7 ---------------------------------------------------------------------
   El vacío tiene que decir de quién y cómo quitarlo: «Todavía no hay
   convenios» sería mentira con un filtro puesto. */
await bloque('7 · el vacío dice de quién es el filtro y cómo quitarlo', async () => {
  await p.evaluate(n => {
    state.usuarios.push(saneaUsuario({ id:'u3', correo:'tres@ejemplo.example',
                                       nombre:n, rol:'ejecutivo' }));
    guardar();
  }, 'Celia Mora');
  const c = await ver('convenios', 'tblConvenios', 'Celia Mora', '');
  afirma('dice que ninguno es suyo', /Ningún convenio es de/.test(c.texto));
  afirma('la nombra', c.texto.includes('Celia Mora'));
  afirma('y dice cómo quitarlo', /filtro de arriba/.test(c.texto));
  afirma('NO dice «Todavía no hay convenios»', !/Todavía no hay convenios/.test(c.texto));

  const k = await ver('contratos', 'tblContratos', 'Celia Mora', '');
  afirma('contratos igual', /Ningún contrato ni cotización es de/.test(k.texto) &&
                            /filtro de arriba/.test(k.texto));
});

/* --- 8 ---------------------------------------------------------------------
   Un papel con problema no se puede esconder detrás de un filtro. */
await bloque('8 · los avisos no se esconden detrás del filtro', async () => {
  await p.evaluate(() => {
    state.convenios.find(v => v.id === 'v2').folioRepetido = 'CV-2026-002';
    state.convenios.push(saneaConv({ id:'v4', folio:'CV-2026-004',
                                     clienteId:'borrado', ejecutivo:'Beto Luna' }));
    guardar();
  });
  const c = await ver('convenios', 'tblConvenios', ANA, '');
  afirma('EL AVISO DE FOLIO REPETIDO SIGUE SALIENDO', /folio repetido/i.test(c.texto));
  afirma('aunque el repetido sea de Beto', c.texto.includes('CV-2026-002'));
  afirma('y el de «sin cliente» también', /sin cliente|volver a ligar/i.test(c.texto));
  // Y la tabla, filtrada: el aviso avisa, pero la lista sigue siendo la de Ana.
  afirma('la tabla sigue trayendo sólo lo de Ana',
    c.texto.includes('CV-2026-001') && !c.texto.includes('CV-2026-003'));

  await p.evaluate(() => {
    delete state.convenios.find(v => v.id === 'v2').folioRepetido;
    state.convenios = state.convenios.filter(v => v.id !== 'v4');
    guardar();
  });
});

/* --- 9 ---------------------------------------------------------------------
   EL GRUPO DE CONTROL QUE NO SE PUEDE ROMPER.

   `filtros.ejecutivo` sobrevive al cambio de pantalla. Si el filtro mordiera
   donde el select no se ve, un ejecutivo vería su lista vacía por un control
   que no tiene enfrente. */
await bloque('9 · a un ejecutivo no se le enseña, y su lista sale completa', async () => {
  await p.evaluate(n => {
    window.rolActual = () => 'ejecutivo';
    window.usuarioActual = () => ({ id:'u2', correo:'dos@ejemplo.example',
                                    nombre:n, rol:'ejecutivo' });
  }, BETO);

  const c = await ver('convenios', 'tblConvenios', ANA, '');
  afirma('EL SELECT NO SE VE', !c.selVisible);
  afirma('Y SU LISTA SALE COMPLETA, no vacía',
    c.texto.includes('CV-2026-002') && c.texto.includes('CV-2026-003'));
  afirma('sin la columna Ejecutivo, como siempre', !/EJECUTIVO/.test(c.texto));

  const k = await ver('contratos', 'tblContratos', ANA, '');
  afirma('contratos igual', !k.selVisible && k.texto.includes('CT-2026-002'));

  await p.reload();
  await p.waitForFunction(() => typeof renderConvenios === 'function', null, { timeout:15000 });
  await p.evaluate(() => ponDepto('ventas'));
});

/* --- 10 --------------------------------------------------------------------
   Lo que ya funcionaba sigue igual. */
await bloque('10 · Tablero y Clientes no cambian', async () => {
  const cl = await ver('clientes', 'tblClientes', '', '');
  afirma('en Clientes el select se ve, como siempre', cl.selVisible);
  afirma('y están los dos clientes',
    cl.texto.includes('EMPRESA UNO') && cl.texto.includes('EMPRESA DOS'));
  const f = await ver('clientes', 'tblClientes', ANA, '');
  afirma('y sigue filtrando por persona',
    f.texto.includes('EMPRESA UNO') && !f.texto.includes('EMPRESA DOS'));

  await ver('clientes', 'tblClientes', '', '');
  const t = await p.evaluate(() => {
    vista = 'tablero'; render();
    return getComputedStyle(document.getElementById('fEje')).display !== 'none';
  });
  afirma('en el Tablero también', t);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
