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
  /* SE CUELGA DEL DOCUMENTO a propósito. `innerText` de un nodo suelto no
     renderiza: devuelve el texto crudo, con los espacios y los saltos del
     código adentro. Así, una prueba que midiera la sangría diría que está mal
     cuando en pantalla se ve bien —y al revés—. Colgado fuera de la vista, lo
     que se mide es lo que el cliente va a leer. */
  const caja = document.createElement('div');
  caja.className = 'doc-body';
  caja.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px';
  caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
  document.body.appendChild(caja);
  const texto = caja.innerText;
  const h2 = [...caja.querySelectorAll('h2')].map(x => x.textContent.trim());
  const saltos = caja.querySelectorAll('.salto-hoja').length;
  caja.remove();
  return { texto,
           h2, saltos, llaves: Object.keys(k) };
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
  /* Los encabezados se imprimen en mayúsculas por estilo, así que el texto
     RENDERIZADO dice «OBJETO». Buscarlo tal como se escribe en el código no
     lo encuentra, y la prueba diría que la carta no está antes. */
  const arriba = r.texto.toUpperCase();
  afirma('y va ANTES del cuerpo',
    arriba.indexOf('ES UN PLACER ENTERARNOS') < arriba.indexOf('OBJETO'));
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

/* --- 8 --------------------------------------------------------------------
   Marco, señalando la tabla de instrucciones de pago: «en esta parte no se
   puede seleccionar ninguna opción». Las casillas estaban hechas para
   palomearse a mano sobre el papel; ahora se escogen donde se sabe qué se
   acordó, que es el editor. */
await bloque('8 · a qué cuenta se carga cada concepto, se escoge', async () => {
  const r = await documento('contrato', Object.assign({}, LLENO, {
    cargos: { habitacion:'maestra', telefono:'individual' } }));
  const fila = n => (r.texto.split('\n').find(l => l.startsWith(n)) || '');
  afirma('lo escogido se marca en su columna', /✗/.test(r.texto));
  afirma('la habitación va a la maestra',
    /Habitación e impuestos\s*✗\s*☐/.test(r.texto.replace(/\t/g, ' ')));
  afirma('y el teléfono a la individual',
    /Cargos de teléfono\s*☐\s*✗/.test(r.texto.replace(/\t/g, ' ')));
  afirma('LO QUE NADIE ESCOGIÓ SE QUEDA EN BLANCO, para palomear a mano',
    /Lavandería\s*☐\s*☐/.test(r.texto.replace(/\t/g, ' ')));
});

/* --- 9 -------------------------------------------------------------------- */
await bloque('9 · y es un campo que nace al usarse, como los demás', async () => {
  const sin = await documento('contrato', { limiteFirma:'2026-11-15' });
  afirma('un contrato que no lo usa no carga la llave', !sin.llaves.includes('cargos'));
  afirma('y su tabla sale con las catorce casillas vacías',
    (sin.texto.match(/☐/g) || []).length === 14 && !/✗/.test(sin.texto));

  const basura = await documento('contrato', { cargos:{ habitacion:'otra_cosa', noExiste:'maestra' } });
  afirma('un valor que no es maestra ni individual se tira',
    !basura.llaves.includes('cargos') && !/✗/.test(basura.texto));

  const cot = await documento('cotizacion', { cargos:{ habitacion:'maestra' } });
  afirma('Y LA COTIZACIÓN NO LO CARGA NUNCA', !cot.llaves.includes('cargos'));
});

/* --- 10 -------------------------------------------------------------------
   Lo que se vio en la pantalla de Marco antes de arreglarlo: `.pol` lleva
   `pre-wrap` —para los textos que alguien escribe en Ajustes, que traen
   saltos de verdad— y en los párrafos que arma el programa eso imprimía LA
   SANGRÍA DEL CÓDIGO: renglones partidos a media frase, en el contrato. */
await bloque('10 · el texto no se parte donde se partió el código', async () => {
  const r = await documento('contrato', LLENO);
  const conSangria = r.texto.split('\n')
    .filter(l => /^ {4,}\S/.test(l) && l.length > 20 && !/^\s*\d+\./.test(l));
  afirma('ningún párrafo sale con la sangría del programa',
    conSangria.length === 0, conSangria.slice(0, 2).join(' | '));

  const src = fs.readFileSync(APP, 'utf8');
  const i = src.indexOf('const politicasDelContrato');
  const j = src.indexOf('const carta =', i);
  afirma('las políticas usan la clase que NO respeta los saltos del código',
    !/class="pol"/.test(src.slice(i, j)) && /class="pol-html"/.test(src.slice(i, j)));
  afirma('y esa clase existe en el estilo, justificada',
    /\.doc-body \.pol-html\{[^}]*white-space:normal/.test(src) &&
    /\.doc-body \.pol-html\{[^}]*text-align:justify/.test(src));
  afirma('TODO EL TEXTO JUSTIFICADO, como lo pidió Marco',
    /\.doc-body p, \.doc-body li\{text-align:justify\}/.test(src));
});

/* --- 11 -------------------------------------------------------------------
   Marco: «también quita esta parte de eventos». Los salones son de banquetes.
   Lo delicado no es quitarla de la pantalla: es que al quitarla, el guardado
   recogía una tabla que ya no existe, devolvía una lista vacía y le BORRABA
   los salones al contrato viejo que los tenga, en el primer guardado y sin
   avisar. */
await bloque('11 · salones y eventos salió del editor, sin borrar lo que ya había', async () => {
  const r = await p.evaluate(async () => {
    const k = saneaContrato({ id:'k9', tipo:'contrato', clienteId:'c1', ejecutivo:'Carmen Ejemplo',
      fecha:'2026-10-27',
      eventos:[saneaLineaEvento({ fecha:'23 oct', evento:'Conferencia', salon:'Salón de ejemplo' })],
      hospedaje:[saneaLineaHosp({ descripcion:'10 King', noches:2, precio:1800 })] });
    state.contratos = [k]; guardar();
    editarContrato('k9');
    const hayTabla = !!document.querySelector('#tEv');
    const hayBoton = !!document.querySelector('#bAddEv');
    document.querySelector('.modal [data-close]')?.click();
    return { hayTabla, hayBoton, eventos: (state.contratos[0].eventos || []).length };
  });
  afirma('la tabla ya no está en el editor', !r.hayTabla);
  afirma('ni el botón de agregar evento', !r.hayBoton);
  afirma('Y EL CONTRATO VIEJO NO PERDIÓ SUS SALONES', r.eventos === 1);

  /* El documento sigue sabiendo imprimirlos: a ese cliente ya se le
     enseñaron, y hacerlos desaparecer de la hoja sería peor. */
  const doc = await documento('contrato', {
    eventos:[{ fecha:'23 oct', evento:'Conferencia', salon:'Salón de ejemplo' }] });
  afirma('y el documento los sigue imprimiendo si los trae',
    /Conferencia/.test(doc.texto));
});

/* --- 12 -------------------------------------------------------------------
   EL HOTEL SE NOMBRA, Y LAS TRES PRIMERAS CLÁUSULAS VAN ARRIBA.

   Marco, con un contrato de verdad delante: las tres cláusulas que dicen
   QUIÉN se obliga y A QUÉ empezaban con una raya —«____________ proporcionará
   al Cliente servicios de hospedaje…»— porque la razón social nunca se había
   capturado. Y se leían hasta el final, detrás de los precios. Pidió las dos
   cosas: el nombre por omisión, y el apartado antes del contrato de
   servicios. */
await bloque('12 · el hotel se nombra, y objeto/servicio/contraprestación van arriba', async () => {
  /* 12.1 · La trampa de siempre: lo guardado le gana a lo de fábrica, y el
     hotel tiene guardada una razón social VACÍA. Sin reponerla, el cambio no
     le llega a nadie y el contrato sigue saliendo con la raya. */
  const mig = await p.evaluate(() => {
    const comoEstaHoy = JSON.parse(JSON.stringify(state));
    comoEstaHoy.ajustes.hotel.razonSocial = '';
    const suyo = JSON.parse(JSON.stringify(state));
    suyo.ajustes.hotel.razonSocial = 'LA MÍA, S.A. DE C.V.';
    return {
      fabrica:  HOTEL_DEF.razonSocial,
      repuesta: sanear(comoEstaHoy).ajustes.hotel.razonSocial,
      suya:     sanear(suyo).ajustes.hotel.razonSocial,
      otros: ['representante','rfc','escritura','domicilioFiscal',
              'banco','cuenta','clabe','registroProfeco'].map(k => String(HOTEL_DEF[k] || '')),
    };
  });
  afirma('UNA RAZÓN SOCIAL VACÍA SE REPONE CON LA DE FÁBRICA',
    !!mig.fabrica.trim() && mig.repuesta === mig.fabrica);
  afirma('y a quien capturó la suya NO se le pisa', mig.suya === 'LA MÍA, S.A. DE C.V.');

  /* 12.2 · EL GRUPO DE CONTROL del archivo público. El nombre de la empresa
     es lo único fiscal que se escribió; lo que sirve para cobrarle a alguien
     en nombre del hotel se queda fuera, y si mañana se cuela, esto se pone
     rojo. */
  afirma('Y NINGÚN OTRO DATO FISCAL NI BANCARIO ENTRÓ AL PROGRAMA',
    mig.otros.every(v => v.trim() === ''));

  /* 12.3 · El orden. Los encabezados salen en orden de documento, así que la
     lista de `h2` es el índice de la hoja. */
  const r = await documento('contrato', LLENO,
    { razonSocial: mig.fabrica, rfc:'', banco:'', cuenta:'', clabe:'' });
  const pos = t => r.h2.indexOf(t);
  afirma('OBJETO, SERVICIO Y CONTRAPRESTACIÓN VAN ANTES DE LOS SERVICIOS COTIZADOS',
    pos('Objeto') >= 0 && pos('Objeto') < pos('Servicios cotizados') &&
    pos('Servicio') < pos('Servicios cotizados') &&
    pos('Contraprestación') < pos('Servicios cotizados'));
  afirma('y antes de la propuesta económica',
    pos('Contraprestación') < pos('Propuesta económica · hospedaje'));
  afirma('en su orden: objeto, servicio y contraprestación',
    pos('Objeto') < pos('Servicio') && pos('Servicio') < pos('Contraprestación'));
  /* Y las otras catorce siguen abajo: hablan de montos y fechas que el
     cliente todavía no ha visto cuando llega al objeto. */
  afirma('LAS DEMÁS CLÁUSULAS SIGUEN DESPUÉS DE LOS PRECIOS',
    pos('Condiciones del bloqueo') > pos('Costos adicionales no incluidos') &&
    pos('Jurisdicción') > pos('Costos adicionales no incluidos'));
  afirma('y ninguna se duplicó al moverlas',
    ['Objeto','Servicio','Contraprestación','Condiciones del bloqueo','Jurisdicción']
      .every(t => r.h2.filter(x => x === t).length === 1));

  /* 12.4 · Las tres nombran al hotel, no a una raya. */
  const U = r.texto.toUpperCase();
  /* El corte de abajo va desde «OBJETO»: el saludo ya dice «anexo detallado de
     los servicios cotizados…» más arriba, así que buscar ese texto desde el
     principio daba un recorte vacío —y la prueba habría pasado sin mirar
     nada—. El que interesa es el ENCABEZADO, que viene después. */
  const iObjeto = U.indexOf('OBJETO');
  const arriba = r.texto.slice(iObjeto, U.indexOf('SERVICIOS COTIZADOS', iObjeto));
  afirma('LAS TRES NOMBRAN AL HOTEL, una por cláusula',
    (arriba.match(new RegExp(mig.fabrica, 'g')) || []).length === 3);
  afirma('y ya no empiezan con una raya', !/________/.test(arriba));

  /* 12.5 · Pero sólo se llenó el nombre: lo demás se sigue viendo pendiente,
     que es lo que hace que alguien lo capture antes de mandar el contrato. */
  const abajo = r.texto.slice(U.indexOf('DATOS PARA EL PAGO'));
  afirma('en los datos del pago sale el nombre', abajo.includes(mig.fabrica));
  afirma('PERO EL RFC, LA CUENTA Y LA CLABE SIGUEN COMO RAYA',
    (abajo.match(/________/g) || []).length >= 3);

  /* 12.6 · Y la cotización no se movió: no lleva clausulado. */
  const cot = await documento('cotizacion', LLENO, { razonSocial: mig.fabrica });
  afirma('LA COTIZACIÓN NO LLEVA NINGUNO DE LOS TRES',
    !cot.h2.includes('Objeto') && !cot.h2.includes('Servicio') &&
    !cot.h2.includes('Contraprestación'));
});

/* --- 13 -------------------------------------------------------------------
   DÓNDE SE CAPTURAN LOS DATOS DEL PAGO.

   Marco, viendo «DATOS PARA EL PAGO» con cuatro rayas: «agrega los datos
   bancarios del documento original porfavor». No van al programa: este
   archivo es público, y una cuenta y una CLABE ahí quedan en internet y en el
   historial de Git, donde borrarlas después ya no las quita. Van en Ajustes,
   que se guarda en la nube privada del hotel.

   Y entonces lo que había que arreglar no era el dato: era el letrero. La
   sección se llamaba «Datos legales del contrato DE BANQUETES», así que quien
   la leía concluía, con razón, que no era lo suyo —y el contrato de ventas
   seguía saliendo con rayas—. */
await bloque('13 · los datos del pago se capturan en Ajustes, no en el programa', async () => {
  const pantalla = await p.evaluate(() => {
    state.usuarios = [saneaUsuario({ id:'u9', nombre:'Sistemas',
      correo:'admin9@ejemplo.example', rol:'admin' })];
    guardar();
    vista = 'ajustes'; render();
    const sec = [...document.querySelectorAll('h3.sec')]
      .find(x => /Datos legales/i.test(x.textContent));
    const aviso = sec ? sec.nextElementSibling.innerText : '';
    return {
      titulo: sec ? sec.textContent.trim() : '(no está la sección)',
      aviso,
      campos: ['banco','cuenta','clabe','rfc']
        .filter(k => document.querySelector(`[data-legal="${k}"]`)),
    };
  });
  afirma('la sección ya no se llama sólo «de banquetes»',
    pantalla.titulo === 'Datos legales de los contratos');
  afirma('EL AVISO DICE QUE SON DE LOS DOS CONTRATOS',
    /los dos contratos/i.test(pantalla.aviso) && /ventas/i.test(pantalla.aviso));
  afirma('y nombra el apartado donde salen en el de ventas',
    /Datos para el pago/i.test(pantalla.aviso));
  afirma('y sigue explicando por qué no vienen puestos',
    /p[úu]blico/i.test(pantalla.aviso));
  afirma('están los cuatro campos que hacen falta', pantalla.campos.length === 4);

  /* El camino completo: lo que se teclea ahí sale impreso en el contrato. */
  const impreso = await p.evaluate(() => {
    const puesto = { banco:'BANCO DE EJEMPLO', cuenta:'0000000000',
                     clabe:'000000000000000000', rfc:'XAXX010101000' };
    for (const [k, v] of Object.entries(puesto)) {
      const i = document.querySelector(`[data-legal="${k}"]`);
      i.value = v; i.dispatchEvent(new Event('input', { bubbles:true }));
    }
    document.querySelector('#bGuardarAj').click();

    const k = saneaContrato({ id:'k13', tipo:'contrato', clienteId:'c1',
      ejecutivo:'Carmen Ejemplo', fecha:'2026-10-28', titulo:'Grupo de ejemplo',
      hospedaje:[saneaLineaHosp({ descripcion:'10 habitaciones King', noches:2, precio:1800 })] });
    const caja = document.createElement('div');
    caja.className = 'doc-body';
    caja.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px';
    caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
    document.body.appendChild(caja);
    const t = caja.innerText; caja.remove();
    return { texto: t, guardado: Object.assign({}, state.ajustes.hotel) };
  });
  afirma('se guardaron en los ajustes del hotel',
    impreso.guardado.banco === 'BANCO DE EJEMPLO' &&
    impreso.guardado.clabe === '000000000000000000');
  afirma('Y EL CONTRATO LOS IMPRIME EN LUGAR DE LAS RAYAS',
    /BANCO DE EJEMPLO/.test(impreso.texto) &&
    /000000000000000000/.test(impreso.texto) &&
    /XAXX010101000/.test(impreso.texto));

  /* EL GRUPO DE CONTROL, y es el que de verdad importa: que nada de esto haya
     entrado al archivo. Si un día alguien pega la cuenta del hotel «para
     probar», esto se pone rojo antes de que salga publicado. */
  const def = await p.evaluate(() => Object.assign({}, HOTEL_DEF));
  afirma('NINGÚN DATO BANCARIO NI FISCAL VIENE PUESTO EN EL PROGRAMA',
    ['banco','cuenta','clabe','rfc','escritura','domicilioFiscal','registroProfeco']
      .every(k => String(def[k] || '').trim() === ''));
  const src = fs.readFileSync(APP, 'utf8');
  afirma('y el archivo no trae ninguna cadena con forma de CLABE',
    !/\b\d{18}\b/.test(src));
});

/* --- 14 -------------------------------------------------------------------
   EL DINERO SE TECLEA COMO SE ESCRIBE.

   Marco, con un contrato de verdad delante: «le puse la cantidad que tendrían
   que pagar y no me sale». En PROGRAMA DE PAGOS la fecha salió y el importe
   salió como una raya.

   El editor leía ese campo con `Number()`. `Number("$25,000.00")` es NaN, y el
   `|| 0` lo volvía CERO; el documento imprime una raya cuando el importe es
   cero, así que lo tecleado se perdía EN SILENCIO: ni aviso, ni campo en rojo.
   `parseMoney` ya existía en el archivo y las líneas de hospedaje lo usaban;
   el programa de pagos nunca se enteró, ni sus tres campos hermanos.

   Esta prueba MANEJA EL EDITOR, no arma el contrato a mano: el error estaba
   justo en el camino que una prueba de las de armar objetos no toca. */
await bloque('14 · un importe con formato llega entero al documento', async () => {
  /** Abre el editor en blanco, llena lo mínimo y lo que se le pida, y guarda. */
  const porElEditor = async (campos) => {
    await p.evaluate(() => {
      document.querySelectorAll('.overlay').forEach(o => o.remove());
      state.contratos = []; guardar();
      editarContrato(null, 'c1');
      document.querySelector('#ctTipo').value = 'contrato';
      document.querySelector('#ctTipo').dispatchEvent(new Event('change'));
    });
    await p.locator('#ctLimite').waitFor({ timeout:8000 });
    /* El porcentaje vive escondido hasta que se prende la casilla —un campo de
       comisión a la vista en un contrato que no la lleva invita a llenarlo—,
       así que primero se le pica a la pastilla. */
    if ('#ctComPct' in campos) await p.locator('label:has(#ctComOn)').click();
    for (const [sel, valor] of Object.entries(campos)) await p.fill(sel, valor);
    // Lo que el formulario exige para dejar guardar.
    await p.fill('#tHosp tbody tr:first-child .h-desc', '10 habitaciones King');
    await p.fill('#tHosp tbody tr:first-child .h-noches', '2');
    await p.fill('#tHosp tbody tr:first-child .h-precio', '1800');
    await p.locator('#bOkCt').click();
    await p.waitForTimeout(400);
    return await p.evaluate(() => {
      const k = state.contratos[0];
      if (!k) return { guardado:null, texto:'(no se guardó el contrato)' };
      const caja = document.createElement('div');
      caja.className = 'doc-body';
      caja.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px';
      caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
      document.body.appendChild(caja);
      const texto = caja.innerText; caja.remove();
      return { guardado: JSON.parse(JSON.stringify(k)), texto };
    });
  };

  /* 14.1 · El caso exacto de Marco. */
  const r = await porElEditor({
    '#ctLimite':'2026-11-15',
    '.pg-monto':'$25,000.00',
    '.pg-fecha':'2026-11-15',
  });
  afirma('EL IMPORTE CON $ Y COMAS SE GUARDA, no se vuelve cero',
    r.guardado && Array.isArray(r.guardado.pagos) && r.guardado.pagos[0].monto === 25000);
  afirma('y el documento lo imprime en lugar de la raya',
    /25,000/.test(r.texto) && !/Importe[\s\S]{0,40}_____/.test(r.texto));

  /* 14.2 · El formato no cambia el trato. */
  const coma = await porElEditor({ '#ctLimite':'2026-11-15', '.pg-monto':'25,000', '.pg-fecha':'2026-11-15' });
  const liso = await porElEditor({ '#ctLimite':'2026-11-15', '.pg-monto':'25000',  '.pg-fecha':'2026-11-15' });
  afirma('«25,000» y «25000» valen lo mismo',
    coma.guardado.pagos[0].monto === 25000 && liso.guardado.pagos[0].monto === 25000);

  /* 14.3 · Los tres hermanos, recogidos a dos renglones de distancia. */
  const otros = await porElEditor({
    '#ctLimite':'2026-11-15',
    '#ctDepHab':'$1,200',
    '#ctMinHab':'1,000',
    '#ctComPct':'10%',
  });
  afirma('EL DEPÓSITO POR HABITACIÓN con $ y coma también', otros.guardado.depositoHab === 1200);
  afirma('y el mínimo de habitaciones queda entero', otros.guardado.minimoHab === 1000);
  afirma('Y «10%» EN LA COMISIÓN VALE 10, no cero', otros.guardado.comision === 10);

  /* 14.4 · Los grupos de control. Un renglón vacío NO se vuelve un cero
     impreso: sigue siendo la raya que alguien tiene que llenar a mano. */
  const vacio = await porElEditor({ '#ctLimite':'2026-11-15' });
  afirma('SIN IMPORTE SIGUE SALIENDO LA RAYA, no un $0.00',
    !/\$0\.00/.test(vacio.texto) && /_____/.test(vacio.texto));
  afirma('y no se guarda un pago inventado', !vacio.guardado.pagos);
  afirma('ni una comisión de cero colgando', !('comision' in vacio.guardado));
});

/* --- 15 -------------------------------------------------------------------
   EL CONTRATO SE LLEVA LOS DATOS DEL HOTEL CONSIGO.

   Marco: «sigue sin aparecer los datos bancarios aunque ya los puse en
   ajustes; a mí sí me salen pero a Carmen no».

   La pantalla de firma corre en el navegador DEL CLIENTE, que no tiene los
   ajustes del hotel ni tiene por qué tenerlos: el servidor sólo le deja leer
   el documento que trae su clave. Sin congelar nada, el contrato que él abre
   desde su enlace dice «________» donde va la razón social, el RFC y la
   cuenta de depósito — firmaría un papel que no nombra al hotel ni dice dónde
   pagar.

   Banquetes se protegía así desde siempre (`datosHotel`). Ventas no lo
   necesitaba hasta que este documento empezó a nombrar al hotel, que fue
   cuando le agregamos «Datos para el pago» y las cláusulas de Objeto,
   Servicio y Contraprestación. Se le puso la dependencia sin la protección.
   =========================================================================== */
await bloque('15 · el cliente, sin los ajustes del hotel, igual lee quién se obliga', async () => {
  const r = await p.evaluate(() => {
    /* Lo que el hotel tiene capturado hoy. Inventado: repo público. */
    Object.assign(state.ajustes.hotel, { razonSocial:'RAZÓN DE EJEMPLO SA DE CV',
      rfc:'XAXX010101000', banco:'BANCO DE EJEMPLO', cuenta:'0000000000',
      clabe:'000000000000000000' });
    guardar();

    const k = saneaContrato({ id:'k15', tipo:'contrato', clienteId:'c1',
      ejecutivo:'Carmen Ejemplo', fecha:'2026-10-29', titulo:'Grupo de ejemplo',
      hospedaje:[saneaLineaHosp({ descripcion:'10 habitaciones King', noches:2, precio:1800 })] });

    /* Se congela como lo hace `emitirContrato`, que es el único lugar donde
       un contrato deja de ser borrador. */
    const dh = datosDelHotelAhora();
    if (dh) k.datosHotel = dh;

    /* Y AHORA SE BORRAN LOS AJUSTES: así es exactamente como llega el
       documento al navegador del cliente. */
    const guardados = state.ajustes.hotel;
    state.ajustes.hotel = Object.assign({}, HOTEL_DEF);

    const caja = document.createElement('div');
    caja.className = 'doc-body';
    caja.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px';
    caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(k, cliente('c1'))}</div>`;
    document.body.appendChild(caja);
    const texto = caja.innerText; caja.remove();

    state.ajustes.hotel = guardados;
    return { texto, llaves: Object.keys(k) };
  });

  afirma('NOMBRA AL HOTEL en el objeto, aunque no haya ajustes',
    /RAZÓN DE EJEMPLO SA DE CV/.test(r.texto));
  afirma('y dice a nombre de quién se paga, con su RFC',
    /XAXX010101000/.test(r.texto));
  afirma('Y DICE DÓNDE PAGAR: banco, cuenta y CLABE',
    /BANCO DE EJEMPLO/.test(r.texto) && /0000000000/.test(r.texto) &&
    /000000000000000000/.test(r.texto));
  afirma('el contrato emitido carga la copia', r.llaves.includes('datosHotel'));
});

/* --- 16 ------------------------------------------------------------------- */
await bloque('16 · lo congelado no se mueve, y lo que no se congeló sí', async () => {
  const r = await p.evaluate(() => {
    Object.assign(state.ajustes.hotel, { razonSocial:'LA DE ANTES SA DE CV',
      banco:'BANCO DE ANTES', cuenta:'1111111111', clabe:'111111111111111111' });
    guardar();
    const k = saneaContrato({ id:'k16', tipo:'contrato', clienteId:'c1',
      ejecutivo:'Carmen Ejemplo', fecha:'2026-10-29', titulo:'Grupo de ejemplo',
      hospedaje:[saneaLineaHosp({ descripcion:'10 King', noches:2, precio:1800 })] });
    const dh = datosDelHotelAhora();
    if (dh) k.datosHotel = dh;

    /* El hotel cambia de banco DESPUÉS de emitirlo. */
    Object.assign(state.ajustes.hotel, { banco:'BANCO NUEVO', cuenta:'2222222222' });
    guardar();

    const dibuja = (doc) => {
      const caja = document.createElement('div');
      caja.innerHTML = `<div class="doc-contenido">${cuerpoContrato(doc, cliente('c1'))}</div>`;
      return caja.innerText;
    };
    /* Y un BORRADOR, que nunca se emitió y por tanto no congeló nada. */
    const borrador = saneaContrato({ id:'k16b', tipo:'contrato', clienteId:'c1',
      ejecutivo:'Carmen Ejemplo', fecha:'2026-10-29',
      hospedaje:[saneaLineaHosp({ descripcion:'10 King', noches:2, precio:1800 })] });
    return { emitido: dibuja(k), borrador: dibuja(borrador),
             llavesBorrador: Object.keys(borrador) };
  });

  afirma('EL CONTRATO EMITIDO CONSERVA EL BANCO CON EL QUE SE FIRMÓ',
    /BANCO DE ANTES/.test(r.emitido) && !/BANCO NUEVO/.test(r.emitido));
  afirma('y el borrador sí toma el nuevo', /BANCO NUEVO/.test(r.borrador));
  afirma('un borrador no carga la copia congelada',
    !r.llavesBorrador.includes('datosHotel'));
});

/* --- 17 --------------------------------------------------------------------
   EL GRUPO DE CONTROL. El mecanismo se copió de banquetes; si algo se rompió,
   es ahí. */
await bloque('17 · el contrato de BANQUETES sigue congelando igual', async () => {
  const r = await p.evaluate(() => {
    Object.assign(state.ajustes.hotel, { razonSocial:'RAZÓN DE EJEMPLO SA DE CV' });
    guardar();
    const e = saneaEvento({ id:'e17', clienteId:'c1', ejecutivo:'Carmen Ejemplo',
      fecha:'2026-10-29', titulo:'Evento de ejemplo' });
    const dh = datosDelHotelAhora();
    if (dh) e.datosHotel = dh;
    const guardados = state.ajustes.hotel;
    state.ajustes.hotel = Object.assign({}, HOTEL_DEF);
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${cuerpoContratoBq(e, cliente('c1'))}</div>`;
    const texto = caja.innerText;
    state.ajustes.hotel = guardados;
    return texto;
  });
  afirma('sin ajustes, el de banquetes también nombra al hotel',
    /RAZÓN DE EJEMPLO SA DE CV/.test(r));
  afirma('y sigue siendo el de eventos sociales', /EVENTOS SOCIALES/i.test(r));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
