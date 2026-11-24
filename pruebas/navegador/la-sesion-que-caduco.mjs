/* ===========================================================================
   UNA SESIÓN CADUCADA TIENE QUE VOLVER A PEDIR LA CONTRASEÑA

   A una ejecutiva del hotel le pasó esto durante DOS MESES. Su último inicio de
   sesión con contraseña fue el 28 de septiembre; su refresh token murió, y el
   servidor de cuentas llevaba semanas contestando 400 a cada intento de
   renovar. `renovarSesion()` devolvía `false` y dejaba la sesión muerta puesta,
   y como `candado()` sólo echa el cerrojo cuando NO hay sesión, su CRM no le
   volvió a pedir la contraseña ni una vez. Se quedó mirando un tablero en
   ceros, con una sesión que no servía, hablando con un servidor que la
   rechazaba.

   Encima se le decía lo que no era: la detección del «reloj del servidor»
   miraba el código `PGRST303`, que es el de CUALQUIER fallo de validación de
   claims —también el de una sesión caducada—, así que la pantalla anunciaba
   que el servidor del hotel no estaba recibiendo. El servidor estaba perfecto.

   Lo que se afirma aquí:

   1. Con la renovación rechazada, la sesión se suelta y sale la pantalla de
      entrar.
   2. Y NO se borra nada de lo que hay en este equipo.
   3. La pantalla dice que la sesión caducó: ni que la contraseña esté mal, ni
      que el servidor esté caído.
   4. Si lo que falla es la RED —no el servidor de cuentas—, la sesión NO se
      suelta: sin internet se sigue trabajando.
   5. Un 401 de sesión caducada ya no se confunde con el reloj del servidor.
   6. Sin nada local, no se abre un CRM vacío detrás de la banda roja: se pide
      la contraseña.
   7. Grupo de control: el reloj de verdad, con datos en el equipo, sigue
      abriendo el CRM con su banda.

   Cómo correrla:  node pruebas/navegador/la-sesion-que-caduco.mjs
   Con APP_HTML se le apunta a otra copia del index.html.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8902;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

/* Cómo contesta el servidor de cuentas a «renóvame la sesión»:
   'rechaza' → 400, el refresh token está muerto (el caso de verdad)
   'ok'      → 200 con una sesión nueva                                     */
let renovar = 'rechaza';
/* Y qué contesta el de datos: 'caducado' | 'futuro'                        */
let rechazoDatos = 'caducado';

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/auth/v1/token'){
    if (u.search.includes('refresh_token') && renovar === 'rechaza'){
      res.writeHead(400, cors);
      return res.end('{"error":"invalid_grant","error_description":"Invalid Refresh Token"}');
    }
    res.writeHead(200, cors);
    return res.end(JSON.stringify({ access_token:'pase-nuevo', refresh_token:'otro',
      token_type:'bearer', expires_in:3600, user:{ id:'u1', email:'alguien@ejemplo.example' } }));
  }
  if (u.pathname.startsWith('/rest/v1/')){
    res.writeHead(401, cors);
    /* Tal cual los manda PostgREST: el MISMO código para los dos casos, que es
       justo lo que hacía indistinguibles una sesión vencida y un reloj roto. */
    return res.end(rechazoDatos === 'futuro'
      ? '{"code":"PGRST303","message":"JWT claims validation or parsing failed",' +
        '"details":"issued at future","hint":null}'
      : '{"code":"PGRST303","message":"JWT claims validation or parsing failed",' +
        '"details":"JWT expired","hint":null}');
  }
  res.writeHead(200, cors); res.end('[]');
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
const ctx = await br.newContext({ viewport:{ width:1100, height:900 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
p.on('dialog', d => d.dismiss().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof renovarSesion === 'function', null, { timeout:15000 });

/** Un equipo con sesión guardada y con trabajo dentro, como el de cualquiera. */
const prepararEquipo = (conDatos = true) => p.evaluate(([url, conDatos]) => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  document.body.classList.remove('sin-sesion');
  window.fetch = window.__fetch || (window.__fetch = window.fetch);
  nube.url = url; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'pase-viejo', refresh_token:'muerto',
                  user:{ email:'alguien@ejemplo.example' } };
  nube.enlazado = true; nube.estado = 'listo'; nube.trabajoSinServidor = false;
  state.clientes = conDatos ? [saneaCliente({ id:'c1', empresa:'CLIENTE DE ESTE EQUIPO SA',
    contacto:'Alguien', telefono:'6640000000', email:'uno@ejemplo.example',
    estatus:'prospecto' })] : [];
  state.convenios = []; state.actividades = []; state.contratos = [];
  state.huespedes = []; state.eventos = [];
  guardar();
}, [`http://127.0.0.1:${PUERTO}`, conDatos]);

/** Pide algo a los datos y cuenta cómo quedó la pantalla. */
const pedirDatos = () => p.evaluate(async () => {
  let error = '';
  try{ await api('/rest/v1/crm_datos?select=id&limit=1'); }
  catch(ex){ error = ex.message; }
  await new Promise(r => setTimeout(r, 200));
  const caja = document.querySelector('#errEntrar');
  return { error, sesion: !!nube.sesion, estado: nube.estado,
           entrada: !!document.getElementById('entrada'),
           dice: caja ? caja.innerText : '',
           clientes: state.clientes.length,
           guardado: !!JSON.parse(localStorage.getItem('crm-hotel-sesion') || 'null') };
});

await bloque('1 · la sesión que el servidor ya no renueva se suelta', async () => {
  renovar = 'rechaza'; rechazoDatos = 'caducado';
  await prepararEquipo();
  const r = await pedirDatos();
  afirma('la sesión muerta se soltó',        r.sesion === false);
  afirma('y también en el navegador',        r.guardado === false);
  afirma('sale la pantalla de entrar',       r.entrada === true);
  afirma('y el CRM no se queda en «sin servidor»', r.estado !== 'sinServidor');
});

await bloque('2 · no se borra nada de este equipo', async () => {
  const quedan = await p.evaluate(() => state.clientes.length);
  afirma('el cliente capturado sigue aquí',  quedan === 1);
});

await bloque('3 · y se dice lo que pasó, que es lo único que hacía falta', async () => {
  const dice = await p.evaluate(() => (document.querySelector('#errEntrar') || {}).innerText || '');
  afirma('dice que la sesión caducó',        /sesi[óo]n caduc/i.test(dice));
  afirma('y que basta volver a escribir la contraseña',
    /vuelve a escribir tu contrase[ñn]a/i.test(dice));
  afirma('NO dice que la contraseña esté mal',
    !/contrase[ñn]a incorrect/i.test(dice));
  afirma('NO culpa al servidor de datos',    !/servidor de datos/i.test(dice));
  afirma('y tranquiliza sobre lo capturado', /no se perdi[óo] nada/i.test(dice));
});

await bloque('4 · si lo que falla es la red, la sesión NO se suelta', async () => {
  await prepararEquipo();
  const r = await p.evaluate(async () => {
    const antes = window.fetch;
    // El servidor de cuentas no contesta: eso es estar sin internet, no un rechazo.
    window.fetch = (u, o) => String(u).includes('/auth/v1/token')
      ? Promise.reject(new Error('sin red')) : antes(u, o);
    try{ await api('/rest/v1/crm_datos?select=id&limit=1'); }catch(ex){}
    window.fetch = antes;
    return { sesion: !!nube.sesion, clientes: state.clientes.length };
  });
  afirma('la sesión se conserva',            r.sesion === true);
  afirma('y lo del equipo también',          r.clientes === 1);
});

await bloque('5 · una sesión caducada ya no se confunde con el reloj del servidor', async () => {
  const v = await p.evaluate(() => ({
    caducada: fallaDeRelojDelServidor('401 · JWT claims validation or parsing failed · PGRST303 · JWT expired'),
    futuro:   fallaDeRelojDelServidor('401 · JWT claims validation or parsing failed · PGRST303 · issued at future'),
    codigoSolo: fallaDeRelojDelServidor('401 · PGRST303')
  }));
  afirma('«expired» NO es el reloj',         v.caducada === false);
  afirma('«issued at future» SÍ lo es',      v.futuro === true);
  afirma('y el código a secas ya no basta',  v.codigoSolo === false);
});

await bloque('6 · sin nada local, no se abre un CRM vacío detrás de la banda', async () => {
  await prepararEquipo(false);                 // equipo sin un solo registro
  const r = await p.evaluate(async () => {
    abrirSinServidor('401 · PGRST303 · issued at future');
    await new Promise(r => setTimeout(r, 200));
    const b = document.getElementById('bandaServidor');
    return { entrada: !!document.getElementById('entrada'),
             banda: !!(b && !b.hidden), estado: nube.estado };
  });
  afirma('se pide la contraseña',            r.entrada === true);
  afirma('y NO se enseña un tablero en ceros con la banda', r.banda === false);
});

await bloque('7 · grupo de control: con datos en el equipo, el reloj sí abre el CRM', async () => {
  await prepararEquipo(true);
  const r = await p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    abrirSinServidor('401 · PGRST303 · issued at future');
    await new Promise(r => setTimeout(r, 200));
    const b = document.getElementById('bandaServidor');
    return { entrada: !!document.getElementById('entrada'),
             banda: !!(b && !b.hidden), estado: nube.estado };
  });
  afirma('se entra a trabajar',              r.entrada === false);
  afirma('con la banda a la vista',          r.banda === true);
  afirma('y el CRM sabe en qué situación está', r.estado === 'sinServidor');
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
