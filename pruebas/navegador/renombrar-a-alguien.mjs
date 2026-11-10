/* ===========================================================================
   RENOMBRAR A ALGUIEN NO PUEDE DEJARLE LOS PAPELES ATRÁS

   Marco: «le puse acentos al nombre de Adrian en los ajustes y ya no ve nada
   de los convenios cargados ni actividades que tenía».

   Lo que amarra a una persona con sus papeles es LA CADENA DE SU NOMBRE, no
   su correo: `convenioEsMio` compara `ejecutivoDe(v)` contra `miNombre()`, y
   con `roles.sql` corrido la columna `duenio` del servidor sale de esa misma
   cadena —así que el servidor ni siquiera se los entrega—. Corregirle el
   nombre a alguien en Ajustes lo convertía, para el CRM, en otra persona.

   Y al ir a repararlo salía el segundo agujero, peor: las tres funciones que
   existen para esto —la lista de nombres huérfanos, lo que arrastra cada uno
   y el botón de reasignar— miraban DOS CAMPOS DE NUEVE. Un convenio con un
   nombre huérfano ni aparecía en la lista, así que no había manera de
   devolvérselo a nadie desde el CRM.

   Lo que se cuida aquí:

   · que al cambiar el nombre se ofrezca llevarse los papeles, con la cuenta;
   · que al aceptar se muevan LOS NUEVE CAMPOS, convenios incluidos;
   · que al decir que no, no se mueva nada y el nombre viejo salga en la lista
     de huérfanos CON SUS DOCUMENTOS CONTADOS;
   · que `ejecutivoBq` se renombre donde ya estaba y no se invente donde no;
   · y los grupos de control: cambiar sólo el correo o el papel no pregunta
     nada, y un documento ya firmado sigue imprimiendo el nombre con el que se
     firmó.

   Cómo correrla:  node pruebas/navegador/renombrar-a-alguien.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8886;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

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
/* Cada bloque decide si acepta o no: `respuesta` manda. */
let respuesta = true;
const dichos = [];
p.on('dialog', d => {
  dichos.push(d.message());
  (respuesta ? d.accept() : d.dismiss()).catch(() => {});
});
await p.goto(`http://127.0.0.1:${PUERTO}/`);
await p.waitForFunction(() => typeof reasignarEjecutivo === 'function', null, { timeout:15000 });

const VIEJO = 'Adrian Gonzalez', NUEVO = 'Adrián González', OTRA = 'Carmen Prueba';

/** Deja el equipo y la cartera como estaban antes de tocar el nombre. */
const montar = () => p.evaluate(({ VIEJO, OTRA }) => {
  ponDepto('ventas');
  state.usuarios = [
    saneaUsuario({ id:'u1', correo:'admin@ejemplo.example', nombre:'Quien Administra', rol:'admin' }),
    saneaUsuario({ id:'u2', correo:'ventas1@ejemplo.example', nombre:VIEJO, rol:'ejecutivo' }),
    saneaUsuario({ id:'u3', correo:'ventas3@ejemplo.example', nombre:OTRA, rol:'ejecutivo' })];
  state.clientes = [
    saneaCliente({ id:'c1', empresa:'EMPRESA UNO SA DE CV', ejecutivo:VIEJO, estatus:'nuevo' }),
    saneaCliente({ id:'c2', empresa:'EMPRESA DOS SA DE CV', ejecutivo:VIEJO,
                   ejecutivoBq:VIEJO, estatus:'nuevo' }),
    saneaCliente({ id:'c3', empresa:'EMPRESA TRES SA DE CV', ejecutivo:OTRA, estatus:'nuevo' })];
  state.actividades = [
    saneaAct({ id:'a1', clienteId:'c1', asunto:'Llamada', responsable:VIEJO, fecha:'2026-10-01T10:00' })];
  state.convenios = [
    saneaConv({ id:'v1', folio:'CV-2026-020', clienteId:'c1', ejecutivo:VIEJO }),
    saneaConv({ id:'v2', folio:'CV-2026-021', clienteId:'c3', ejecutivo:OTRA })];
  state.contratos = [
    saneaContrato({ id:'k1', folio:'CT-2026-020', clienteId:'c1', tipo:'contrato', ejecutivo:VIEJO })];
  state.eventos = [
    saneaEvento({ id:'e1', folio:'EV-2026-020', clienteId:'c1', tipo:'cotizacion', ejecutivo:VIEJO })];
  state.prospectos = [
    saneaProspecto({ id:'p1', empresa:'PROSPECTO SA', asignadoA:VIEJO, capturadoPor:VIEJO })];
  state.campanas = [
    saneaCampana({ id:'m1', nombre:'Campaña de ejemplo', responsable:VIEJO })];
  state.certificados = [
    saneaCertificado({ id:'ce1', folio:'CE-2026-020', paraQuien:'Quien Sea',
                       emitidoPor:VIEJO, estado:'emitido' })];
  guardar();
  /* Y se repinta Ajustes A PROPÓSITO con `renderAjustes`, no con `render`:
     `render` no vuelve a dibujar esa pantalla si ya está abierta —para no
     borrarle lo tecleado a nadie—, así que la tabla se quedaba con el nombre
     del bloque anterior y el guardado siguiente lo leía como un renombre. */
  vista = 'ajustes'; renderAjustes();
}, { VIEJO, OTRA });

/** Teclea el nombre nuevo en la tabla de usuarios y le pica a Guardar. */
const renombrar = (id, nombre) => p.evaluate(async ({ id, nombre }) => {
  document.querySelector(`#tUsr tr[data-u="${id}"] [data-uk="nombre"]`).value = nombre;
  document.getElementById('bGuardarUsr').click();
  await new Promise(r => setTimeout(r, 400));
}, { id, nombre });

/** Qué trae cada nombre, según el propio CRM. */
const cuenta = n => p.evaluate(x => cuantoTiene(x), n);
const sueltos = () => p.evaluate(() => nombresSinDuenio());

/* --- 1 ---------------------------------------------------------------------
   GRUPO DE CONTROL, Y VA PRIMERO: así están las cosas antes de tocar nada. */
await bloque('1 · antes de renombrar, todo tiene dueño', async () => {
  await montar();
  const q = await cuenta(VIEJO);
  afirma('sus clientes se cuentan una vez cada uno, no dos', q.clientes === 2);
  afirma('su actividad también', q.actividades === 1);
  afirma('Y SUS SEIS DOCUMENTOS SE CUENTAN', q.documentos === 6);
  afirma('y no hay nombres huérfanos', (await sueltos()).length === 0);
});

/* --- 2 ---------------------------------------------------------------------
   EL CASO DE MARCO. Hoy nace en rojo por partida doble: ni pregunta, ni mueve
   los convenios aunque se lo pidan. */
await bloque('2 · al renombrar ofrece llevarse los papeles, y se los lleva', async () => {
  await montar();
  respuesta = true; dichos.length = 0;
  await renombrar('u2', NUEVO);

  afirma('PREGUNTA, y dice los dos nombres',
    dichos.some(t => t.includes(VIEJO) && t.includes(NUEVO)));
  afirma('con la cuenta de documentos', dichos.some(t => /6 documento/.test(t)));
  afirma('y advierte qué pasa si se dice que no',
    dichos.some(t => /no los va a ver nadie/i.test(t)));

  const q = await p.evaluate(x => cuantoTiene(x), NUEVO);
  afirma('AHORA SUS CLIENTES SON SUYOS', q.clientes === 2);
  afirma('su actividad también', q.actividades === 1);
  afirma('Y SUS SEIS DOCUMENTOS TAMBIÉN', q.documentos === 6);
  afirma('al viejo no le queda nada', (await cuenta(VIEJO)).documentos === 0);
  afirma('y no quedó ningún nombre huérfano', (await sueltos()).length === 0);

  const r = await p.evaluate(() => ({
    convenio: state.convenios.find(v => v.id === 'v1').ejecutivo,
    contrato: state.contratos.find(k => k.id === 'k1').ejecutivo,
    evento:   state.eventos.find(e => e.id === 'e1').ejecutivo,
    prospecto:state.prospectos.find(x => x.id === 'p1').asignadoA,
    campana:  state.campanas.find(x => x.id === 'm1').responsable,
    cert:     state.certificados.find(x => x.id === 'ce1').emitidoPor,
    bq:       state.clientes.find(c => c.id === 'c2').ejecutivoBq,
    otra:     state.convenios.find(v => v.id === 'v2').ejecutivo
  }));
  afirma('EL CONVENIO ES SUYO', r.convenio === NUEVO);
  afirma('el contrato también', r.contrato === NUEVO);
  afirma('el evento también', r.evento === NUEVO);
  afirma('el prospecto también', r.prospecto === NUEVO);
  afirma('la campaña también', r.campana === NUEVO);
  afirma('el certificado también', r.cert === NUEVO);
  afirma('y el ejecutivo de banquetes del cliente', r.bq === NUEVO);
  afirma('lo de la otra persona NO se tocó', r.otra === OTRA);
});

/* --- 3 ---------------------------------------------------------------------
   Si se dice que no, no se mueve nada. Reutilizar el renglón de quien se fue
   para dar de alta a quien llega es algo que se hace. */
await bloque('3 · si se dice que no, no se mueve nada y se ve el huérfano', async () => {
  await montar();
  respuesta = false; dichos.length = 0;
  await renombrar('u2', NUEVO);
  respuesta = true;

  afirma('preguntó', dichos.length > 0);
  afirma('NO SE MOVIÓ NADA',
    await p.evaluate(() => state.convenios.find(v => v.id === 'v1').ejecutivo) === VIEJO);

  const h = await sueltos();
  afirma('y el nombre viejo sale como huérfano', h.includes(VIEJO));
  const q = await cuenta(VIEJO);
  afirma('CON SUS DOCUMENTOS CONTADOS', q.documentos === 6);
  afirma('y sus clientes', q.clientes === 2);
});

/* --- 4 ---------------------------------------------------------------------
   La reparación completa, que es lo que Marco necesita hoy: devolver de un
   jalón lo que quedó con el nombre de antes. */
await bloque('4 · reasignar devuelve también los documentos', async () => {
  const movidos = await p.evaluate(({ VIEJO, NUEVO }) =>
    reasignarEjecutivo(VIEJO, NUEVO), { VIEJO, NUEVO });
  afirma('toca los once campos, no dos', movidos === 11);
  const q = await p.evaluate(x => cuantoTiene(x), NUEVO);
  afirma('SUS DOCUMENTOS VOLVIERON', q.documentos === 6);
  afirma('y sus clientes', q.clientes === 2);
  afirma('ya no hay huérfanos', (await sueltos()).length === 0);
});

/* --- 5 ---------------------------------------------------------------------
   `ejecutivoBq` nace al usarse: dejarlo en blanco en todas las fichas las
   haría verse editadas y se volverían a subir enteras. */
await bloque('5 · a nadie se le inventa el ejecutivo de banquetes', async () => {
  await montar();
  respuesta = true;
  await renombrar('u2', NUEVO);
  const r = await p.evaluate(() => ({
    conBq: state.clientes.find(c => c.id === 'c2').ejecutivoBq,
    sinBq: 'ejecutivoBq' in state.clientes.find(c => c.id === 'c1'),
    ajeno: 'ejecutivoBq' in state.clientes.find(c => c.id === 'c3')
  }));
  afirma('al que lo traía se le cambió', r.conBq === NUEVO);
  afirma('AL QUE NO LO TRAÍA NO SE LE INVENTÓ', r.sinBq === false);
  afirma('ni al de la otra persona', r.ajeno === false);

  /* Y al dejarlo sin dueño, la llave se quita en vez de quedarse en blanco. */
  await p.evaluate(x => reasignarEjecutivo(x, ''), NUEVO);
  afirma('sin dueño, la llave se va',
    await p.evaluate(() => !('ejecutivoBq' in state.clientes.find(c => c.id === 'c2'))));
});

/* --- 6 ---------------------------------------------------------------------
   GRUPOS DE CONTROL: lo que no es un cambio de nombre no pregunta nada. */
await bloque('6 · cambiar el correo o el papel no pregunta nada', async () => {
  await montar();
  dichos.length = 0;
  await p.evaluate(async () => {
    document.querySelector('#tUsr tr[data-u="u2"] [data-uk="correo"]').value =
      'otro@ejemplo.example';
    document.querySelector('#tUsr tr[data-u="u2"] [data-uk="rol"]').value = 'gerente';
    document.getElementById('bGuardarUsr').click();
    await new Promise(r => setTimeout(r, 400));
  });
  afirma('NO PREGUNTÓ NADA', dichos.length === 0);
  afirma('y sus papeles siguen suyos',
    await p.evaluate(() => state.convenios.find(v => v.id === 'v1').ejecutivo) === VIEJO);
});

/* --- 7 ---------------------------------------------------------------------
   GRUPO DE CONTROL: un documento ya firmado dice lo que decía. El bloque de
   firmas imprime el nombre que se congeló el día que se firmó. */
await bloque('7 · un convenio firmado sigue diciendo quién lo firmó', async () => {
  await montar();
  await p.evaluate(x => {
    const v = state.convenios.find(y => y.id === 'v1');
    v.firmaHotel = { nombre:x, puesto:'Ejecutivo de ventas',
                     fecha:'2026-10-02T10:00:00Z', img:'data:image/png;base64,AA' };
    v.estado = 'firmado_ejecutiva';
    guardar();
  }, VIEJO);
  respuesta = true;
  await renombrar('u2', NUEVO);

  const carta = await p.evaluate(() => {
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    verConvenio('v1');
    return document.querySelector('.overlay .modal.doc').innerText;
  });
  afirma('la carta sigue firmada con el nombre de entonces', carta.includes(VIEJO));
  afirma('y el convenio ya es del nombre nuevo',
    await p.evaluate(() => state.convenios.find(v => v.id === 'v1').ejecutivo) === NUEVO);
  await p.evaluate(() => document.querySelectorAll('.overlay').forEach(o => o.remove()));
});

/* --- 8 ---------------------------------------------------------------------
   GRUPO DE CONTROL: un nombre que no trae nada no tiene por qué preguntar. */
await bloque('8 · renombrar a quien no trae papeles no pregunta', async () => {
  await montar();
  dichos.length = 0;
  await p.evaluate(async () => {
    state.usuarios.push(saneaUsuario({ id:'u9', correo:'nuevo@ejemplo.example',
                                       nombre:'Sin Nada', rol:'ejecutivo' }));
    guardar(); renderAjustes();
    document.querySelector('#tUsr tr[data-u="u9"] [data-uk="nombre"]').value = 'Sin Nada Aún';
    document.getElementById('bGuardarUsr').click();
    await new Promise(r => setTimeout(r, 400));
  });
  afirma('no preguntó', dichos.length === 0);
  afirma('y el nombre quedó cambiado',
    await p.evaluate(() => (state.usuarios.find(u => u.id === 'u9') || {}).nombre) === 'Sin Nada Aún');
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
