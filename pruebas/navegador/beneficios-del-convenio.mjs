/* ===========================================================================
   LOS BENEFICIOS DEL CONVENIO: SPA Y TRANSPORTACIÓN

   Marco, mirando un convenio ya hecho: «en los convenios, si no agregas la
   Care no te salen los beneficios del descuento en spa, transportación y
   acceso al gym».

   Tenía razón, y la causa era que esos tres renglones vivían en el bloque
   Recovery, que el documento sólo imprime si el convenio trae una habitación
   de ese grupo —la Care—. Primero subieron dos: el 20% del spa y la
   transportación, que eran los que de plano no aparecían nunca.

   El gimnasio se quedó abajo, y eso se vio en el siguiente convenio de
   verdad. Marco: «el incluye acceso a gimnasio sólo sale cuando se agrega una
   recovery, haz que salga junto con las otras». Se había vuelto un caso peor
   que el original: en un convenio sin Care no salía, y en uno con Care salía
   SOLO —en una tira para él—, porque sus dos compañeros ya se decían arriba y
   el de-duplicador se los llevaba. El bloque 8 es el suyo.

   Y no son beneficios de la habitación de recuperación: la transportación
   *Hotel - Empresa - Hotel* es para los empleados de la empresa con convenio.
   Marco confirmó los dos, así que ahora van arriba, en los valores agregados.

   Lo que se cuida aquí:

   · que un convenio SIN habitación Care ya los ofrezca —el caso que reportó—;
   · que el convenio CON Care no haya perdido nada de lo que ya decía;
   · LA MIGRACIÓN, que es lo que de verdad decide si esto sirve: los ajustes
     guardados le ganan al texto de fábrica, así que un hotel que ya trabajó
     seguiría viendo el de antes para siempre. Se comprueba que al cargar se
     le cambie;
   · y el contrapeso: que a quien escribió SU PROPIA versión del texto NO se
     le pise. Una migración que borra lo que alguien redactó es peor que no
     migrar;
   · que un convenio YA HECHO no cambie solo. Cada convenio guarda su copia de
     los textos, y un documento que ya está en manos del cliente no se puede
     mover debajo de él.

   Cómo correrla:  node pruebas/navegador/beneficios-del-convenio.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8823;
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
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO S.A.',
    contacto:'Contacto de ejemplo', ejecutivo:'Sistemas' })];
  guardar();
});

/** Arma un convenio con las habitaciones que se le pidan y devuelve lo que imprime. */
const documento = (habitaciones, extra) => p.evaluate(({ hs, ex }) => {
  const v = saneaConv(Object.assign({ id:'v1', clienteId:'c1', ejecutivo:'Sistemas',
    fecha:'2026-10-22', habitaciones:hs, textos:Object.assign({}, state.ajustes.textos)
  }, ex || {}));
  state.convenios = [v]; guardar();
  const caja = document.createElement('div');
  caja.innerHTML = `<div class="doc-contenido">${cuerpoConvenio(v, cliente('c1'))}</div>`;
  return caja.innerText;
}, { hs: habitaciones, ex: extra });

const DELUXE   = [{ grupo:'deluxe',   codigo:'DLX', nombre:'Deluxe King',  publica:2500, convenio:1900 }];
const CARE     = [{ grupo:'recovery', codigo:'CARE', nombre:'Care',        publica:4800, convenio:4200 }];

/* --- 1 --------------------------------------------------------------------
   El caso exacto que reportó Marco: un convenio normal, sin Care. */
await bloque('1 · un convenio SIN habitación Care ya ofrece los beneficios', async () => {
  const t = await documento(DELUXE, { desayunos:['americano'] });
  afirma('ofrece el 20% en SENSES SPA',         /20% de descuento en SENSES SPA/i.test(t));
  afirma('OFRECE LA TRANSPORTACIÓN, que era la que nunca salía',
    /Transportaci[óo]n Hotel - Empresa - Hotel/i.test(t));
  afirma('y dice que está sujeta a disponibilidad', /sujeta a disponibilidad/i.test(t));

  /* Donde Marco los quiere: pegados al desayuno, debajo de la tabla, NO en la
     lista numerada de valores agregados. */
  const i = t.indexOf('Desayuno incluido');
  const j = t.indexOf('20% de descuento en SENSES SPA');
  const k = t.indexOf('VALORES AGREGADOS');
  afirma('VAN JUNTO AL DESAYUNO INCLUIDO', i >= 0 && j > i && (k < 0 || j < k));
  afirma('y NO en la lista numerada de valores agregados',
    !/6\.- 20% de descuento/.test(t) && !/7\.- Transportaci/.test(t));

  afirma('el gimnasio sigue donde siempre estuvo', /Acceso a Gimnasio/i.test(t));
  /* Sin Recovery no debe aparecer nada de la habitación de recuperación. */
  afirma('y no se coló nada de Recovery',
    !/cama el[ée]ctrica/i.test(t) && !/enfermer[íi]a/i.test(t));
});

/* --- 2 --------------------------------------------------------------------
   Lo que ya funcionaba no se tocó. */
await bloque('2 · el convenio CON Care no perdió nada', async () => {
  const t = await documento(DELUXE.concat(CARE), { incluyeRecovery:true });
  afirma('sigue trayendo el bloque Recovery',   /cama el[ée]ctrica/i.test(t));
  afirma('con su enfermería y médico',          /Enfermer[íi]a y m[ée]dico/i.test(t));
  afirma('sigue ofreciendo el 20% del spa',     /20% de descuento en SENSES SPA/i.test(t));
  afirma('y la transportación',                 /Transportaci[óo]n/i.test(t));
  /* El bloque Recovery trae esas dos palomitas escritas desde siempre. Ahora
     que salen arriba para todos, abajo ya no se repiten: un documento que
     ofrece dos veces lo mismo se lee como un descuido.

     Se mide que desaparezcan las PALOMITAS. Lo que dice la columna «Habitación
     Surgery Recovery» se queda como está: no es una repetición, es la lista de
     lo que trae ese paquete, y ahí el spa está en su lugar. */
  afirma('SIN REPETIR LAS PALOMITAS, que el bloque Recovery traía',
    !/✓\s*20% de descuento/i.test(t) && !/✓\s*Transportaci/i.test(t));
  afirma('y la transportación se ofrece una sola vez en todo el documento',
    (t.match(/Transportaci[óo]n Hotel/gi) || []).length === 1);
  /* El gimnasio ya tampoco: subió con los otros dos, y el renglón de Recovery
     —«✓ Incluye acceso a gimnasio»— se de-duplica contra él. Sin esto, el
     bloque Recovery quedaba imprimiendo una tira con un solo renglón. */
  afirma('Y TAMPOCO LA DEL GIMNASIO, que era la que quedaba suelta',
    !/✓\s*Incluye acceso a gimnasio/i.test(t));
});

/* --- 3 --------------------------------------------------------------------
   ESTE es el bloque que decide si el cambio sirve de algo. Cambiar el texto
   de fábrica no alcanza: lo guardado le gana. */
await bloque('3 · al hotel que YA TRABAJÓ también le llega', async () => {
  const r = await p.evaluate(() => {
    /* Así se ve un ajuste guardado de antes del cambio. */
    const viejo = JSON.parse(JSON.stringify(state));
    const salida = [];
    for (const x of VALORES_VIEJOS){
      viejo.ajustes.textos.valores = x;
      salida.push(sanear(viejo).ajustes.textos.valores);
    }
    return salida;
  });
  afirma('las dos versiones que repartimos quedan en los cinco puntos',
    r.length === 2 && r.every(x => /Cajas de seguridad en habitaciones$/.test(x.trim())));
  afirma('y a ninguna le quedan los beneficios colgados de la lista',
    r.every(x => !/SENSES SPA/.test(x) && !/Transportaci/.test(x)));
  afirma('conservando lo que ya decían', r.every(x => /Habitaciones Smart/.test(x)));
});

/* --- 4 --------------------------------------------------------------------
   El contrapeso del 3. Una migración que pisa lo que alguien redactó hace más
   daño que la falla que arregla. */
await bloque('4 · pero al que escribió el suyo NO se le pisa', async () => {
  const MIO = '1.- Lo que yo escribí para mi hotel\n2.- Y mi segundo punto';
  const r = await p.evaluate((mio) => {
    const otro = JSON.parse(JSON.stringify(state));
    otro.ajustes.textos.valores = mio;
    return sanear(otro).ajustes.textos.valores;
  }, MIO);
  afirma('su texto queda intacto', r === MIO);
  afirma('y no se le agregó nada', !/SENSES SPA/.test(r));
});

/* --- 5 --------------------------------------------------------------------
   Un convenio guarda su propia copia de los textos. Eso no es un descuido: un
   documento que ya está en manos del cliente no se puede mover debajo de él. */
await bloque('5 · un convenio YA HECHO no cambia solo', async () => {
  const t = await p.evaluate(() => {
    const v = saneaConv({ id:'v9', clienteId:'c1', ejecutivo:'Sistemas',
      fecha:'2026-09-01', habitaciones:[{ grupo:'deluxe', codigo:'DLX',
        nombre:'Deluxe King', publica:2500, convenio:1900 }],
      /* Así se ve el guardado de un convenio nacido antes: trae sus textos,
         pero el renglón de beneficios no existía todavía. */
      textos: (() => { const x = Object.assign({}, state.ajustes.textos);
                       delete x.beneficios; return x; })() });
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${cuerpoConvenio(v, cliente('c1'))}</div>`;
    return caja.innerText;
  });
  afirma('UNA CARTA YA FIRMADA NO EMPIEZA A OFRECER ALGO QUE NADIE LE OFRECIÓ',
    !/20% de descuento en SENSES SPA/.test(t) && !/Transportaci[óo]n Hotel/.test(t));
  afirma('y no se rompió: sigue siendo un convenio completo',
    /Habitaciones Smart/.test(t) && /Especificaciones de tarifas/.test(t));
});

/* --- 6 --------------------------------------------------------------------
   Un convenio nuevo nace con los textos del hotel, no con los de fábrica: es
   por ahí por donde le llega el cambio al equipo. */
await bloque('6 · y el convenio nuevo nace ya con los beneficios', async () => {
  const t = await documento(DELUXE);
  afirma('el convenio nuevo los trae', /20% de descuento en SENSES SPA/.test(t));
  const dosVeces = (t.match(/20% de descuento en SENSES SPA/gi) || []).length;
  afirma('y sin Care los ofrece una sola vez, no repetidos', dosVeces === 1);
});

/* --- 7 --------------------------------------------------------------------
   Lo que destraba el caso real: Marco corrigió el texto y su borrador seguía
   diciendo lo de antes. Un borrador que nadie ha mandado se pone al día solo
   al abrirlo, igual que ya pasaba con la tarifa pública del catálogo. */
await bloque('7 · un BORRADOR se pone al día al abrirlo', async () => {
  const r = await p.evaluate(() => {
    const viejo = saneaConv({ id:'v7', clienteId:'c1', ejecutivo:'Sistemas',
      estado:'borrador', fecha:'2026-10-22',
      habitaciones:[{ grupo:'deluxe', codigo:'DLX', nombre:'Deluxe King',
                      publica:2500, convenio:1900 }],
      textos: (() => { const x = Object.assign({}, state.ajustes.textos);
                       delete x.beneficios; return x; })() });
    state.convenios = [viejo]; guardar();
    const antes = viejo.textos.beneficios;
    editarConvenio('v7');
    const despues = state.convenios[0].textos.beneficios;
    document.querySelector('.modal [data-close]')?.click();
    return { antes, despues };
  });
  afirma('antes de abrirlo no los traía', !r.antes);
  afirma('ABRIRLO LE COPIA LOS TEXTOS DEL HOTEL',
    /20% de descuento en SENSES SPA/.test(r.despues || ''));
});

/* --- 8 --------------------------------------------------------------------
   EL GIMNASIO. El caso que reportó Marco con la hoja delante.

   Ojo al contar: «Acceso a Gimnasio» también es el punto 3 de la lista de
   VALORES AGREGADOS, y ahí se queda a propósito —ahí la lista habla de lo que
   es el hotel; en la tira, de lo que trae esta tarifa—. Así que no se buscan
   coincidencias sueltas en el texto: se cuentan RENGLONES que digan
   exactamente eso, que son los de la tira. */
await bloque('8 · el acceso a gimnasio sale con los demás beneficios', async () => {
  /** Cuántos renglones del documento dicen exactamente este texto. */
  const renglones = (texto, dice) =>
    texto.split('\n').map(l => l.trim()).filter(l => l.toLowerCase() === dice).length;

  /* 8.1 · Sin Care. Es el convenio normal, y hasta hoy no lo mencionaba. */
  const sin = await documento(DELUXE, { desayunos:['americano'] });
  afirma('UN CONVENIO SIN CARE YA OFRECE EL GIMNASIO',
    renglones(sin, 'acceso a gimnasio') === 1);

  /* 8.2 · En la misma tira que los otros, y en orden. Cuatro renglones
     seguidos se leen como una sola cosa: lo que trae la tarifa. */
  const dond = (texto, re) => texto.search(re);
  const iDes = dond(sin, /Desayuno incluido/);
  const iGim = dond(sin, /^\s*Acceso a gimnasio\s*$/m);
  const iSpa = dond(sin, /20% de descuento en SENSES SPA/);
  const iTra = dond(sin, /Transportaci[óo]n Hotel/);
  afirma('EN EL ORDEN: desayuno, gimnasio, spa y transportación',
    iDes >= 0 && iGim > iDes && iSpa > iGim && iTra > iSpa);
  afirma('y antes de la lista de valores agregados',
    iGim < dond(sin, /VALORES AGREGADOS/i) || dond(sin, /VALORES AGREGADOS/i) < 0);

  /* 8.3 · Con Care: una sola vez, y sin la tira suelta de antes. */
  const con = await documento(DELUXE.concat(CARE), { desayunos:['americano'], incluyeRecovery:true });
  afirma('CON CARE SE OFRECE UNA SOLA VEZ', renglones(con, 'acceso a gimnasio') === 1);
  afirma('y ya no queda la palomita suelta del bloque Recovery',
    !/✓\s*Incluye acceso a gimnasio/i.test(con));
  afirma('el punto 3 de valores agregados sigue en su lugar',
    /3\.- Acceso a Gimnasio/.test(con));

  /* 8.4 · Y de verdad va DENTRO de la tira, no en una suya. Esto se mide en
     el documento colgado: `innerText` de un nodo suelto no renderiza. */
  const tiras = await p.evaluate(() => {
    const v = saneaConv({ id:'v8', clienteId:'c1', ejecutivo:'Sistemas', fecha:'2026-10-27',
      desayunos:['americano'], incluyeRecovery:true,
      habitaciones:[{ grupo:'deluxe', codigo:'DLX', nombre:'Deluxe King', publica:2500, convenio:1900 },
                    { grupo:'recovery', codigo:'CARE', nombre:'Care', publica:null, convenio:3500 }],
      textos: Object.assign({}, state.ajustes.textos) });
    const caja = document.createElement('div');
    caja.className = 'doc-body';
    caja.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px';
    caja.innerHTML = `<div class="doc-contenido">${cuerpoConvenio(v, cliente('c1'))}</div>`;
    document.body.appendChild(caja);
    const t = [...caja.querySelectorAll('.inc')].map(x => x.innerText.trim());
    caja.remove();
    return t;
  });
  afirma('TODO EN UNA SOLA TIRA, no una para el gimnasio y otra para el resto',
    tiras.length === 1);
  afirma('y esa tira los lleva a los cuatro',
    tiras.length === 1 && /Desayuno incluido/.test(tiras[0]) &&
    /Acceso a gimnasio/i.test(tiras[0]) && /SENSES SPA/.test(tiras[0]) &&
    /Transportaci[óo]n/i.test(tiras[0]));
});

/* --- 9 --------------------------------------------------------------------
   La migración del gimnasio. Mismo razonamiento que el bloque 3: cambiar el
   texto de fábrica no le llega a nadie, porque lo guardado le gana. */
await bloque('9 · al hotel que ya tiene los beneficios guardados le llega el gimnasio', async () => {
  const r = await p.evaluate(() => {
    const salida = [];
    for (const x of BENEFICIOS_VIEJOS){
      const viejo = JSON.parse(JSON.stringify(state));
      viejo.ajustes.textos.beneficios = x;
      salida.push(sanear(viejo).ajustes.textos.beneficios);
    }
    return salida;
  });
  afirma('la versión que repartimos gana el gimnasio',
    r.length > 0 && r.every(x => /Acceso a gimnasio/i.test(x)));
  afirma('sin perder el spa ni la transportación',
    r.every(x => /SENSES SPA/.test(x) && /Transportaci[óo]n Hotel/.test(x)));

  /* El contrapeso, otra vez: quien redactó el suyo manda. */
  const MIO = 'Lo que yo le ofrezco a mis clientes';
  const mio = await p.evaluate((m) => {
    const otro = JSON.parse(JSON.stringify(state));
    otro.ajustes.textos.beneficios = m;
    return sanear(otro).ajustes.textos.beneficios;
  }, MIO);
  afirma('Y AL QUE ESCRIBIÓ EL SUYO NO SE LE PISA', mio === MIO);

  /* Y el convenio que ya salió del hotel no se mueve: su copia manda. */
  const viejo = await p.evaluate(() => {
    const v = saneaConv({ id:'v10', clienteId:'c1', ejecutivo:'Sistemas', fecha:'2026-08-01',
      habitaciones:[{ grupo:'recovery', codigo:'CARE', nombre:'Care', publica:null, convenio:3500 }],
      incluyeRecovery:true,
      textos: (() => { const x = Object.assign({}, state.ajustes.textos);
                       delete x.beneficios; return x; })() });
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="doc-contenido">${cuerpoConvenio(v, cliente('c1'))}</div>`;
    return caja.innerText;
  });
  afirma('UN CONVENIO YA HECHO SIGUE IMPRIMIENDO SU BLOQUE RECOVERY IGUAL QUE AYER',
    /Incluye acceso a gimnasio/i.test(viejo) &&
    /20% de descuento en SENSES SPA/.test(viejo) &&
    /Transportaci[óo]n/i.test(viejo));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
