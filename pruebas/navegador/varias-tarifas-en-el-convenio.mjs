/* ===========================================================================
   VARIAS TARIFAS EN UN MISMO CONVENIO

   Marco: «hay clientes que piden dos tarifas, una con desayuno y otra sin
   desayuno, ya que habrá huéspedes de esa misma empresa que quieran uno u
   otro». Y al preguntarle resultó que no son dos: son cuatro —americano,
   bariátrico, larga estancia y sin desayuno— y las quiere en TABLAS
   SEPARADAS, no en columnas.

   Hasta hoy un convenio era una tarifa por tipo de habitación, y punto: el
   editor armaba un renglón por habitación con una sola casilla y la carta
   imprimía una tabla de tres columnas.

   Lo que se cuida aquí:

   · que se puedan capturar varias tarifas, una por modalidad;
   · que la carta imprima UNA TABLA POR TARIFA, con su título;
   · que una habitación sin tarifa en una modalidad NO salga en esa tabla
     —no todas se ofrecen con todos los desayunos—;
   · que lo tecleado no se pierda al cambiar de modalidades;
   · que la exportación saque un renglón por tarifa y no esconda tres;
   · y EL GRUPO DE CONTROL, que es lo que no se puede romper: un convenio de
     una sola tarifa —todos los que ya andan firmados— tiene que salir
     EXACTAMENTE igual que antes, letra por letra.

   Cómo correrla:  node pruebas/navegador/varias-tarifas-en-el-convenio.mjs
   Con APP_HTML se le apunta a otra copia del index.html.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8867;
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
await p.waitForFunction(() => typeof saneaConv === 'function', null, { timeout:15000 });

/** Un convenio con las habitaciones del catálogo y las tarifas que se le den. */
const montar = (habs, modalidades) => p.evaluate(({ habs, modalidades }) => {
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
    contacto:'Ana Ruiz', ejecutivo:'Quien Sea', estatus:'nuevo' })];
  const v = saneaConv(Object.assign({
    id:'v1', folio:'CV-2026-010', clienteId:'c1', fecha:'2026-10-01',
    vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
    habitaciones: habs
  }, modalidades ? { modalidades } : {}));
  state.convenios = [v];
  guardar();
  return cuerpoConvenio(v, cliente('c1'));
}, { habs, modalidades });

const HAB_A = { tipoId:'h1', codigo:'STKN', nombre:'Standard King', grupo:'deluxe', publica:5300 };
const HAB_B = { tipoId:'h2', codigo:'STDB', nombre:'Standard Doble', grupo:'deluxe', publica:5300 };

/* --- 1 ---------------------------------------------------------------------
   GRUPO DE CONTROL, Y VA PRIMERO. Lo que ya está firmado no puede cambiar. */
await bloque('1 · un convenio de una sola tarifa sale igual que siempre', async () => {
  const html = await montar([Object.assign({}, HAB_A, { convenio:2950 }),
                             Object.assign({}, HAB_B, { convenio:3150 })]);
  const tablas = (html.match(/<table class="tar">/g) || []).length;
  afirma('UNA SOLA TABLA DE TARIFAS', tablas === 1);
  afirma('con el encabezado de siempre', /Tarifa convenio/.test(html));
  afirma('y sus dos habitaciones', /Standard King/.test(html) && /Standard Doble/.test(html));
  afirma('no dice nada de modalidades',
    !/Con desayuno/.test(html) && !/Sin desayuno/.test(html));
});

/* --- 2 ---------------------------------------------------------------------
   EL CASO DE MARCO. */
await bloque('2 · con varias modalidades, una tabla por tarifa', async () => {
  const html = await montar([
    Object.assign({}, HAB_A, { convenio:2950, porModalidad:{ americano:2950, ninguno:2650 } }),
    Object.assign({}, HAB_B, { convenio:3150, porModalidad:{ americano:3150, ninguno:2850 } })
  ], ['americano', 'ninguno']);

  const tablas = (html.match(/<table class="tar">/g) || []).length;
  afirma('DOS TABLAS, una por tarifa', tablas === 2);
  afirma('la primera dice con qué desayuno', /Con desayuno americano/.test(html));
  afirma('y la otra que es sin desayuno', /Sin desayuno/.test(html));
  afirma('salen las cuatro tarifas',
    /2,950/.test(html) && /2,650/.test(html) && /3,150/.test(html) && /2,850/.test(html));
  afirma('y ya no se habla de «Tarifa convenio» a secas', !/>Tarifa convenio</.test(html));
});

/* --- 3 ---------------------------------------------------------------------
   Las cuatro que de verdad pidió. */
await bloque('3 · las cuatro modalidades a la vez', async () => {
  const html = await montar([Object.assign({}, HAB_A,
    { convenio:3100, porModalidad:{ americano:3100, bariatrico:3250,
                                    larga_estancia:2900, ninguno:2650 } })],
    ['americano', 'bariatrico', 'larga_estancia', 'ninguno']);
  const tablas = (html.match(/<table class="tar">/g) || []).length;
  afirma('CUATRO TABLAS', tablas === 4);
  afirma('cada una con su nombre',
    /americano/i.test(html) && /bari[áa]trico/i.test(html) &&
    /larga estancia/i.test(html) && /Sin desayuno/.test(html));
});

/* --- 4 ---------------------------------------------------------------------
   No todas las habitaciones se ofrecen con todos los desayunos. */
await bloque('4 · la habitación sin tarifa no sale en esa tabla', async () => {
  const html = await montar([
    Object.assign({}, HAB_A, { convenio:2950, porModalidad:{ americano:2950, ninguno:2650 } }),
    // La Doble sólo se ofrece CON desayuno.
    Object.assign({}, HAB_B, { convenio:3150, porModalidad:{ americano:3150 } })
  ], ['americano', 'ninguno']);

  const partes = html.split('<table class="tar">');
  const conDesayuno = partes[1] || '', sinDesayuno = partes[2] || '';
  afirma('en la de con desayuno salen las dos',
    /Standard King/.test(conDesayuno) && /Standard Doble/.test(conDesayuno));
  afirma('Y EN LA DE SIN DESAYUNO SÓLO LA QUE SÍ TIENE TARIFA',
    /Standard King/.test(sinDesayuno) && !/Standard Doble/.test(sinDesayuno));
});

/* --- 5 ---------------------------------------------------------------------
   El saneador: lo que no se usa no se escribe, y lo inventado no entra. */
await bloque('5 · las modalidades nacen al usarse', async () => {
  const r = await p.evaluate(() => {
    const limpio = saneaConv({ id:'vx', clienteId:'c1' });
    const unaSola = saneaConv({ id:'vy', clienteId:'c1', modalidades:['americano'] });
    const basura  = saneaConv({ id:'vz', clienteId:'c1',
      modalidades:['americano','inventada','americano','ninguno'] });
    const hab = saneaConv({ id:'vw', clienteId:'c1', modalidades:['americano','ninguno'],
      habitaciones:[{ tipoId:'h1', nombre:'K', grupo:'deluxe', publica:100, convenio:90,
                      porModalidad:{ americano:90, ninguno:0, inventada:50 } }] });
    return { limpio: JSON.stringify(limpio).includes('modalidades'),
             unaSola: JSON.stringify(unaSola).includes('modalidades'),
             basura: basura.modalidades,
             pm: hab.habitaciones[0].porModalidad };
  });
  afirma('un convenio normal no trae la llave', r.limpio === false);
  afirma('con una sola modalidad tampoco: eso es la tarifa de siempre', r.unaSola === false);
  afirma('no se cuela una inventada ni una repetida',
    JSON.stringify(r.basura) === JSON.stringify(['americano','ninguno']));
  afirma('ni una tarifa en cero, ni una modalidad que no existe',
    JSON.stringify(r.pm) === JSON.stringify({ americano:90 }));
});

/* --- 6 ---------------------------------------------------------------------
   La exportación: cuatro tarifas no se pueden esconder detrás de una. */
await bloque('6 · la exportación saca un renglón por tarifa', async () => {
  await montar([Object.assign({}, HAB_A,
    { convenio:2950, porModalidad:{ americano:2950, ninguno:2650 } })],
    ['americano', 'ninguno']);
  const r = await p.evaluate(() => {
    const bajados = [];
    const antes = window.descargar;
    window.descargar = (nombre, txt) => bajados.push(txt);
    document.getElementById('bExport').click();
    const ov = document.querySelector('.overlay');
    ov.querySelector('#eConv').click();
    window.descargar = antes;
    ov.remove();
    return bajados[0] || '';
  });
  const renglones = r.split('\n').filter(l => /Standard King/.test(l));
  afirma('DOS RENGLONES PARA LA MISMA HABITACIÓN', renglones.length === 2);
  afirma('y cada uno dice de qué tarifa es',
    renglones.some(l => /americano/i.test(l)) && renglones.some(l => /Sin desayuno/.test(l)));
  afirma('con sus dos números',
    renglones.some(l => /2950/.test(l)) && renglones.some(l => /2650/.test(l)));
});

/* --- 7 ---------------------------------------------------------------------
   GRUPO DE CONTROL de la exportación: sin modalidades, un renglón, como antes. */
await bloque('7 · sin modalidades, la exportación es la de siempre', async () => {
  await montar([Object.assign({}, HAB_A, { convenio:2950 })]);
  const r = await p.evaluate(() => {
    const bajados = [];
    const antes = window.descargar;
    window.descargar = (nombre, txt) => bajados.push(txt);
    document.getElementById('bExport').click();
    const ov = document.querySelector('.overlay');
    ov.querySelector('#eConv').click();
    window.descargar = antes;
    ov.remove();
    return bajados[0] || '';
  });
  const renglones = r.split('\n').filter(l => /Standard King/.test(l));
  afirma('un solo renglón', renglones.length === 1);
  afirma('y su tarifa dice que es la única', /Única/.test(renglones[0] || ''));
});

/* --- 8 -------------------------------------------------------------------
   EL EDITOR DE VERDAD. Lo de arriba prueba el modelo, la carta y la
   exportación; esto prueba lo que una persona hace con el ratón, que es
   donde se rompen las cosas. */
await bloque('8 · se capturan dos tarifas en el editor y se guardan', async () => {
  await p.evaluate(() => {
    state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
      contacto:'Ana Ruiz', ejecutivo:'Quien Sea', estatus:'nuevo' })];
    state.habitaciones = [
      saneaHab({ id:'h1', codigo:'STKN', nombre:'Standard King', grupo:'deluxe', publica:5300 }),
      saneaHab({ id:'h2', codigo:'STDB', nombre:'Standard Doble', grupo:'deluxe', publica:5300 })];
    state.convenios = [];
    guardar();
    editarConvenio(null, 'c1');
  });
  await p.locator('#cModalidades').waitFor({ timeout:8000 });

  // Antes de marcar nada: una sola columna de tarifa, como siempre.
  const antes = await p.evaluate(() =>
    document.querySelectorAll('#bloqueDeluxe tr[data-tipo]:first-child .conv').length);
  afirma('arranca con una sola casilla de tarifa por habitación', antes === 1);

  /* Se le pica a la PASTILLA, no a la casilla: el `input` está escondido a
     propósito —`.opciones input{opacity:0;width:0}`— para que se vea como
     pastilla y siga recibiendo el foco del teclado. Es lo que hace una
     persona. */
  const pastilla = valor => p.locator(`#cModalidades label:has(input[value="${valor}"])`);
  await pastilla('americano').click();
  await pastilla('ninguno').click();
  await p.waitForTimeout(250);

  const despues = await p.evaluate(() =>
    document.querySelectorAll('#bloqueDeluxe tr[data-tipo]:first-child .conv').length);
  afirma('AL MARCAR DOS, APARECEN DOS CASILLAS', despues === 2);

  // Se captura la King con las dos, y la Doble sólo con desayuno.
  await p.evaluate(() => {
    const filas = [...document.querySelectorAll('#bloqueDeluxe tr[data-tipo]')];
    const pon = (tr, mod, val) => {
      tr.querySelector('.sel').checked = true;
      tr.querySelector('.sel').dispatchEvent(new Event('change', { bubbles:true }));
      const inp = tr.querySelector(`.conv[data-mod="${mod}"]`);
      inp.value = val;
      inp.dispatchEvent(new Event('input', { bubbles:true }));
    };
    pon(filas[0], 'americano', '2950');
    pon(filas[0], 'ninguno',   '2650');
    pon(filas[1], 'americano', '3150');
  });

  // Y lo que no se puede perder: desmarcar y volver a marcar no borra nada.
  await pastilla('bariatrico').click();
  await p.waitForTimeout(200);
  await pastilla('bariatrico').click();
  await p.waitForTimeout(200);
  const sigue = await p.evaluate(() =>
    document.querySelector('#bloqueDeluxe tr[data-tipo] .conv[data-mod="americano"]').value);
  afirma('LO TECLEADO SOBREVIVE A CAMBIAR DE MODALIDADES', sigue === '2950');

  await p.locator('#bOk').click();
  await p.waitForTimeout(500);

  const v = await p.evaluate(() => {
    const x = state.convenios[0];
    return x ? { mods:x.modalidades, habs:x.habitaciones.map(h => ({
      nombre:h.nombre, convenio:h.convenio, pm:h.porModalidad })) } : null;
  });
  afirma('el convenio se guardó', !!v);
  afirma('con sus dos modalidades',
    !!v && JSON.stringify(v.mods) === JSON.stringify(['americano','ninguno']));
  afirma('la King con sus dos tarifas',
    !!v && JSON.stringify((v.habs[0]||{}).pm) === JSON.stringify({ americano:2950, ninguno:2650 }));
  afirma('la Doble sólo con la de desayuno',
    !!v && JSON.stringify((v.habs[1]||{}).pm) === JSON.stringify({ americano:3150 }));
  afirma('y `convenio` sigue trayendo un número, que es lo que leen la lista y los reportes',
    !!v && v.habs[0].convenio === 2950);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
