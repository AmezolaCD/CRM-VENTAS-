/* ===========================================================================
   LOS CERTIFICADOS, PARA QUIEN VENDE

   Marco, dos mensajes el mismo día:

     «la pestaña de certificados a la gerente de ventas y a los ejecutivos no
      les aparece, a mí como administrador sí, ajústalo por favor»

     «ya les aparece, no estaban seleccionados en ajustes pero ya los había
      puesto, no sé por qué se quitaron solos»

   Son dos cosas y las dos se cuidan aquí.

   LA PRIMERA: emitir certificados dependía de una palomita por persona y de
   nadie más; sólo la administración la traía puesta. Un certificado de
   cortesía es herramienta de venta —se regala una noche o un masaje para
   cerrar—, así que ahora viene con el papel para ventas y para la dirección.
   Para banquetes y marketing sigue siendo la palomita.

   LA SEGUNDA: «se quitaron solos». El botón «Guardar usuarios» escribía en
   este equipo, decía «Guardado ✓» y dejaba la subida programada sin mirar en
   qué acababa. Si el servidor rebotaba la lista —`roles.sql` sólo se la deja
   escribir al administrador— la pantalla ya había dicho que sí, y después
   cualquier equipo bajaba la lista VIEJA y pisaba lo de aquí. Ahora espera a
   que suba y, si no sube, lo dice.

   Cómo correrla:  node pruebas/navegador/certificados-para-ventas.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes del cambio tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8884;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

/* ----- Un servidor de mentiras al que se le puede pedir que rebote ----- */
const tabla = new Map();
let reloj = 0, rebotaUsuarios = false;
const sello = () => new Date(Date.UTC(2026, 10, 5, 12, 0, reloj++)).toISOString();

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  const manda = (c, b) => { res.writeHead(c, cors); res.end(JSON.stringify(b)); };
  if (req.method === 'OPTIONS') return manda(200, {});

  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/rest/v1/crm_datos'){
    if (req.method === 'GET'){
      const desde = (u.searchParams.get('actualizado') || '').replace(/^gt\./, '');
      let filas = [...tabla.values()];
      if (desde) filas = filas.filter(f => f.actualizado > desde);
      filas.sort((a, b) => a.id < b.id ? -1 : 1);
      return manda(200, filas);
    }
    if (req.method === 'POST'){
      let cuerpo = '';
      req.on('data', d => cuerpo += d);
      return req.on('end', () => {
        let lote = [];
        try{ lote = JSON.parse(cuerpo || '[]'); }catch(e){ return manda(400, { message:'json' }); }
        /* Lo mismo que hace PostgREST con `roles.sql` puesto y una cuenta que
           no es la administración: el lote ENTERO se va al suelo. */
        if (rebotaUsuarios && lote.some(f => String(f.id).startsWith('usuarios:')))
          return manda(403, { message:'new row violates row-level security policy' });
        for (const f of lote)
          tabla.set(f.id, Object.assign({}, tabla.get(f.id) || {}, f, { actualizado: sello() }));
        manda(201, {});
      });
    }
  }
  if (u.pathname.startsWith('/rest/v1/crm_')) return manda(200, []);
  manda(200, []);
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
const dichos = [];
p.on('dialog', d => { dichos.push(d.message()); d.accept().catch(() => {}); });
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof puedeCertificados === 'function', null, { timeout:15000 });

const EQUIPO = [
  { id:'u1', correo:'admin@ejemplo.example',     nombre:'Quien Administra', rol:'admin' },
  { id:'u2', correo:'gerencia@ejemplo.example',  nombre:'Ana Pérez',        rol:'gerente' },
  { id:'u3', correo:'ventas@ejemplo.example',    nombre:'Beto Luna',        rol:'ejecutivo' },
  { id:'u4', correo:'direccion@ejemplo.example', nombre:'Quien Dirige',     rol:'direccion' },
  { id:'u5', correo:'banquetes@ejemplo.example', nombre:'Celia Mora',       rol:'banquetes' }
];

/** Deja el equipo puesto y, si se le pide, la nube enlazada con un correo. */
const entrar = correo => p.evaluate(({ EQUIPO, correo, url }) => {
  state.usuarios = EQUIPO.map(saneaUsuario);
  state.clientes = []; state.convenios = []; state.actividades = [];
  if (correo){
    nube.url = url; nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio', user:{ email:correo } };
    nube.enlazado = true;
  } else {
    nube.url = ''; nube.anon = ''; nube.sesion = null;
  }
  guardar();
  return { puede: puedeCertificados(), ve: puedeVer('certificados'), rol: rolActual() };
}, { EQUIPO, correo, url:`http://127.0.0.1:${PUERTO}` });

/* --- 1 ---------------------------------------------------------------------
   GRUPO DE CONTROL: el archivo suelto, en una sola máquina, no cambia. */
await bloque('1 · sin nube manda quien usa la máquina, como siempre', async () => {
  const r = await entrar('');
  afirma('puede emitir', r.puede === true);
  afirma('y ve la pestaña', r.ve === true);
});

/* --- 2 ---------------------------------------------------------------------
   EL CASO DE MARCO. Los dos nacen en rojo. */
await bloque('2 · a la gerencia de ventas y a los ejecutivos ya les aparece', async () => {
  const g = await entrar('gerencia@ejemplo.example');
  afirma('gerencia: el papel es el suyo', g.rol === 'gerente');
  afirma('GERENCIA DE VENTAS PUEDE EMITIR', g.puede === true);
  afirma('Y VE LA PESTAÑA', g.ve === true);

  const e = await entrar('ventas@ejemplo.example');
  afirma('ejecutivo: el papel es el suyo', e.rol === 'ejecutivo');
  afirma('EL EJECUTIVO DE VENTAS PUEDE EMITIR', e.puede === true);
  afirma('Y VE LA PESTAÑA', e.ve === true);

  const d = await entrar('direccion@ejemplo.example');
  afirma('la dirección también', d.puede === true && d.ve === true);
});

/* --- 3 ---------------------------------------------------------------------
   Y la administración, que siempre pudo. */
await bloque('3 · la administración sigue pudiendo', async () => {
  const a = await entrar('admin@ejemplo.example');
  afirma('puede y ve', a.puede === true && a.ve === true);
});

/* --- 4 ---------------------------------------------------------------------
   GRUPO DE CONTROL: banquetes sigue sin certificados, y no por este cambio.

   La pestaña NO está en la lista de pestañas de su papel —`VISTAS_ROL`— y
   nunca lo estuvo, así que la palomita de Ajustes jamás se la dio: prendida o
   apagada, la pestaña no aparece. Eso es lo que mandó a Marco a buscar una
   palomita que no era el problema, y por eso ahora la columna se lo dice en
   vez de ofrecerle un permiso que no sirve. */
await bloque('4 · banquetes sigue sin certificados, con palomita o sin ella', async () => {
  const b = await entrar('banquetes@ejemplo.example');
  afirma('no ve la pestaña', b.ve === false);

  const c = await p.evaluate(() => {
    state.usuarios.find(u => u.rol === 'banquetes').certificados = true;
    guardar();
    return { puede: puedeCertificados(), ve: puedeVer('certificados'),
             enSuPapel: rolVeCertificados('banquetes') };
  });
  afirma('la pestaña no está entre las de su papel', c.enSuPapel === false);
  afirma('ASÍ QUE NI CON LA PALOMITA LA VE', c.ve === false);
  await p.evaluate(() => {
    delete state.usuarios.find(u => u.rol === 'banquetes').certificados;
    guardar();
  });
});

/* --- 5 ---------------------------------------------------------------------
   La columna Cert. de Ajustes no puede mentir: si el papel ya los trae, la
   casilla tiene que verse prendida —y no dejarse apagar—. */
await bloque('5 · en Ajustes la casilla dice la verdad', async () => {
  await entrar('admin@ejemplo.example');
  const r = await p.evaluate(() => {
    vista = 'ajustes'; render();
    const fila = id => {
      const tr = document.querySelector(`#tUsr tr[data-u="${id}"]`);
      const c = tr && tr.querySelector('[data-uk="certificados"]');
      return c ? { marcada: c.checked, apagada: c.disabled } : null;
    };
    const tr5 = document.querySelector('#tUsr tr[data-u="u5"]');
    return { gerente: fila('u2'), ejecutivo: fila('u3'), banquetes: fila('u5'),
             rayaBanquetes: tr5
               ? (tr5.querySelector('td:nth-child(4) .hint') || {}).title || '' : '' };
  });
  afirma('la de gerencia sale prendida', r.gerente && r.gerente.marcada === true);
  afirma('Y NO SE PUEDE APAGAR', r.gerente && r.gerente.apagada === true);
  afirma('la del ejecutivo igual',
    r.ejecutivo && r.ejecutivo.marcada === true && r.ejecutivo.apagada === true);
  afirma('Y LA DE BANQUETES NO ES UNA CASILLA, ES UNA RAYA', r.banquetes === null);
  afirma('que dice por qué', /no lleva certificados/.test(r.rayaBanquetes || ''));
});

/* --- 6 ---------------------------------------------------------------------
   Y guardar no le escribe la llave a quien la trae por papel: una ficha que
   no la traía se vería editada y se volvería a subir entera, por nada. */
await bloque('6 · guardar no le inventa la llave a los de ventas', async () => {
  await entrar('');                     // sin nube el botón no se va a la red
  const r = await p.evaluate(async () => {
    vista = 'ajustes'; render();
    document.getElementById('bGuardarUsr').click();
    await new Promise(r => setTimeout(r, 300));
    return state.usuarios.map(u => ({ rol:u.rol, trae:('certificados' in u) }));
  });
  afirma('gerencia sigue sin la llave', !r.find(u => u.rol === 'gerente').trae);
  afirma('el ejecutivo también', !r.find(u => u.rol === 'ejecutivo').trae);
  afirma('y banquetes tampoco, que no la tenía', !r.find(u => u.rol === 'banquetes').trae);
});

/* --- 7 ---------------------------------------------------------------------
   «Se quitaron solos»: si la lista no sube, la pantalla tiene que decirlo en
   vez de un «Guardado ✓» que no era cierto. */
await bloque('7 · si el servidor rebota la lista, Guardar usuarios lo dice', async () => {
  rebotaUsuarios = true;
  dichos.length = 0;
  await entrar('admin@ejemplo.example');
  await p.evaluate(() => {
    vista = 'ajustes'; render();
    /* Se cambia algo de verdad para que haya qué subir, y se cambia EN LA
       PANTALLA: el botón lee la tabla, no la memoria. */
    const n = document.querySelector('#tUsr tr[data-u="u5"] [data-uk="nombre"]');
    n.value = 'Celia Mora Ruiz';
    document.getElementById('bGuardarUsr').click();
  });
  await p.waitForFunction(() => {
    const o = document.getElementById('usrOk');
    const b = document.getElementById('bGuardarUsr');
    return b && !b.disabled && (!o || o.textContent !== 'Guardando y subiendo…');
  }, null, { timeout:15000 });
  await p.waitForTimeout(600);

  afirma('AVISA QUE NO SUBIÓ', dichos.some(t => /NO SUBIÓ|NO ACEPTÓ/.test(t)));
  afirma('y dice que los demás equipos siguen con la de antes',
    dichos.some(t => /lista de antes/i.test(t)));
  const ok = await p.evaluate(() =>
    (document.getElementById('usrOk') || {}).textContent || '');
  afirma('Y NO DICE QUE SUBIÓ', !/subido/i.test(ok));
  afirma('y el servidor de verdad no la tiene',
    await p.evaluate(() => true) && !haySubidos());
});

/* --- 8 ---------------------------------------------------------------------
   Y cuando sí sube, lo dice y el servidor la tiene. */
await bloque('8 · cuando sube, lo dice y el servidor la tiene', async () => {
  rebotaUsuarios = false;
  dichos.length = 0;
  await p.evaluate(() => {
    vista = 'ajustes'; render();
    document.getElementById('bGuardarUsr').click();
  });
  await p.waitForFunction(() =>
    /Guardado y subido/.test((document.getElementById('usrOk') || {}).textContent || ''),
    null, { timeout:15000 });
  afirma('DICE QUE SUBIÓ', true);
  afirma('sin avisos de error', !dichos.some(t => /NO SUBIÓ|NO ACEPTÓ/.test(t)));
  afirma('Y EL SERVIDOR YA LA TIENE', haySubidos());
  afirma('con el nombre que se tecleó', traeNombre('Celia Mora Ruiz'));
});

function haySubidos(){
  return [...tabla.keys()].some(k => String(k).startsWith('usuarios:'));
}
function traeNombre(n){
  return [...tabla.values()].some(f =>
    String(f.id).startsWith('usuarios:') && f.datos && f.datos.nombre === n);
}

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
