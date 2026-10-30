/* ===========================================================================
   SE CORRIGE HASTA QUE FIRME EL CLIENTE

   Marco: «quiero que se pueda modificar los contratos y convenios por parte de
   los ejecutivos antes de que lo firme el cliente; una vez firmado por el
   cliente ya no se puede editar».

   Antes, un documento se cerraba en cuanto dejaba de ser borrador: el
   ejecutivo firmaba —o, desde que los contratos se firman en papel, lo
   emitía— y ya no se le podía corregir ni una coma, aunque faltaran días para
   que el cliente lo viera.

   Lo que esta prueba cuida, que son las dos mitades de la misma regla:

   · que SE PUEDA corregir mientras el cliente no haya firmado, y que al
     guardar el documento vuelva a borrador como es debido: sin la firma del
     hotel —si no, su firma quedaría encima de un texto que cambió después—,
     sin el enlace viejo, sin el «enviado»… y CON SU FOLIO, que ya se apartó
     en el contador del hotel y no se gasta otro por una corrección;
   · y que NO se pueda en cuanto el cliente firmó, por cualquiera de los dos
     caminos: la firma en pantalla o el escaneado del papel.

   Las tres familias, porque la regla es la misma y el descuido sería dejar
   una fuera: convenios, contratos de hospedaje y documentos de banquetes.

   Cómo correrla:  node pruebas/navegador/editar-antes-de-la-firma.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8830;
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
/* Al abrir a corregir sale un confirm que avisa lo que va a costar; se acepta,
   y el bloque 5 comprueba aparte que de verdad se pregunta. */
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/`);
await p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });

await p.evaluate(() => {
  state.usuarios = [saneaUsuario({ id:'u1', nombre:'Sistemas',
    correo:'admin1@ejemplo.example', rol:'admin' })];
  detenerSondeo();
  programarSubida = () => {};
  ponDepto('ventas');
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO A.C.',
    contacto:'Contacto de ejemplo', ejecutivo:'Sistemas' })];
  guardar();
});

const FIRMA = { nombre:'Quien firma de ejemplo', puesto:'Ventas', celular:'',
                fecha:'2026-10-10T18:00:00.000Z', img:'data:image/png;base64,iVBORw0KGgo=' };

/** Las tres familias, cada una con lo suyo. */
const FAMILIAS = [
  { tipo:'convenios', nombre:'convenio',
    arma: extra => ({ id:'v1', clienteId:'c1', ejecutivo:'Sistemas', folio:'CV-2026-040',
      fecha:'2026-10-01', vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
      habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                      grupo:'deluxe', publica:5300, convenio:2800 }], ...extra }),
    firmadoHotel:{ estado:'firmado_ejecutiva', firmaHotel:FIRMA },
    firmadoCliente:{ estado:'firmado_cliente', firmaEmpresa:FIRMA } },
  { tipo:'contratos', nombre:'contrato de hospedaje',
    arma: extra => ({ id:'k1', clienteId:'c1', ejecutivo:'Sistemas', tipo:'cotizacion',
      folio:'CT-2026-007', fecha:'2026-10-01',
      hospedaje:[{ descripcion:'10 King', noches:2, precio:1800 }], ...extra }),
    firmadoHotel:{ estado:'firmado_hotel', firmaHotel:FIRMA },
    firmadoCliente:{ estado:'aceptado', firmaCliente:FIRMA } },
  { tipo:'eventos', nombre:'documento de banquetes',
    arma: extra => ({ id:'e1', clienteId:'c1', ejecutivo:'Sistemas', tipo:'contrato',
      folio:'CB-2026-003', fecha:'2026-10-01', titulo:'Evento de ejemplo', ...extra }),
    firmadoHotel:{ estado:'firmado' },               // en papel: emitido, sin firma trazada
    firmadoCliente:{ estado:'confirmado', firmaCliente:FIRMA } }
];

/** Mete un documento de esa familia y pregunta si se deja editar. */
const puedeEditar = (f, extra) => p.evaluate(({ t, d }) => {
  const sanea = { convenios:saneaConv, contratos:saneaContrato, eventos:saneaEvento }[t];
  const doc = sanea(d);
  state[t] = [doc];
  guardar();
  return { puede: sePuedeEditar(doc, t), estado: doc.estado };
}, { t: f.tipo, d: f.arma(extra) });

/* --- 1 --------------------------------------------------------------------
   Lo que ya se podía, y tiene que seguir pudiéndose. */
await bloque('1 · un borrador se corrige, como siempre', async () => {
  for (const f of FAMILIAS){
    const r = await puedeEditar(f, { estado:'borrador' });
    afirma(`el ${f.nombre} en borrador`, r.puede === true);
  }
});

/* --- 2 --------------------------------------------------------------------
   Lo nuevo: firmado por el hotel, o emitido, TODAVÍA se corrige. */
await bloque('2 · firmado por el hotel —o emitido— ahora SÍ se corrige', async () => {
  for (const f of FAMILIAS){
    const r = await puedeEditar(f, f.firmadoHotel);
    afirma(`el ${f.nombre} en «${r.estado}»`, r.puede === true);
  }
});

/* --- 3 --------------------------------------------------------------------
   Y la otra mitad, que es la que pidió con todas sus letras. */
await bloque('3 · firmado por el cliente, se cierra', async () => {
  for (const f of FAMILIAS){
    const r = await puedeEditar(f, f.firmadoCliente);
    afirma(`el ${f.nombre} firmado por el cliente`, r.puede === false);
  }
  /* El otro camino de la firma del cliente: el escaneado del papel. Desde que
     los contratos se firman a mano, es el que más va a usarse. */
  for (const f of FAMILIAS){
    const r = await puedeEditar(f, Object.assign({}, f.firmadoHotel, {
      firmaManual:{ fecha:'2026-10-11T10:00:00.000Z', quien:'Sistemas',
                    archivo:'firmado.pdf' } }));
    afirma(`el ${f.nombre} firmado en papel`, r.puede === false);
  }
});

/* --- 4 -------------------------------------------------------------------- */
await bloque('4 · cancelado y externo tampoco se tocan', async () => {
  const r1 = await puedeEditar(FAMILIAS[2], { estado:'cancelado' });
  afirma('un documento cancelado', r1.puede === false);
  const r2 = await puedeEditar(FAMILIAS[1], { estado:'borrador', externo:true });
  afirma('uno que vino de fuera, ya firmado', r2.puede === false);
});

/* --- 5 --------------------------------------------------------------------
   Lo que cuesta corregir se dice ANTES de teclear, no después de guardar. */
await bloque('5 · avisa antes de abrirlo, y sólo si ya había salido', async () => {
  const r = await p.evaluate(() => {
    const dichos = [];
    const antes = window.confirm;
    window.confirm = m => { dichos.push(m); return true; };
    const borrador = saneaContrato({ id:'k9', clienteId:'c1', estado:'borrador' });
    avisaQueSeReabre(borrador);
    const salido = saneaContrato({ id:'k8', clienteId:'c1', estado:'firmado_hotel',
      folio:'CT-2026-007',
      enviado:{ fecha:'2026-10-09T17:00:00.000Z', via:'correo', quien:'Sistemas' } });
    avisaQueSeReabre(salido);
    window.confirm = antes;
    return dichos;
  });
  afirma('al borrador no se le pregunta nada', r.length === 1);
  afirma('al que ya salió sí', /volver.* a quedar como BORRADOR/i.test(r[0] || ''));
  afirma('y se le dice cuándo se le mandó al cliente', /9 de octubre|09\/10|9 oct/i.test(r[0] || ''));
  afirma('y que el folio se conserva', /folio se conserva/i.test(r[0] || ''));
});

/* --- 6 --------------------------------------------------------------------
   Guardar la corrección: qué se cae y qué se queda. Es el corazón del cambio. */
await bloque('6 · al guardar, vuelve a borrador y conserva su folio', async () => {
  const r = await p.evaluate(() => {
    state.actividades = [];
    const k = saneaContrato({ id:'k7', clienteId:'c1', ejecutivo:'Sistemas',
      tipo:'cotizacion', folio:'CT-2026-007', estado:'firmado_hotel',
      firmaHotel:{ nombre:'Quien firma', fecha:'2026-10-10T18:00:00.000Z',
                   img:'data:image/png;base64,iVBORw0KGgo=' },
      tokenFirma:'laclavequeyaanda',
      enviado:{ fecha:'2026-10-09T17:00:00.000Z', via:'correo', quien:'Sistemas' } });
    state.contratos = [k]; guardar();
    reabrirParaCorregir(k, 'contratos', 'Sistemas');
    return { doc: JSON.parse(JSON.stringify(k)),
             bitacora: state.actividades.map(a => a.asunto + ' — ' + (a.notas || '')) };
  });
  afirma('vuelve a ser borrador', r.doc.estado === 'borrador');
  afirma('se le quita la firma del hotel', !r.doc.firmaHotel);
  afirma('el enlace viejo deja de servir', !r.doc.tokenFirma);
  afirma('y vuelve a decir que falta mandarlo', !r.doc.enviado);
  afirma('PERO conserva su folio', r.doc.folio === 'CT-2026-007');
  afirma('y queda marcado como que ya había salido', r.doc.yaSalio === true);
  afirma('queda escrito en la bitácora del cliente',
    r.bitacora.some(x => /se reabri[óo] para corregirlo/i.test(x) &&
                         /folio se conserva/i.test(x)));
});

/* --- 7 --------------------------------------------------------------------
   El folio ya apartado no se renumera por detrás, aunque el documento se vea
   como un borrador recién hecho. Era el agujero que abrió este cambio. */
await bloque('7 · a un documento reabierto no se le cambia el folio solo', async () => {
  const r = await p.evaluate(async () => {
    const viejo = saneaContrato({ id:'ka', clienteId:'c1', tipo:'cotizacion',
      folio:'CT-2026-050', estado:'aceptado', createdAt:'2026-10-01T10:00:00.000Z',
      firmaCliente:{ nombre:'x', fecha:'2026-10-02T10:00:00.000Z', img:'data:image/png;base64,AA' } });
    const reabierto = saneaContrato({ id:'kb', clienteId:'c1', tipo:'cotizacion',
      folio:'CT-2026-050', estado:'borrador', yaSalio:true,
      createdAt:'2026-10-03T10:00:00.000Z' });
    const nunca = saneaContrato({ id:'kc', clienteId:'c1', tipo:'cotizacion',
      folio:'CT-2026-050', estado:'borrador', createdAt:'2026-10-04T10:00:00.000Z' });
    state.contratos = [viejo, reabierto, nunca];
    guardar();
    // Async: el número nuevo se lo pide al contador del hotel.
    await resolverFoliosRepetidos();
    const de = id => state.contratos.find(k => k.id === id);
    return { reabierto: de('kb').folio, marcado: !!de('kb').folioRepetido,
             nunca: de('nunca') ? '' : de('kc').folio };
  });
  afirma('el reabierto se queda con su número', r.reabierto === 'CT-2026-050');
  afirma('y se marca para que alguien decida', r.marcado === true);
  /* Y lo de siempre sigue igual: un borrador que nunca salió sí se arregla
     solo, sin molestar a nadie. */
  afirma('el borrador que nunca salió sí se renumera', r.nunca !== 'CT-2026-050');
});

/* --- 8 --------------------------------------------------------------------
   Y que el botón esté donde tiene que estar: de nada sirve la regla si la
   pantalla no la refleja. */
await bloque('8 · el botón «Editar» aparece y desaparece con la regla', async () => {
  const mira = (t, extra, ver, id) => p.evaluate(({ t, d, ver, id }) => {
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    const sanea = { convenios:saneaConv, contratos:saneaContrato, eventos:saneaEvento }[t];
    state[t] = [sanea(d)]; guardar();
    window[ver](state[t][0].id);
    return !!document.querySelector('#' + id);
  }, { t, d: extra, ver, id });

  const ct = FAMILIAS[1];
  afirma('en el contrato firmado por el hotel, sí está',
    await mira('contratos', ct.arma(ct.firmadoHotel), 'verContrato', 'bEditCt') === true);
  afirma('y en cuanto lo firma el cliente, ya no',
    await mira('contratos', ct.arma(ct.firmadoCliente), 'verContrato', 'bEditCt') === false);

  const cv = FAMILIAS[0];
  afirma('en el convenio firmado por el ejecutivo, sí está',
    await mira('convenios', cv.arma(cv.firmadoHotel), 'verConvenio', 'bEdit') === true);
  afirma('y firmado por el cliente, ya no',
    await mira('convenios', cv.arma(cv.firmadoCliente), 'verConvenio', 'bEdit') === false);

  const ev = FAMILIAS[2];
  afirma('en el contrato de banquetes emitido, sí está',
    await mira('eventos', ev.arma(ev.firmadoHotel), 'verEvento', 'bEditEv') === true);
  afirma('y firmado en papel, ya no',
    await mira('eventos', ev.arma(Object.assign({}, ev.firmadoHotel, {
      firmaManual:{ fecha:'2026-10-11T10:00:00.000Z', quien:'Sistemas', archivo:'f.pdf' } })),
      'verEvento', 'bEditEv') === false);
});

/* --- 9 --------------------------------------------------------------------
   El candado de la sincronización: el campo nuevo no le nace a nadie. */
await bloque('9 · «yaSalio» no le nace a los documentos que nunca salieron', async () => {
  const r = await p.evaluate(() => [
    JSON.stringify(saneaConv({ id:'vz', clienteId:'c1' })),
    JSON.stringify(saneaContrato({ id:'kz', clienteId:'c1' })),
    JSON.stringify(saneaEvento({ id:'ez', clienteId:'c1' }))
  ]);
  afirma('ni al convenio, ni al contrato, ni al evento',
    r.every(x => !/yaSalio/.test(x)));
});

/* --- 10 -------------------------------------------------------------------
   Y el camino completo por la pantalla, que es donde se esconden los errores:
   los bloques de arriba llaman a las funciones sueltas, y lo que de verdad
   hay que probar es que el guardado de cada editor las llame. */
await bloque('10 · por la pantalla: abrir, corregir y guardar', async () => {
  const r = await p.evaluate(() => {
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    state.actividades = [];
    state.contratos = [saneaContrato({ id:'kw', clienteId:'c1', ejecutivo:'Sistemas',
      tipo:'cotizacion', folio:'CT-2026-077', estado:'firmado_hotel',
      titulo:'Como estaba antes',
      firmaHotel:{ nombre:'Quien firma', fecha:'2026-10-10T18:00:00.000Z',
                   img:'data:image/png;base64,iVBORw0KGgo=' },
      tokenFirma:'laclavequeyaanda',
      enviado:{ fecha:'2026-10-09T17:00:00.000Z', via:'correo', quien:'Sistemas' },
      hospedaje:[saneaLineaHosp({ descripcion:'10 King', noches:2, precio:1800 })] })];
    guardar();
    editarContrato('kw');
    return !!document.querySelector('#ctTitulo');
  });
  afirma('el editor abre sobre un contrato ya emitido', r === true);

  await p.fill('#ctTitulo', 'Ya corregido');
  await p.locator('#bOkCt').click();
  await p.waitForTimeout(400);

  const fin = await p.evaluate(() => {
    const k = state.contratos[0];
    return { titulo:k.titulo, estado:k.estado, firma:!!k.firmaHotel, token:k.tokenFirma,
             enviado:!!k.enviado, folio:k.folio, yaSalio:!!k.yaSalio,
             bitacora: state.actividades.map(a => a.asunto) };
  });
  afirma('se guardó la corrección', fin.titulo === 'Ya corregido');
  afirma('y el documento volvió a borrador', fin.estado === 'borrador');
  afirma('sin la firma del hotel', fin.firma === false);
  afirma('sin el enlace viejo', !fin.token);
  afirma('y pidiendo que se vuelva a mandar', fin.enviado === false);
  afirma('con su folio intacto', fin.folio === 'CT-2026-077');
  afirma('marcado como que ya había salido', fin.yaSalio === true);
  afirma('y anotado en la bitácora',
    fin.bitacora.some(x => /se reabri[óo] para corregirlo/i.test(x)));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
