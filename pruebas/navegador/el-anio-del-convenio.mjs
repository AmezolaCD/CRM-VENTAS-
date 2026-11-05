/* ===========================================================================
   EL AÑO DEL FOLIO DE UN CONVENIO

   Marco: «Convenio CV-2026-101 aparece como 2026 por qué si es del 2027?».

   Tenía razón, y la contradicción estaba dentro del mismo documento. El CRM
   sacaba el año DOS VECES y de DOS CAMPOS distintos:

     · el folio, de `vigenciaDesde`;
     · la carta —el {{ANIO}}— y la columna Vigencia de la lista, de
       `vigenciaHasta`.

   Un convenio nace con el "desde" en hoy y el "hasta" el 31 de diciembre de
   este año. El que se captura en noviembre para la temporada que viene se
   captura como siempre: se le mueve el "hasta" al año que entra y el "desde"
   se queda en la fecha de captura. Resultado: la carta decía 2027, la lista
   decía «hasta 31-dic-2027», y el folio decía 2026.

   Lo que se cuida aquí:

   · que el año del folio salga del "hasta", que es el único de los dos que se
     ve en pantalla;
   · que el folio y el {{ANIO}} de la carta NO PUEDAN discrepar, porque ahora
     salen del mismo renglón;
   · los dos caminos que reparten folio —la firma del ejecutivo y el convenio
     que regresó firmado en papel— y el documento escaneado que se registra de
     fuera;
   · que un convenio de enero a diciembre siga dando el mismo folio de siempre
     (el grupo de control que no se puede romper);
   · que un folio YA repartido no se mueva solo, y que la carta diga por qué
     cuando el año ya no cuadra;
   · y que la administración lo pueda corregir a mano, con rastro.

   Cómo correrla:  node pruebas/navegador/el-anio-del-convenio.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del arreglo tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8881;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium';

const srv = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
  res.end(fs.readFileSync(APP, 'utf8'));
});
await new Promise(r => srv.listen(PUERTO, '127.0.0.1', r));

/* Un PDF de mentiras, pero PDF: es lo que piden las dos pantallas de subir. */
const PDF = path.join(os.tmpdir(), 'convenio-de-ejemplo.pdf');
fs.writeFileSync(PDF, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

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
await p.waitForFunction(() => typeof verConvenio === 'function', null, { timeout:15000 });
/* Sin servidor configurado el rol es «admin» —ver `rolActual`—, que es lo que
   hace falta para el botón de corregir el folio. El bloque 9 lo cambia. */
await p.evaluate(() => { ponDepto('ventas'); });

const EJE = { nombre:'Quien Sea', puesto:'Ejecutivo de ventas',
              celular:'664 000 0000', img:'data:image/png;base64,AA' };

/** Deja un convenio en borrador, con la vigencia que se le pida. */
const montar = extra => p.evaluate(x => {
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
    contacto:'Ana Ruiz', telefono:'664 000 0000', ejecutivo:'Quien Sea', estatus:'nuevo' })];
  state.convenios = [saneaConv(Object.assign({
    id:'v1', clienteId:'c1', ejecutivo:'Quien Sea', folio:'', estado:'borrador',
    fecha:'2026-11-01',
    habitaciones:[{ grupo:'deluxe', tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                    publica:5300, convenio:2700 }]
  }, x))];
  state.actividades = [];
  guardar();
  vista = 'convenios'; render();
  return true;
}, extra);

/** Firma el ejecutivo: es AHÍ donde nace el folio. Ver `folioParaFirmar`. */
const firmaElHotel = () => p.evaluate(async d => {
  await firmar(state.convenios[0], 'hotel', d);
  guardar();
  return state.convenios[0].folio;
}, EJE);

const folio = () => p.evaluate(() => state.convenios[0].folio);

/** Abre la carta y devuelve lo que se lee en ella. */
async function laCarta(id = 'v1'){
  await p.evaluate(i => { document.querySelectorAll('.overlay').forEach(o => o.remove());
                          verConvenio(i); }, id);
  await p.locator('.modal.doc').waitFor({ timeout:10000 });
  return p.evaluate(() => document.querySelector('.overlay .modal.doc').innerText);
}
const cerrar = () => p.evaluate(() =>
  document.querySelectorAll('.overlay').forEach(o => o.remove()));

/* --- 1 ---------------------------------------------------------------------
   GRUPO DE CONTROL, Y VA PRIMERO: el convenio de siempre —de enero a
   diciembre del mismo año— tiene que seguir dando exactamente el folio que
   daba. Si este bloque se pone rojo, el arreglo rompió lo que funcionaba. */
await bloque('1 · de enero a diciembre de 2026 sigue siendo CV-2026', async () => {
  await montar({ vigenciaDesde:'2026-01-15', vigenciaHasta:'2026-12-31' });
  const f = await firmaElHotel();
  afirma('el folio es del 2026 (' + f + ')', /^CV-2026-\d+$/.test(f));
});

/* --- 2 ---------------------------------------------------------------------
   EL CASO DE MARCO. Hoy nace en rojo: da CV-2026-001. */
await bloque('2 · capturado en noviembre de 2026 para 2027 → CV-2027', async () => {
  await montar({ vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31' });
  const f = await firmaElHotel();
  afirma('EL FOLIO ES DEL 2027 (' + f + ')', /^CV-2027-\d+$/.test(f));
  afirma('y arranca en 001, porque el 2027 es otra cuenta', /-001$/.test(f));
});

/* --- 3 ---------------------------------------------------------------------
   El folio y el texto de la carta ya no pueden discrepar: salen del mismo
   renglón. Ver `anioConvenio` y `vars`. */
await bloque('3 · el folio y la carta dicen el mismo año', async () => {
  await p.evaluate(() => {
    /* Un texto de la carta que use el marcador, para poder leerlo. */
    state.ajustes.textos.cierre = 'Tarifas vigentes para el año {{ANIO}}.';
    guardar();
  });
  await montar({ vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31',
                 textos:Object.assign({}, { cierre:'Tarifas vigentes para el año {{ANIO}}.' }) });
  const f = await firmaElHotel();
  const t = await laCarta();
  await cerrar();
  afirma('el folio dice 2027', /CV-2027-/.test(f));
  afirma('LA CARTA TAMBIÉN DICE 2027', /para el año 2027/.test(t));
  afirma('y no dice 2026 en ninguna parte del cierre', !/para el año 2026/.test(t));
});

/* --- 4 ---------------------------------------------------------------------
   El año nuevo arranca en 001 aunque el anterior tenga cien. Las dos cuentas
   —la de este equipo y la del contador del hotel— van por año. */
await bloque('4 · el 2027 arranca en 001 aunque el 2026 tenga cien', async () => {
  await montar({ vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31' });
  await p.evaluate(() => {
    for (let i = 1; i <= 101; i++)
      state.convenios.push(saneaConv({ id:'viejo' + i, clienteId:'c1',
        folio:'CV-2026-' + String(i).padStart(3, '0'), estado:'firmado_cliente',
        fecha:'2026-03-01', vigenciaDesde:'2026-03-01', vigenciaHasta:'2026-12-31' }));
    guardar();
  });
  const f = await firmaElHotel();
  afirma('CV-2027-001 (' + f + ')', f === 'CV-2027-001');
});

/* --- 5 ---------------------------------------------------------------------
   Los respaldos, por si la vigencia viene a medias. */
await bloque('5 · sin «hasta» cae en «desde», y sin ninguno en la fecha', async () => {
  const r = await p.evaluate(() => [
    anioConvenio({ vigenciaHasta:'2027-12-31', vigenciaDesde:'2026-11-01', fecha:'2026-11-01' }),
    anioConvenio({ vigenciaHasta:'', vigenciaDesde:'2028-01-02', fecha:'2026-11-01' }),
    anioConvenio({ vigenciaHasta:'', vigenciaDesde:'', fecha:'2025-06-30' })
  ]);
  afirma('con «hasta» manda el «hasta»', r[0] === '2027');
  afirma('sin «hasta» manda el «desde»', r[1] === '2028');
  afirma('sin vigencia manda la fecha', r[2] === '2025');
});

/* --- 6 ---------------------------------------------------------------------
   El OTRO camino que reparte folio: el convenio que regresó firmado en papel
   y nadie firmó en pantalla. Tiene que tomar el mismo año. */
await bloque('6 · el convenio firmado en papel toma el mismo año', async () => {
  await montar({ vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31' });
  await p.evaluate(() => { subirConvenioFirmado(state.convenios[0]); });
  await p.locator('#fPdfFirmado').waitFor({ timeout:10000 });
  await p.locator('#fPdfFirmado').setInputFiles(PDF);
  await p.locator('#bOkPdf').click();
  await p.waitForFunction(() => !!state.convenios[0].folio, null, { timeout:10000 });
  await cerrar();
  const f = await folio();
  afirma('EL FOLIO ES DEL 2027 (' + f + ')', /^CV-2027-\d+$/.test(f));
});

/* --- 7 ---------------------------------------------------------------------
   Y el tercero: el escaneado que se registra de fuera, sin folio escrito.
   Ahí el año salía de la FECHA del papel para las cuatro series; para un
   convenio tiene que salir de su vigencia, igual que adentro. */
await bloque('7 · el convenio escaneado de fuera también', async () => {
  await montar({ vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31' });
  await p.evaluate(() => { state.convenios = []; guardar(); subirDocumentoExterno('convenio'); });
  await p.locator('#exArchivo').waitFor({ timeout:10000 });
  await p.selectOption('#exTipo', 'convenio');
  await p.selectOption('#exCli', 'c1');
  await p.evaluate(() => {
    document.getElementById('exFolio').value = '';     // sin folio: lo pone el CRM
    document.getElementById('exFecha').value = '2026-11-01';
    document.getElementById('exVig').value   = '2027-12-31';
  });
  await p.locator('#exArchivo').setInputFiles(PDF);
  await p.locator('#bOkEx').click();
  await p.waitForFunction(() => state.convenios.length === 1, null, { timeout:10000 });
  await cerrar();
  const f = await p.evaluate(() => state.convenios[0].folio);
  afirma('EL FOLIO ES DEL 2027 (' + f + ')', /^CV-2027-\d+$/.test(f));
});

/* --- 8 ---------------------------------------------------------------------
   El hueco que la regla no cierra: el hotel firma con la vigencia de este
   año, alguien la mueve al que entra, y el folio se queda —a propósito—. Lo
   que faltaba era que el CRM lo dijera. */
await bloque('8 · cuando ya no cuadra, la carta dice por qué', async () => {
  await montar({ folio:'CV-2026-101', estado:'firmado_ejecutiva',
                 firmaHotel:{ nombre:'Quien Sea', puesto:'Ejecutivo de ventas',
                              fecha:'2026-11-01T10:00:00Z', img:'data:image/png;base64,AA' },
                 vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31' });

  afirma('el folio NO se movió solo', (await folio()) === 'CV-2026-101');
  afirma('y es intocable, por eso', await p.evaluate(() => !!folioIntocable(state.convenios[0])));

  const t = await laCarta();
  afirma('LA CARTA LO DICE', /folio dice 2026 y la vigencia es de 2027/i.test(t));
  afirma('y la administración tiene el botón, en el aviso',
    await p.evaluate(() => !!document.querySelector('#bCvFolioAviso')));
  /* Y UNO SOLO: el del pie se quita cuando el aviso trae el suyo. Dos
     botones iguales en la misma ventana nada más estorban, y ese pie ya
     lleva siete. */
  afirma('y no se repite en el pie',
    await p.evaluate(() => !document.querySelector('#bCvFolio')));
  await cerrar();

  /* Y al que sí cuadra, ni una palabra —pero el botón del pie sigue ahí: el
     papel firmado puede traer otro número por otras razones. */
  await montar({ folio:'CV-2027-001', estado:'firmado_ejecutiva',
                 firmaHotel:{ nombre:'Quien Sea', puesto:'Ejecutivo de ventas',
                              fecha:'2026-11-01T10:00:00Z', img:'data:image/png;base64,AA' },
                 vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31' });
  const t2 = await laCarta();
  afirma('al que cuadra no le dice nada', !/la vigencia es de/i.test(t2));
  afirma('y ahí sí, el botón va en el pie',
    await p.evaluate(() => !!document.querySelector('#bCvFolio')));
  await cerrar();
});

/* --- 9 ---------------------------------------------------------------------
   Corregirle el folio es de la administración, igual que en los contratos. */
await bloque('9 · a quien no es administración se le dice a quién pedirlo', async () => {
  await p.evaluate(() => { window.rolActual = () => 'ejecutivo'; });
  await montar({ folio:'CV-2026-101', estado:'firmado_ejecutiva',
                 firmaHotel:{ nombre:'Quien Sea', puesto:'Ejecutivo de ventas',
                              fecha:'2026-11-01T10:00:00Z', img:'data:image/png;base64,AA' },
                 vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31' });
  const t = await laCarta();
  afirma('el aviso sigue saliendo', /folio dice 2026 y la vigencia es de 2027/i.test(t));
  afirma('pero dice a quién pedirlo', /pídeselo a la administración/i.test(t));
  afirma('y no hay botón en el aviso',
    await p.evaluate(() => !document.querySelector('#bCvFolioAviso')));
  afirma('ni en el pie',
    await p.evaluate(() => !document.querySelector('#bCvFolio')));
  await cerrar();
  await p.reload();
  await p.waitForFunction(() => typeof verConvenio === 'function', null, { timeout:15000 });
  await p.evaluate(() => { ponDepto('ventas'); });
});

/* --- 10 --------------------------------------------------------------------
   Y el arreglo de Marco, de punta a punta: CV-2026-101 → CV-2027-001.

   Sin servidor el contador no contesta, así que `corregirFolio` pregunta si
   se pone de todos modos —y aquí se contesta que sí—. Con servidor el número
   se aparta ANTES de ponerlo. */
await bloque('10 · la administración lo corrige a mano, con rastro', async () => {
  await montar({ folio:'CV-2026-101', estado:'firmado_ejecutiva',
                 firmaHotel:{ nombre:'Quien Sea', puesto:'Ejecutivo de ventas',
                              fecha:'2026-11-01T10:00:00Z', img:'data:image/png;base64,AA' },
                 vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31' });
  await laCarta();
  await p.locator('#bCvFolioAviso').click();
  await p.locator('#cfNuevoFolio').waitFor({ timeout:10000 });

  /* Primero el candado: un folio que ya trae otro convenio no entra. */
  await p.evaluate(() => {
    state.convenios.push(saneaConv({ id:'v2', clienteId:'c1', folio:'CV-2027-009',
      estado:'firmado_cliente', fecha:'2027-01-02',
      vigenciaDesde:'2027-01-02', vigenciaHasta:'2027-12-31' }));
    guardar();
  });
  await p.fill('#cfNuevoFolio', 'CV-2027-009');
  await p.locator('#cfOkFolio').click();
  await p.waitForTimeout(400);
  afirma('no deja repetir el folio de otro',
    await p.evaluate(() => /ya lo trae otro/i.test(
      document.getElementById('cfErrFolio').innerText)));
  afirma('y el convenio sigue con el suyo', (await folio()) === 'CV-2026-101');

  await p.fill('#cfNuevoFolio', 'CV-2027-001');
  await p.locator('#cfOkFolio').click();
  await p.waitForFunction(() => state.convenios[0].folio === 'CV-2027-001',
                          null, { timeout:10000 });
  await cerrar();

  afirma('AHORA DICE CV-2027-001', (await folio()) === 'CV-2027-001');
  afirma('y ya no se renumera solo',
    await p.evaluate(() => state.convenios[0].folioDelContador === true));
  afirma('queda en la bitácora del cliente',
    await p.evaluate(() => state.actividades.some(a =>
      /CV-2026-101/.test(a.asunto || '') && /CV-2027-001/.test(a.asunto || ''))));

  const t = await laCarta();
  await cerrar();
  afirma('y la carta ya no tiene nada que avisar', !/la vigencia es de/i.test(t));
});

await br.close(); srv.close();
try{ fs.unlinkSync(PDF); }catch(e){}
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
