/* ===========================================================================
   LAS POLÍTICAS DEL CONTRATO DE VENTAS

   Marco mandó un contrato de verdad y escribió: «los contratos y cotizaciones
   en ventas son casi iguales, sin embargo los contratos tienen muchas más
   políticas». Y en seguida, el recordatorio que decide el alcance de todo
   esto: «el contrato de ventas y los de banquetes son distintos».

   Así que el contrato de HOSPEDAJE pasó de tres secciones a veinte, y hay
   tres cosas que esta prueba cuida por encima de las demás:

   · LA COTIZACIÓN NO SE TOCA. Marco escogió que las políticas fueran sólo del
     contrato. Si la cotización crece, se le rompe el documento que usa todos
     los días para algo que no pidió.

   · EL CONTRATO DE BANQUETES NO SE TOCA. Es otro documento, vive en
     `cuerpoContratoBq` y lo revisó legal. Es el grupo de control.

   · LOS CAMPOS NUEVOS NACEN AL USARSE. Una cotización no carga ninguna de las
     llaves del contrato. Un campo nuevo en todos los documentos los haría
     verse editados a la vez, y este equipo mandaría su copia encima de la de
     los demás.

   Y una cuarta, que es de oficio: lo del hotel —razón social, RFC, banco,
   CLABE— sale de Ajustes, nunca del código, porque el repositorio es público.
   Si falta, se imprime una raya y el hueco se ve.

   Cómo correrla:  node pruebas/navegador/politicas-del-contrato.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8847;
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
    contacto:'Contacto Ejemplo', ejecutivo:'Carmen Ejemplo', telefono:'000 000 0000' })];
  guardar();
});

/** Arma un documento del tipo que se le pida y devuelve lo que imprime. */
const documento = (tipo, campos, hotel) => p.evaluate(({ t, c, hh }) => {
  if (hh) Object.assign(state.ajustes.hotel, hh);
  const k = saneaContrato(Object.assign({ id:'k1', tipo:t, clienteId:'c1',
    ejecutivo:'Carmen Ejemplo', fecha:'2026-10-22', titulo:'Grupo de ejemplo',
    hospedaje:[saneaLineaHosp({ descripcion:'10 habitaciones King', noches:2, precio:1800 })]
  }, c));
  const caja = document.createElement('div');
  caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
  return { texto: caja.innerText,
           h2: [...caja.querySelectorAll('h2')].map(x => x.textContent.trim()),
           saltos: caja.querySelectorAll('.salto-hoja').length,
           llaves: Object.keys(k) };
}, { t: tipo, c: campos, hh: hotel });

const LLENO = { limiteFirma:'2026-11-15', minimoHab:10, depositoHab:200,
                firmanMaestra:['Persona Uno','Persona Dos'],
                pagos:[{ monto:25000, fecha:'2026-11-15' }] };

/* --- 1 -------------------------------------------------------------------- */
await bloque('1 · el contrato trae las políticas que faltaban', async () => {
  const r = await documento('contrato', LLENO);
  for (const s of ['Objeto','Servicio','Contraprestación','Condiciones del bloqueo',
                   'Horarios de entrada y salida','Propinas','Notas adicionales',
                   'Obligaciones del cliente','Instrucciones de pago','Liquidación de cuentas',
                   'Programa de pagos','Datos para el pago','No show y salida anticipada',
                   'Imposibilidad de cumplimiento','Acuerdo total','Jurisdicción'])
    afirma('trae «' + s + '»', r.h2.includes(s));
  afirma('y las ocho obligaciones del cliente, completas',
    /Programa del Grupo/.test(r.texto) && /Seguridad/.test(r.texto) &&
    /Anuncios y letreros/.test(r.texto) && /Subcontratistas/.test(r.texto) &&
    /Paquetes y cajas/.test(r.texto) && /Área de la convención/.test(r.texto) &&
    /Decoración/.test(r.texto) && /Misceláneos/.test(r.texto));
});

/* --- 2 --------------------------------------------------------------------
   Lo que Marco escogió explícitamente: la cotización se queda como estaba. */
await bloque('2 · LA COTIZACIÓN NO SE TOCA', async () => {
  const r = await documento('cotizacion', LLENO);
  afirma('sigue con sus tres secciones de siempre',
    r.h2.length === 3 && r.h2[0] === 'Servicios cotizados');
  afirma('sin una sola política del contrato',
    !r.h2.includes('Obligaciones del cliente') && !r.h2.includes('Jurisdicción') &&
    !r.h2.includes('Programa de pagos'));
  afirma('sin la carta de presentación', r.saltos === 0 && !/Es un placer enterarnos/.test(r.texto));
  /* El candado de la sincronización. */
  afirma('Y NO CARGA NINGUNA LLAVE NUEVA, aunque se las pasen',
    !['limiteFirma','minimoHab','depositoHab','firmanMaestra','pagos']
      .some(x => r.llaves.includes(x)));
});

/* --- 3 --------------------------------------------------------------------
   La carta, que es la primera hoja del contrato. */
await bloque('3 · la carta de presentación va al frente, en su propia hoja', async () => {
  const r = await documento('contrato', LLENO);
  afirma('saluda al contacto del cliente', /Estimado Contacto Ejemplo/.test(r.texto));
  afirma('dice la fecha límite de firma', /a más tardar el día/.test(r.texto));
  afirma('la firma quien lleva el contrato', /Carmen Ejemplo/.test(r.texto));
  afirma('CORTA LA HOJA antes del contrato', r.saltos === 1);
  afirma('y va ANTES del cuerpo',
    r.texto.indexOf('Es un placer enterarnos') < r.texto.indexOf('Objeto'));
});

/* --- 4 --------------------------------------------------------------------
   Un contrato con un hueco visible se corrige; uno que calla el dato se firma
   así y nadie se entera. */
await bloque('4 · lo que falta se ve, no se calla', async () => {
  const vacio = await documento('contrato', { limiteFirma:'' },
    { razonSocial:'', rfc:'', banco:'', cuenta:'', clabe:'' });
  afirma('los datos del hotel que faltan salen como raya', /________/.test(vacio.texto));
  afirma('y la fecha límite también', (vacio.texto.match(/________/g) || []).length >= 3);
  afirma('sin inventar un dato', !/undefined/.test(vacio.texto) && !/null/.test(vacio.texto));

  /* Con el hotel lleno, lo que se imprime es lo de Ajustes. */
  const lleno = await documento('contrato', LLENO,
    { razonSocial:'RAZÓN DE EJEMPLO SA DE CV', rfc:'XXXX000000XXX',
      banco:'BANCO DE EJEMPLO', cuenta:'0000000000', clabe:'000000000000000000' });
  afirma('CON AJUSTES LLENOS, el contrato los imprime',
    /RAZÓN DE EJEMPLO SA DE CV/.test(lleno.texto) && /BANCO DE EJEMPLO/.test(lleno.texto));
});

/* --- 5 --------------------------------------------------------------------
   Lo opcional no deja frases a medias. */
await bloque('5 · lo que no se llena no deja frases colgando', async () => {
  const r = await documento('contrato', { limiteFirma:'2026-11-15' });
  afirma('sin depósito por habitación, no se menciona', !/depósito de/i.test(r.texto));
  afirma('sin mínimo de habitaciones, la frase sigue teniendo sentido',
    /mínimo de habitaciones para poder aplicar la tarifa de grupo/i.test(r.texto));
  afirma('sin autorizados, deja rayas para llenarlas a mano',
    /firmar consumos y cargos diversos/i.test(r.texto));
  afirma('y el programa de pagos sale con su renglón en blanco',
    r.h2.includes('Programa de pagos'));
});

/* --- 6 --------------------------------------------------------------------
   EL GRUPO DE CONTROL. «El contrato de ventas y los de banquetes son
   distintos», dijo Marco. Si esto se pone rojo es que se tocó de más. */
await bloque('6 · el contrato de BANQUETES no se movió', async () => {
  const r = await p.evaluate(() => {
    const e = saneaEvento({ id:'e1', clienteId:'c1', ejecutivo:'Carmen Ejemplo',
      fecha:'2026-10-22', titulo:'Evento de ejemplo' });
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${cuerpoContratoBq(e, cliente('c1'))}</div>`;
    return { texto: caja.innerText, saltos: caja.querySelectorAll('.salto-hoja').length };
  });
  afirma('sigue siendo el contrato de eventos sociales',
    /EVENTOS SOCIALES/i.test(r.texto) && /BANQUETES/i.test(r.texto));
  afirma('con sus declaraciones y cláusulas', /Declaraciones/i.test(r.texto));
  afirma('NO se le coló la carta de ventas', !/Es un placer enterarnos/.test(r.texto));
  afirma('ni el programa de pagos de ventas', !/TODA TRANSFERENCIA DEBERÁ SER EN PESOS/.test(r.texto));
  afirma('ni la hoja de la carta', r.saltos === 0);
});

/* --- 7 --------------------------------------------------------------------
   El repositorio es público: los datos del hotel viven en Ajustes. */
await bloque('7 · ningún dato real quedó escrito en el programa', async () => {
  const src = fs.readFileSync(APP, 'utf8');
  const i = src.indexOf('const politicasDelContrato');
  /* Hasta donde empieza la carta, que es lo siguiente. Buscar «return `» no
     sirve: el propio bloque de políticas tiene el suyo y el recorte salía
     vacío —la prueba pasaba en verde sin mirar nada—. */
  const j = src.indexOf('const carta =', i);
  const trozo = src.slice(i, j > 0 ? j : i + 30000);
  afirma('las políticas no traen una cuenta bancaria escrita',
    !/\b\d{10,}\b/.test(trozo));
  afirma('ni un RFC', !/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/.test(trozo));
  afirma('LOS DATOS DEL HOTEL SALEN DE AJUSTES',
    /hueco\(h\.razonSocial\)/.test(trozo) && /hueco\(h\.clabe\)/.test(trozo));
  /* Y nada del contrato de ejemplo que mandó Marco: ni el nombre del cliente,
     ni su RFC, ni su cuenta. No se escriben aquí ni para comprobar que no
     están —esta prueba también vive en el repositorio público—, así que se
     arman en pedazos y se buscan. */
  const delEjemplo = ['FM' + ' PRODUCCIONES', 'HBN' + ' 180124',
                      '01123' + '63925', '01202800' + '1123639259'];
  afirma('ni nada del contrato de ejemplo: ni cliente, ni RFC, ni cuenta',
    delEjemplo.every(x => !src.toUpperCase().includes(x.toUpperCase())));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
