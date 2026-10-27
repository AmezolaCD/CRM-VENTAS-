/* ===========================================================================
   LAS OPCIONES DEL CONTRATO: COMISIÓN Y DESAYUNO

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

   Y lo mismo con el desayuno, que Marco pidió después: «ayúdame a agregar en
   contratos la opción de con o sin desayuno». Ahí el cuidado está en el estado
   de EN MEDIO —no decir nada—, que es como se han comportado todos los
   contratos hasta hoy: sin él, el día que esto se publique, todos los que ya
   andan por ahí empezarían a decir algo que nadie decidió.

   Cómo correrla:  node pruebas/navegador/opciones-del-contrato.mjs

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
  /* «Antes de impuestos» no es adorno: un 10% sobre un total que ya trae el
     13% adentro es otra cantidad, y esa diferencia se discute con el contrato
     ya firmado. */
  afirma('dice TARIFAS COMISIONABLES AL 10% ANTES DE IMPUESTOS',
    r.renglon === '**TARIFAS COMISIONABLES AL 10% ANTES DE IMPUESTOS**');
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
    cot.renglon === '**TARIFAS COMISIONABLES AL 12% ANTES DE IMPUESTOS**');
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
  afirma('y el documento lo dice',
    r.renglon === '**TARIFAS COMISIONABLES AL 10% ANTES DE IMPUESTOS**');
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

/* --- 8 --------------------------------------------------------------------
   Con o sin desayuno. Vive en el mismo rincón del editor y del documento que
   la comisión, así que se prueba aquí mismo.

   Lo primero y más importante es el estado de en medio: por omisión el
   documento NO dice nada del desayuno. Si dijera «no incluye» por su cuenta,
   todos los contratos que ya andan por ahí cambiarían de texto el día que
   esto se publique, sin que nadie lo hubiera decidido. */
await bloque('8 · con o sin desayuno: por omisión, el documento no lo menciona', async () => {
  const r = await documento({});
  afirma('no habla de desayuno', !/desayuno/i.test(r.texto));
  afirma('y el contrato no carga el campo', !r.llaves.includes('desayuno'));
});

await bloque('9 · escogido, el documento lo dice', async () => {
  const si = await documento({ desayuno:'si' });
  afirma('«La tarifa incluye desayuno.»', /La tarifa incluye desayuno\./.test(si.texto));
  afirma('y no dice lo contrario', !/no incluye desayuno/i.test(si.texto));
  const no = await documento({ desayuno:'no' });
  afirma('«La tarifa no incluye desayuno.»', /La tarifa no incluye desayuno\./.test(no.texto));
  /* Va con la propuesta de hospedaje: es lo que la tarifa incluye o no. */
  afirma('va junto a los totales con impuestos',
    si.texto.indexOf('incluye desayuno') > si.texto.indexOf('impuestos incluidos'));
});

await bloque('10 · un valor raro no se cuela al documento', async () => {
  const r = await documento({ desayuno:'quizá' });
  afirma('se trata como si no se hubiera escogido', !/desayuno/i.test(r.texto));
  afirma('y no se guarda', !('desayuno' in r.guardado));
});

await bloque('11 · el desplegable está en el editor y guarda lo que se escoge', async () => {
  await p.evaluate(() => {
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    state.contratos = []; guardar();
    editarContrato(null, 'c1');
  });
  await p.locator('#ctDes').waitFor({ timeout:8000 });
  afirma('arranca en «no decirlo»', await p.locator('#ctDes').inputValue() === '');
  await p.selectOption('#ctDes', 'si');
  await p.fill('#tHosp tbody tr:first-child .h-desc', '10 habitaciones King');
  await p.fill('#tHosp tbody tr:first-child .h-noches', '2');
  await p.fill('#tHosp tbody tr:first-child .h-precio', '1800');
  await p.locator('#bOkCt').click();
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const k = state.contratos[0];
    if (!k) return { guardado:'(no se guardó)', texto:'' };
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
    return { guardado:k.desayuno, texto:caja.innerText };
  });
  afirma('se guardó lo que escogió', r.guardado === 'si');
  afirma('y el documento lo dice', /La tarifa incluye desayuno\./.test(r.texto));
});

/* --- 12 -------------------------------------------------------------------
   EL APARTADO DE COMISIÓN.

   Marco: «en los contratos puede ser comisionable al 10% antes de impuestos o
   no comisionable, en el caso de que sea comisionable que venga el texto que
   te adjunto». El texto explica cómo cobra la agencia: el cierre de cuenta,
   la factura con IVA, y que el hotel paga los lunes y aplica los jueves.

   Lo que se cuida:

   · que SALGA cuando las tarifas son comisionables, con sus dos párrafos;
   · que NO salga cuando no lo son —a un cliente directo no le dice nada, y
     prometerle días de pago que no le tocan es peor que callarse—;
   · que la COTIZACIÓN siga sin llevarlo, como el resto del clausulado;
   · y que se imprima como texto, no con la sangría del código adentro. `.pol`
     respeta los espacios, y ésa es la trampa que ya mordió una vez. */
await bloque('12 · comisionable: el contrato explica cómo se cobra', async () => {
  /** Lo que se ve de verdad: colgado del documento, que es donde se renderiza. */
  const hoja = (campos, tipo) => p.evaluate(({ c, t }) => {
    const k = saneaContrato(Object.assign({ id:'k12', tipo:t, clienteId:'c1',
      ejecutivo:'Sistemas', fecha:'2026-10-27', titulo:'Grupo de ejemplo',
      hospedaje:[saneaLineaHosp({ descripcion:'10 habitaciones King', noches:2, precio:1800 })]
    }, c));
    const caja = document.createElement('div');
    caja.className = 'doc-body';
    caja.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px';
    caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
    document.body.appendChild(caja);
    const h2 = [...caja.querySelectorAll('h2')].map(x => x.textContent.trim());
    const texto = caja.innerText;
    caja.remove();
    return { texto, h2 };
  }, { c: campos, t: tipo || 'contrato' });

  const con = await hoja({ comisionable:true, comision:10 });
  afirma('EL CONTRATO COMISIONABLE TRAE EL APARTADO', con.h2.includes('Comisión'));
  afirma('con el cierre de cuenta y la validación del cliente',
    /cierre de cuenta correspondiente, el cual será enviado al cliente/i.test(con.texto));
  afirma('con la factura por el total y su IVA',
    /emitir y enviar la factura por el monto total/i.test(con.texto) && /IVA/.test(con.texto));
  afirma('Y CON LOS DÍAS DE PAGO: lunes, aplicados los jueves',
    /procesa pagos los lunes/i.test(con.texto) && /aplicados los jueves/i.test(con.texto));
  afirma('y la documentación que hay que presentar',
    /documentación requerida por el hotel/i.test(con.texto));

  /* Dos párrafos, no uno: el renglón en blanco separa lo que hay que hacer de
     cuándo se cobra, y pegados se leen como una sola instrucción. */
  afirma('son DOS párrafos, no un bloque pegado',
    /IVA correspondiente\.\s*\n\s*\n?\s*El hotel procesa pagos/.test(con.texto));
  /* La trampa de `.pol`: respeta los espacios, así que la sangría del código
     se imprimiría tal cual delante del cliente. */
  afirma('y sin la sangría del código adentro',
    !/\n {4,}(Al término|El hotel procesa)/.test(con.texto));

  /* Dónde: después de los costos adicionales, pegado al renglón de la
     comisión, y antes de la vigencia y del clausulado. */
  afirma('VA DESPUÉS DE LOS COSTOS ADICIONALES',
    con.h2.indexOf('Comisión') > con.h2.indexOf('Costos adicionales no incluidos'));
  afirma('y antes de las condiciones del bloqueo',
    con.h2.indexOf('Comisión') < con.h2.indexOf('Condiciones del bloqueo'));
  afirma('una sola vez', con.h2.filter(x => x === 'Comisión').length === 1);

  /* --- Los grupos de control --- */
  const sin = await hoja({});
  afirma('SIN COMISIÓN NO ASOMA EL APARTADO', !sin.h2.includes('Comisión'));
  afirma('ni se le prometen días de pago a quien no cobra comisión',
    !/procesa pagos los lunes/i.test(sin.texto));
  afirma('y el contrato sigue completo',
    sin.h2.includes('Condiciones del bloqueo') && sin.h2.includes('Jurisdicción'));

  const cot = await hoja({ comisionable:true, comision:10 }, 'cotizacion');
  afirma('LA COTIZACIÓN NO LO LLEVA, como el resto del clausulado',
    !cot.h2.includes('Comisión') && !/procesa pagos los lunes/i.test(cot.texto));
  afirma('pero sí sigue diciendo que es comisionable',
    /TARIFAS COMISIONABLES AL 10% ANTES DE IMPUESTOS/.test(cot.texto));
});

/* --- 13 -------------------------------------------------------------------
   El 10% es lo que negocia el hotel, así que el editor lo propone. Propone,
   no impone. */
await bloque('13 · al prender la casilla, el editor propone el 10%', async () => {
  const r = await p.evaluate(async () => {
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    state.contratos = []; guardar();
    editarContrato(null, 'c1');
    const pct = document.querySelector('#ctComPct');
    const on  = document.querySelector('#ctComOn');
    on.checked = true; on.dispatchEvent(new Event('change'));
    const propuesto = pct.value;

    /* Y si ya había uno escrito, no se pisa: apagar y prender la casilla no
       debe borrarle a nadie el 12% que acababa de negociar. */
    pct.value = '12';
    on.checked = false; on.dispatchEvent(new Event('change'));
    on.checked = true;  on.dispatchEvent(new Event('change'));
    const respetado = pct.value;

    const ayuda = document.querySelector('#ctComAyuda').textContent;
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    return { propuesto, respetado, ayuda };
  });
  afirma('propone 10 al prenderla', r.propuesto === '10');
  afirma('Y NO PISA EL QUE YA ESTABA ESCRITO', r.respetado === '12');
  afirma('y la ayuda dice que es antes de impuestos', /antes de impuestos/i.test(r.ayuda));
  afirma('y que el contrato agrega el apartado', /apartado de Comisión/i.test(r.ayuda));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
