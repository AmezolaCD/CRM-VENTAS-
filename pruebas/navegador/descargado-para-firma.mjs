/* ===========================================================================
   CUANDO EL CONVENIO SALE POR FUERA DEL CRM

   Marco: «si no lo enviaré por WhatsApp y lo quiero descargar y enviar, que a
   la hora de descargarlo en la columna de estado aparezca como descargado
   para firma, y en la columna de enviado aparezca como NA».

   Hasta hoy el CRM sólo sabía de un camino: mandarlo por correo o por
   WhatsApp desde aquí, que es lo que escribe `enviado`. El convenio que se
   descarga y se manda a mano se quedaba para siempre en «Sin enviar», y ésa
   es justo la columna que se mira para saber qué falta. La columna mentía.

   Lo que se cuida aquí:

   · que descargar el PDF lo deje en «Descargado para firma» y «NA»;
   · que IMPRIMIR haga lo mismo —Marco lo pidió, y mucha gente usa
     Imprimir → «Guardar como PDF», que es el mismo caso—;
   · que quede en la bitácora;
   · y sobre todo los grupos de control, que es donde esto se puede volver una
     mentira al revés: un borrador que se baja para revisarlo NO salió a
     ninguna parte, una carta ya firmada que se baja se está archivando, y un
     convenio que sí se mandó por WhatsApp no dice NA.

   Cómo correrla:  node pruebas/navegador/descargado-para-firma.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del arreglo tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8862;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium';

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
await p.waitForFunction(() => typeof verConvenio === 'function', null, { timeout:15000 });

const FIRMA = { nombre:'Quien Sea', puesto:'Ejecutivo de ventas',
                fecha:'2026-11-01T10:00:00Z', img:'data:image/png;base64,AA' };

/** Un convenio en el estado que se le pida. */
const montar = extra => p.evaluate(x => {
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO SA DE CV',
    contacto:'Ana Ruiz', telefono:'664 000 0000', ejecutivo:'Quien Sea', estatus:'nuevo' })];
  state.convenios = [saneaConv(Object.assign({
    id:'v1', clienteId:'c1', ejecutivo:'Quien Sea', folio:'CV-2026-040',
    fecha:'2026-11-01', vigenciaDesde:'2026-11-01', vigenciaHasta:'2027-12-31',
    habitaciones:[{ grupo:'deluxe', tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                    publica:5300, convenio:2700 }]
  }, x))];
  state.actividades = [];
  guardar();
  vista = 'convenios'; render();
  return true;
}, extra);

const lista = () => p.evaluate(() => {
  vista = 'convenios'; render();
  return document.getElementById('tblConvenios').innerText;
});
const marca = () => p.evaluate(() => !!state.convenios[0].descargado);

/** Abre la carta y le pica a un botón. */
async function enLaCarta(boton){
  await p.evaluate(() => { document.querySelectorAll('.overlay').forEach(o => o.remove());
                           verConvenio('v1'); });
  await p.locator(boton).waitFor({ timeout:10000 });
  await p.locator(boton).click();
  await p.waitForTimeout(2500);        // el PDF tarda en armarse
  await p.evaluate(() => document.querySelectorAll('.overlay').forEach(o => o.remove()));
}

/* --- 1 ---------------------------------------------------------------------
   GRUPO DE CONTROL, Y VA PRIMERO: así sale hoy y así tiene que seguir
   saliendo mientras nadie lo descargue. */
await bloque('1 · sin descargar nada, la lista dice lo de siempre', async () => {
  await montar({ estado:'firmado_ejecutiva', firmaHotel:FIRMA });
  const t = await lista();
  afirma('el estado es el de la firma', /Firmado por ejecutivo/i.test(t));
  afirma('y la columna de enviado dice Sin enviar', /Sin enviar/.test(t));
  afirma('no dice NA', !/\bNA\b/.test(t));
  afirma('y el convenio no trae la llave',
    await p.evaluate(() => !('descargado' in state.convenios[0])));
});

/* --- 2 ---------------------------------------------------------------------
   EL CASO DE MARCO. */
await bloque('2 · al descargar el PDF queda «Descargado para firma» y «NA»', async () => {
  await montar({ estado:'firmado_ejecutiva', firmaHotel:FIRMA });
  await enLaCarta('#bPdfC');

  afirma('quedó marcado', await marca() === true);
  const t = await lista();
  afirma('EL ESTADO DICE DESCARGADO PARA FIRMA', /Descargado para firma/i.test(t));
  afirma('Y LA COLUMNA DE ENVIADO DICE NA', /\bNA\b/.test(t));
  afirma('ya no dice «Sin enviar»', !/Sin enviar/.test(t));

  const bit = await p.evaluate(() => state.actividades.map(a => a.asunto + ' | ' + a.notas));
  afirma('queda escrito en la bitácora',
    bit.some(x => /descargado para firma/i.test(x) && /CV-2026-040/.test(x)));
});

/* --- 3 ---------------------------------------------------------------------
   Imprimir cuenta igual: es lo que pidió. */
await bloque('3 · imprimir hace lo mismo', async () => {
  await montar({ estado:'firmado_ejecutiva', firmaHotel:FIRMA });
  await enLaCarta('#bPrint');
  afirma('IMPRIMIR TAMBIÉN LO MARCA', await marca() === true);
  const t = await lista();
  afirma('con su estado', /Descargado para firma/i.test(t));
  afirma('y su NA', /\bNA\b/.test(t));
});

/* --- 4 ---------------------------------------------------------------------
   GRUPO DE CONTROL. Un borrador que se baja para revisarlo no salió a ningún
   lado, y marcarlo sería mentir en el otro sentido. */
await bloque('4 · bajar un borrador no marca nada', async () => {
  await montar({ estado:'borrador' });
  await enLaCarta('#bPdfC');
  afirma('NO SE MARCÓ', await marca() === false);
  const t = await lista();
  afirma('sigue diciendo Borrador', /Borrador/.test(t));
  afirma('y Sin enviar', /Sin enviar/.test(t));
});

/* --- 5 ---------------------------------------------------------------------
   GRUPO DE CONTROL. Bajar una carta ya cerrada es archivarla. */
await bloque('5 · bajar una ya firmada por el cliente no marca nada', async () => {
  await montar({ estado:'firmado_cliente', firmaHotel:FIRMA,
                 firmaEmpresa:{ nombre:'Ana Ruiz', fecha:'2026-11-02T10:00:00Z',
                                img:'data:image/png;base64,AA' } });
  await enLaCarta('#bPdfC');
  afirma('NO SE MARCÓ', await marca() === false);
  afirma('el estado sigue siendo el de la firma del cliente',
    /Firmado por cliente/i.test(await lista()));
});

/* --- 6 ---------------------------------------------------------------------
   GRUPO DE CONTROL. Un envío de verdad es un hecho más fuerte que una
   descarga, y no se pisa. */
await bloque('6 · si ya se mandó por WhatsApp, no dice NA', async () => {
  await montar({ estado:'firmado_ejecutiva', firmaHotel:FIRMA,
                 enviado:{ fecha:'2026-11-01T12:00:00Z', via:'whatsapp', quien:'Quien Sea' } });
  await enLaCarta('#bPdfC');
  afirma('no se marcó como descargado', await marca() === false);
  const t = await lista();
  afirma('LA COLUMNA SIGUE DICIENDO QUE SE MANDÓ', /WhatsApp/i.test(t));
  afirma('y no dice NA', !/\bNA\b/.test(t));
});

/* --- 7 ---------------------------------------------------------------------
   Al reabrirlo para corregirlo, de ESTA versión el cliente no tiene nada. */
await bloque('7 · reabrir para corregir borra la marca', async () => {
  await montar({ estado:'firmado_ejecutiva', firmaHotel:FIRMA });
  await enLaCarta('#bPdfC');
  afirma('estaba marcado', await marca() === true);

  await p.evaluate(() => { reabrirParaCorregir(state.convenios[0], 'convenios', 'Quien Sea');
                           guardar(); });
  afirma('YA NO LO ESTÁ', await marca() === false);
  const t = await lista();
  afirma('y vuelve a decir Sin enviar', /Sin enviar/.test(t));
  afirma('en estado Borrador', /Borrador/.test(t));
});

/* --- 8 ---------------------------------------------------------------------
   El folio ya anda impreso en un PDF que tiene el cliente. */
await bloque('8 · con la marca puesta, el folio ya no se renumera solo', async () => {
  const r = await p.evaluate(() => {
    const v = saneaConv({ id:'vx', clienteId:'c1', folio:'CV-2026-041', estado:'borrador',
      descargado:{ fecha:'2026-11-02T10:00:00Z', quien:'quien@ejemplo.example' } });
    /* `!!` porque la función devuelve el VALOR que la hizo verdadera —aquí
       el objeto de la descarga—, no un booleano. */
    return !!folioIntocable(v);
  });
  afirma('FOLIO INTOCABLE', r === true);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
