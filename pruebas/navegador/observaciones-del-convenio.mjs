/* ===========================================================================
   LAS OBSERVACIONES QUE SÍ SALEN EN LA CARTA-CONVENIO

   Marco: «agrega a los convenios un apartado de detalles pero ADICIONAL al de
   observaciones internas, que haya un campo donde pueda agregar observaciones
   pero que SÍ VENGAN EN EL CONVENIO».

   El convenio tenía un solo campo de notas, y su propia ayuda decía que no se
   imprimen. Lo que el ejecutivo quería decirle al cliente no tenía dónde ir:
   o lo metía en un texto de Ajustes —que es del hotel entero y le cambia la
   carta a todos los clientes— o no lo ponía.

   Lo que se cuida aquí:

   · que lo escrito SALGA en la carta, con sus saltos de renglón donde el
     ejecutivo los puso;
   · que las INTERNAS SIGAN SIN SALIR. Ése es el grupo de control y es lo
     único que distingue los dos campos: si un día se cruzan, una nota del
     equipo —«ojo, este cliente paga tarde»— acabaría impresa delante de él;
   · que vacío no imprima ni el encabezado;
   · y que el campo nazca al usarse: un convenio que no lo use no carga la
     llave, o la sincronización daría por editados a todos los convenios a la
     vez y este equipo mandaría su copia encima de la de los demás.

   Cómo correrla:  node pruebas/navegador/observaciones-del-convenio.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8855;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const srv = http.createServer((q, r) => {
  r.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
  r.end(fs.readFileSync(APP, 'utf8'));
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
const p  = await br.newPage({ viewport:{ width:1200, height:900 } });
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/`);
await p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });

await p.evaluate(() => {
  state.usuarios = [saneaUsuario({ id:'u1', nombre:'Carmen Ejemplo',
    correo:'ventas@ejemplo.example', rol:'ejecutivo' })];
  ponDepto('ventas');
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO S.A.',
    contacto:'Contacto Ejemplo', ejecutivo:'Carmen Ejemplo' })];
  guardar();
});

/** Arma un convenio con lo que se le pida y devuelve lo que imprime. */
const documento = campos => p.evaluate(c => {
  const v = saneaConv(Object.assign({ id:'v1', clienteId:'c1', ejecutivo:'Carmen Ejemplo',
    fecha:'2026-10-27',
    habitaciones:[{ grupo:'deluxe', codigo:'DLX', nombre:'Deluxe King', publica:2500, convenio:1900 }],
    textos: Object.assign({}, state.ajustes.textos) }, c));
  /* Colgado del documento: `innerText` de un nodo suelto no renderiza y
     devolvería el texto crudo, con la sangría del código adentro. */
  const caja = document.createElement('div');
  caja.className = 'doc-body';
  caja.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px';
  caja.innerHTML = `<div class="doc-contenido">${cuerpoConvenio(v, cliente('c1'))}</div>`;
  document.body.appendChild(caja);
  const texto = caja.innerText;
  const h2 = [...caja.querySelectorAll('h2')].map(x => x.textContent.trim());
  caja.remove();
  return { texto, h2, llaves: Object.keys(v) };
}, campos);

/* --- 1 -------------------------------------------------------------------- */
await bloque('1 · lo que se escribe para el cliente, sale en la carta', async () => {
  const r = await documento({
    observaciones:'La tarifa de fin de semana aplica sólo de viernes a domingo.\nCortesía: una suite por cada 20 habitaciones.' });
  afirma('trae el apartado de Observaciones', r.h2.includes('Observaciones'));
  afirma('con lo que escribió el ejecutivo',
    /tarifa de fin de semana aplica sólo de viernes a domingo/i.test(r.texto));
  afirma('y el segundo renglón también', /Cortesía: una suite por cada 20 habitaciones/i.test(r.texto));
  /* El textarea trae saltos de verdad, y tienen que llegar al papel: una
     lista de tres cosas en un solo párrafo no se lee igual. */
  afirma('LOS SALTOS DE RENGLÓN SE RESPETAN',
    /viernes a domingo\.\s*\n\s*Cortesía/.test(r.texto));
  afirma('va al final, después de las políticas',
    r.h2.indexOf('Observaciones') > r.h2.indexOf('Políticas'));
});

/* --- 2 --------------------------------------------------------------------
   EL GRUPO DE CONTROL. Si esto se pone rojo, una nota del equipo acabó
   impresa delante del cliente. */
await bloque('2 · las observaciones INTERNAS siguen sin salir', async () => {
  const r = await documento({ notas:'Ojo: este cliente siempre paga tarde. No dar crédito.' });
  afirma('no se imprime la nota del equipo', !/paga tarde/i.test(r.texto));
  afirma('ni asoma el apartado por tenerla', !r.h2.includes('Observaciones'));

  /* Y los dos juntos: cada uno en su lugar. */
  const dos = await documento({
    notas:'Ojo: este cliente siempre paga tarde.',
    observaciones:'Las tarifas incluyen estacionamiento.' });
  afirma('CON LOS DOS LLENOS, sólo sale el del cliente',
    /estacionamiento/i.test(dos.texto) && !/paga tarde/i.test(dos.texto));
  afirma('y los dos se guardan por separado',
    dos.llaves.includes('notas') && dos.llaves.includes('observaciones'));
});

/* --- 3 -------------------------------------------------------------------- */
await bloque('3 · vacío no imprime ni el título', async () => {
  const r = await documento({});
  afirma('sin observaciones no hay apartado', !r.h2.includes('Observaciones'));
  afirma('y la carta sigue completa',
    r.h2.includes('Políticas') && /Especificaciones de tarifas/i.test(r.texto));

  const blanco = await documento({ observaciones:'   \n  ' });
  afirma('sólo espacios tampoco imprime nada', !blanco.h2.includes('Observaciones'));
});

/* --- 4 --------------------------------------------------------------------
   El candado de la sincronización. */
await bloque('4 · el campo nace al usarse', async () => {
  const sin = await documento({});
  afirma('un convenio que no lo usa NO carga la llave', !sin.llaves.includes('observaciones'));
  const blanco = await documento({ observaciones:'   ' });
  afirma('ni uno al que se le vació', !blanco.llaves.includes('observaciones'));
  const con = await documento({ observaciones:'Algo' });
  afirma('y el que sí lo usa, la carga', con.llaves.includes('observaciones'));
});

/* --- 5 --------------------------------------------------------------------
   Los dos campos tienen que verse juntos: separados se confunden, y el error
   de confundirlos se paga delante de un cliente. */
await bloque('5 · el editor enseña los dos, y dice cuál es cuál', async () => {
  const r = await p.evaluate(async () => {
    const v = saneaConv({ id:'v5', clienteId:'c1', ejecutivo:'Carmen Ejemplo',
      fecha:'2026-10-27', notas:'interna', observaciones:'para el cliente' });
    state.convenios = [v]; guardar();
    editarConvenio('v5');
    const obs = document.querySelector('#cObs'), nts = document.querySelector('#cNotas');
    const txt = document.querySelector('.modal-body')?.innerText || '';
    const r = { hayObs:!!obs, hayNotas:!!nts,
                valObs: obs ? obs.value : '', valNotas: nts ? nts.value : '',
                diceSalen: /salen en la carta/i.test(txt),
                diceNoSalen: /no.{0,3} se imprimen en la carta/i.test(txt) };
    document.querySelector('.modal [data-close]')?.click();
    return r;
  });
  afirma('está el campo que sale en la carta', r.hayObs);
  afirma('y el de las notas internas', r.hayNotas);
  afirma('cada uno con su contenido, sin pisarse',
    r.valObs === 'para el cliente' && r.valNotas === 'interna');
  afirma('EL EDITOR DICE CUÁL SALE', r.diceSalen);
  afirma('y cuál no', r.diceNoSalen);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
