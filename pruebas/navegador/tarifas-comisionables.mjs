/* ===========================================================================
   TARIFAS COMISIONABLES: QUE SEA UNA OPCIÓN

   Marco, pasando lo que le pidió su ejecutiva de ventas: «en los contratos de
   ventas sé que te pasé uno que no es comisionable, pero me pidió la ejecutiva
   de ventas que haya la posibilidad de que sea comisionable también, que sea
   una opción».

   El machote del hotel traía escrito a fuego «TARIFAS NETAS NO COMISIONABLES»,
   así que no había manera de cotizarle a una agencia de viajes sin que el
   documento dijera lo contrario de lo negociado.

   Lo que se cuida aquí:

   · que SIN MARCAR nada el documento diga exactamente lo de siempre —quien no
     use la opción no tiene por qué notar ningún cambio—;
   · que marcada diga lo que se negoció, con su porcentaje;
   · que el contrato que nadie marcó no cargue los campos nuevos. Ése es el
     candado de la sincronización: un campo que les naciera a los tres mil
     contratos a la vez los haría verse editados, y este equipo mandaría su
     copia encima de la de los demás;
   · y el grupo de control: la CARTA-CONVENIO no se tocó. Marco escogió «sólo
     en el contrato», y si esto se pone rojo es que se cambió de más.

   Cómo correrla:  node pruebas/navegador/tarifas-comisionables.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8818;
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
  state.usuarios = [saneaUsuario({ id:'u1', nombre:'Sistemas',
    correo:'admin1@ejemplo.example', rol:'admin' })];
  ponDepto('ventas');
  state.clientes = [saneaCliente({ id:'c1', empresa:'AGENCIA DE EJEMPLO S.A.',
    contacto:'Contacto de ejemplo', ejecutivo:'Sistemas' })];
  guardar();
});

/** Arma un contrato con la comisión que se le pida y devuelve lo que imprime. */
const documento = (campos, tipo) => p.evaluate(({ c, t }) => {
  const k = saneaContrato(Object.assign({ id:'k1', tipo:t, clienteId:'c1',
    ejecutivo:'Sistemas', fecha:'2026-10-13', titulo:'Grupo de ejemplo',
    hospedaje:[saneaLineaHosp({ descripcion:'10 habitaciones King', noches:2, precio:1800 })]
  }, c));
  state.contratos = [k]; guardar();
  const caja = document.createElement('div');
  caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
  const monos = [...caja.querySelectorAll('.ct-mon')].map(x => x.textContent.trim());
  return { texto: caja.innerText, monos,
           renglon: monos.find(x => /COMISIONABLE/.test(x)) || '',
           llaves: Object.keys(k), guardado: JSON.parse(JSON.stringify(k)) };
}, { c: campos, t: tipo || 'contrato' });

/* --- 1 --------------------------------------------------------------------
   Lo primero es lo que NO cambia: quien no use la opción no debe notar nada. */
await bloque('1 · sin marcar, el documento dice lo de siempre', async () => {
  const r = await documento({});
  afirma('sigue diciendo TARIFAS NETAS NO COMISIONABLES',
    r.renglon === '**TARIFAS NETAS NO COMISIONABLES**');
  /* El candado de la sincronización: un campo nuevo en cada contrato los haría
     verse editados a todos a la vez. */
  afirma('el contrato no carga «comisionable»', !r.llaves.includes('comisionable'));
  afirma('ni «comision»',                        !r.llaves.includes('comision'));
});

/* --- 2 -------------------------------------------------------------------- */
await bloque('2 · marcada y con porcentaje, lo dice con su número', async () => {
  const r = await documento({ comisionable:true, comision:10 });
  afirma('dice TARIFAS COMISIONABLES AL 10%',
    r.renglon === '**TARIFAS COMISIONABLES AL 10%**');
  afirma('y ya no dice lo contrario en ningún lado',
    !/NO COMISIONABLES/.test(r.texto));
  afirma('el contrato sí guarda las dos cosas',
    r.guardado.comisionable === true && r.guardado.comision === 10);
});

/* --- 3 --------------------------------------------------------------------
   El porcentaje a veces se negocia aparte. Un «AL %» suelto sería peor que no
   ponerlo. */
await bloque('3 · marcada sin porcentaje, no deja un «AL %» suelto', async () => {
  const r = await documento({ comisionable:true });
  afirma('dice sólo TARIFAS COMISIONABLES', r.renglon === '**TARIFAS COMISIONABLES**');
  afirma('sin un «AL» colgando', !/\bAL\b/.test(r.renglon));
  afirma('y no guarda un porcentaje de cero', !('comision' in r.guardado));
});

/* --- 4 --------------------------------------------------------------------
   Desmarcarla tiene que llevarse el porcentaje: uno colgando de una opción
   apagada confunde el día que alguien la vuelva a prender. */
await bloque('4 · desmarcarla lo regresa todo a su lugar', async () => {
  const r = await documento({ comisionable:false, comision:10 });
  afirma('vuelve a decir NO COMISIONABLES',
    r.renglon === '**TARIFAS NETAS NO COMISIONABLES**');
  afirma('y el porcentaje se cae con la casilla', !('comision' in r.guardado));
});

/* --- 5 -------------------------------------------------------------------- */
await bloque('5 · vale igual para la cotización que para el contrato', async () => {
  const cot = await documento({ comisionable:true, comision:12 }, 'cotizacion');
  afirma('la cotización también lo dice',
    cot.renglon === '**TARIFAS COMISIONABLES AL 12%**');
  const ctr = await documento({ comisionable:true, comision:12 }, 'contrato');
  afirma('y el contrato igual', ctr.renglon === cot.renglon);
});

/* --- 6 --------------------------------------------------------------------
   La casilla, en la pantalla donde la va a usar la ejecutiva. */
await bloque('6 · la casilla está en el editor y enseña su porcentaje al prenderla', async () => {
  await p.evaluate(() => {
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    state.contratos = []; guardar();
    editarContrato(null, 'c1');
  });
  const casilla = p.locator('label:has(#ctComOn)');
  await casilla.waitFor({ timeout:8000 });
  afirma('arranca apagada', !(await p.locator('#ctComOn').isChecked()));
  afirma('y el porcentaje no se asoma', !(await p.locator('#ctComPct').isVisible()));
  afirma('la ayuda dice qué pasa sin marcarla',
    /NETAS NO COMISIONABLES/.test(await p.locator('#ctComAyuda').textContent()));
  /* Se le pica a la PASTILLA, que es lo que ve quien usa el CRM: la casilla de
     verdad va escondida detrás, como en todo el proyecto (ver `pildora`). */
  await casilla.click();
  afirma('la casilla quedó marcada', await p.locator('#ctComOn').isChecked());
  /* Que SE VEA de verdad, no sólo que exista. El CSS de las pastillas esconde
     todo input que caiga dentro de `.opciones` —con opacity y position, no con
     display—, y Playwright da por visible algo con opacity 0. Esto se midió
     mirando la pantalla, y así se queda medido. */
  const seVe = await p.evaluate(() => {
    const el = document.querySelector('#ctComPct');
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { opacidad: Number(cs.opacity), ancho: r.width, alto: r.height,
             posicion: cs.position };
  });
  afirma(`y el porcentaje se ve de verdad (${Math.round(seVe.ancho)}×${Math.round(seVe.alto)} px)`,
    seVe.opacidad === 1 && seVe.ancho > 40 && seVe.alto > 20 && seVe.posicion !== 'absolute');
  afirma('y la ayuda cambia',
    /porcentaje/i.test(await p.locator('#ctComAyuda').textContent()));

  /* Y lo que se teclea llega al documento: es el camino completo, no sólo el
     renglón armado a mano en los bloques de arriba. */
  await p.locator('#ctComPct').fill('10');
  // Lo que el formulario exige para dejar guardar: cliente y una línea de hospedaje.
  await p.fill('#tHosp tbody tr:first-child .h-desc', '10 habitaciones King');
  await p.fill('#tHosp tbody tr:first-child .h-noches', '2');
  await p.fill('#tHosp tbody tr:first-child .h-precio', '1800');
  await p.locator('#bOkCt').click();
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const k = state.contratos[0];
    if (!k) return { guardado:{}, renglon:'(no se guardó el contrato)' };
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
    return { guardado: JSON.parse(JSON.stringify(k)),
             renglon: [...caja.querySelectorAll('.ct-mon')]
               .map(x => x.textContent.trim()).find(x => /COMISIONABLE/.test(x)) || '' };
  });
  afirma('se guardó lo que tecleó',
    r.guardado.comisionable === true && r.guardado.comision === 10);
  afirma('y el documento lo dice', r.renglon === '**TARIFAS COMISIONABLES AL 10%**');
});

/* --- 7 --------------------------------------------------------------------
   El grupo de control. Marco escogió «sólo en el contrato»: si esto se pone
   rojo, se cambió de más. */
await bloque('7 · la carta-convenio NO se tocó', async () => {
  const r = await p.evaluate(() => {
    const v = saneaConv({ id:'v1', clienteId:'c1', fecha:'2026-10-13',
      vigenciaDesde:'2026-10-13', vigenciaHasta:'2027-12-31',
      habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                      grupo:'deluxe', publica:5300, convenio:2800 }] });
    state.convenios = [v]; guardar();
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${cuerpoConvenio(v, cliente('c1'))}</div>`;
    return caja.innerText;
  });
  afirma('sigue diciendo «Tarifas NO COMISIONABLES»', /NO COMISIONABLES/i.test(r));
  afirma('y no le salió ninguna opción de comisión',
    !/TARIFAS COMISIONABLES/.test(r));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
