/* ===========================================================================
   LOS BENEFICIOS DEL CONVENIO: SPA Y TRANSPORTACIÓN

   Marco, mirando un convenio ya hecho: «en los convenios, si no agregas la
   Care no te salen los beneficios del descuento en spa, transportación y
   acceso al gym».

   Tenía razón, y la causa era que esos tres renglones vivían en el bloque
   Recovery, que el documento sólo imprime si el convenio trae una habitación
   de ese grupo —la Care—. El gimnasio de todos modos salía, porque ya estaba
   en los valores agregados y en los servicios; los que de plano no aparecían
   nunca eran el 20% del spa y la transportación.

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
  afirma('pero el gimnasio de Recovery sigue en su bloque',
    /Incluye acceso a gimnasio/i.test(t));
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

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
