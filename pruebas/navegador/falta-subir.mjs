/* ===========================================================================
   «FALTA SUBIR 4» QUE NO DICE DE QUÉ

   Marco dio de alta a un ejecutivo nuevo y mandó la captura de su pantalla:
   el chip decía «Falta subir 4» y la ventana del chip listaba cuatro veces
   lo mismo —«Un cliente · a nombre de Carmen Sotelo», «Un cliente · a nombre
   de Eduardo Islas»— sin decir de qué empresa era ninguna.

   Eran cuatro fichas de cliente que esa computadora traía de otras personas y
   que el servidor rechaza con razón: `roles.sql` no deja escribir un registro
   que allá está a nombre de alguien más. El aviso estaba bien en el fondo y
   era inútil en la práctica: SIN EL NOMBRE nadie puede ir a buscar la ficha,
   ni saber si ya está en la nube o si sólo existe en ese navegador —que es la
   diferencia entre un ruido y un dato que se pierde al cerrar sesión—.

   La causa: el título se armaba con `folio || nombreCompleto || nombre ||
   titulo`, y una ficha de cliente no tiene ninguno de los cuatro; tiene
   `empresa` y `contacto`.

   Lo que se cuida aquí:

   · que cada renglón diga de qué empresa es y de quién;
   · que cuando el registro es de otra persona lo diga sin rodeos —desde esa
     cuenta no va a entrar nunca— y diga cómo sacarlo;
   · que la nota de abajo no tranquilice de más: lo rechazado puede estar
     SÓLO en ese equipo;
   · y los grupos de control, que es donde esto se rompe: lo que ya se
     nombraba bien se sigue nombrando igual, y los demás motivos de rechazo no
     se contagian del texto nuevo.

   Cómo correrla:  node pruebas/navegador/falta-subir.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del arreglo tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8885;
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
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/`);
await p.waitForFunction(() => typeof menuRechazados === 'function', null, { timeout:15000 });

const YO = 'Adrián Ejemplo', OTRA = 'Carmen Prueba';
const RLS = '403 · new row violates row-level security policy';

/* La cartera que tiene ESA computadora: dos fichas que no son suyas y una que
   sí, más un convenio para el grupo de control. `usuarioActual` se sustituye
   porque `miNombre` lee de ahí y no es propiedad de window. */
await p.evaluate(({ YO, OTRA }) => {
  window.usuarioActual = () => ({ id:'u1', correo:'yo@ejemplo.example',
                                  nombre:YO, rol:'ejecutivo' });
  state.clientes = [
    saneaCliente({ id:'c1', empresa:'MUEBLERÍA DEL NORTE SA DE CV',
                   contacto:'Quien Sea', ejecutivo:OTRA, estatus:'nuevo' }),
    saneaCliente({ id:'c2', empresa:'TRANSPORTES EJEMPLO SA DE CV',
                   contacto:'Otra Persona', ejecutivo:YO, estatus:'nuevo' }),
    saneaCliente({ id:'c3', empresa:'', contacto:'SÓLO UN CONTACTO',
                   ejecutivo:OTRA, estatus:'nuevo' })];
  state.convenios = [
    saneaConv({ id:'v1', folio:'CV-2026-010', clienteId:'c1', ejecutivo:OTRA })];
  state.actividades = [];
}, { YO, OTRA });

/** Pone los rechazados que se le pidan y abre la ventana del chip. */
const laVentana = rech => p.evaluate(r => {
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  nube.rechazados = r;
  menuRechazados();
  return document.querySelector('.overlay .modal').innerText;
}, rech);

const cerrar = () => p.evaluate(() =>
  document.querySelectorAll('.overlay').forEach(o => o.remove()));

/* --- 1 ---------------------------------------------------------------------
   EL CASO DE MARCO. Hoy nace en rojo: dice «Un cliente». */
await bloque('1 · una ficha rechazada dice de qué empresa es', async () => {
  const t = await laVentana([{ id:'clientes:c1', tipo:'clientes', motivo:RLS }]);
  afirma('DICE EL NOMBRE DE LA EMPRESA', t.includes('MUEBLERÍA DEL NORTE SA DE CV'));
  afirma('y ya no el genérico «Un cliente»', !/\bUn cliente\b/.test(t));
  afirma('y de quién es', t.includes('a nombre de ' + OTRA));
  await cerrar();
});

/* --- 2 ---------------------------------------------------------------------
   Y lo que hay que hacer, que es lo que faltaba. */
await bloque('2 · si es de otra persona, lo dice y dice cómo sacarlo', async () => {
  const t = await laVentana([{ id:'clientes:c1', tipo:'clientes', motivo:RLS }]);
  afirma('DICE QUE DESDE ESA CUENTA NO VA A ENTRAR', /NO va a entrar/.test(t));
  afirma('y manda a Exportar → Respaldo completo', /Respaldo completo/.test(t));
  afirma('diciendo que se lleva lo que no se ve en pantalla',
    /no se ve en pantalla/.test(t));
  await cerrar();
});

/* --- 3 ---------------------------------------------------------------------
   «Nada se ha perdido» tranquilizaba de más. */
await bloque('3 · avisa que cerrar sesión se lo lleva', async () => {
  const t = await laVentana([{ id:'clientes:c1', tipo:'clientes', motivo:RLS }]);
  afirma('dice que puede estar SÓLO ahí', /sólo.{0,8}aquí/i.test(t));
  afirma('Y QUE CERRAR SESIÓN SE LO LLEVA', /Cerrar sesión/i.test(t));
  await cerrar();
});

/* --- 4 ---------------------------------------------------------------------
   GRUPO DE CONTROL: lo que ya se nombraba bien no se tocó. */
await bloque('4 · un convenio sigue saliendo con su folio', async () => {
  const t = await laVentana([{ id:'convenios:v1', tipo:'convenios', motivo:RLS }]);
  afirma('sale el folio', t.includes('CV-2026-010'));
  afirma('y no el genérico', !/Un convenio/.test(t));
  await cerrar();
});

/* --- 5 ---------------------------------------------------------------------
   GRUPO DE CONTROL: lo que ya no está en este equipo —una lápida— no tiene
   nombre que enseñar, y la ventana no se puede caer por eso. */
await bloque('5 · lo que ya no está aquí cae en el genérico, sin romperse', async () => {
  const t = await laVentana([{ id:'clientes:fantasma', tipo:'clientes', motivo:RLS }]);
  afirma('dice el genérico', /Un cliente/.test(t));
  afirma('y la ventana se pintó', /Falta subir 1/.test(t));
  afirma('sin ofrecer el respaldo, que aquí no aplica', !/Respaldo completo/.test(t));
  await cerrar();
});

/* --- 6 ---------------------------------------------------------------------
   GRUPO DE CONTROL, Y ES EL QUE IMPORTA: si el registro SÍ es mío, el rechazo
   es otra cosa y no se le puede decir que lo exporte y se lo mande a alguien.
   Es suyo; lo que hay es un problema del servidor. */
await bloque('6 · si el registro es mío, no se me manda exportarlo', async () => {
  const t = await laVentana([{ id:'clientes:c2', tipo:'clientes', motivo:RLS }]);
  afirma('sale su empresa', t.includes('TRANSPORTES EJEMPLO SA DE CV'));
  afirma('y dice que está a mi nombre', t.includes('a nombre de ' + YO));
  afirma('NO DICE que no va a entrar', !/NO va a entrar/.test(t));
  afirma('ni me manda a exportar', !/Respaldo completo/.test(t));
  await cerrar();
});

/* --- 7 ---------------------------------------------------------------------
   GRUPO DE CONTROL: los otros motivos no se contagian del texto nuevo. */
await bloque('7 · otros motivos siguen diciendo lo suyo', async () => {
  const t = await laVentana([
    { id:'clientes:c1', tipo:'clientes', motivo:'23505 duplicate key value' },
    { id:'clientes:c3', tipo:'clientes', motivo:'23514 check constraint' }]);
  afirma('la clave repetida dice lo suyo', /Ya existe otro registro/.test(t));
  afirma('la regla del servidor también', /no cumple una regla/.test(t));
  afirma('y ninguno manda a exportar', !/Respaldo completo/.test(t));
  afirma('el que no trae empresa se nombra por su contacto',
    t.includes('SÓLO UN CONTACTO'));
  await cerrar();
});

/* --- 8 ---------------------------------------------------------------------
   Y el botón sigue siendo el botón. */
await bloque('8 · «Volver a intentar» vuelve a sincronizar', async () => {
  await laVentana([{ id:'clientes:c1', tipo:'clientes', motivo:RLS }]);
  const r = await p.evaluate(async () => {
    window.__reintento = false;
    window.sincronizar = async () => { window.__reintento = true; };
    document.getElementById('bReintentar').click();
    await new Promise(r => setTimeout(r, 200));
    return { pico: window.__reintento,
             cerrada: !document.querySelector('.overlay') };
  });
  afirma('llama a la sincronización', r.pico === true);
  afirma('y cierra la ventana', r.cerrada === true);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
