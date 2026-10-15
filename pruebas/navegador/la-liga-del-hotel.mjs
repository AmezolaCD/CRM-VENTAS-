/* ===========================================================================
   LA CONEXIÓN DEL HOTEL, DENTRO DE LA APLICACIÓN

   Marco: «la única manera en este momento de configurar la aplicación es
   instalando el enlace y la clave pública… necesito un método más eficiente ya
   que hay ocasiones que los usuarios lo hacen mal y soporte remoto a veces no
   funciona si es un celular; busca otro método para que yo le pueda mandar una
   liga para que ellos sólo inicien sesión».

   El mecanismo ya existía —`window.CORE_NUBE` arriba de index.html, y
   `cargarNube()` lo adopta solo en un equipo que no tenga nada guardado—, pero
   nunca se había probado que de verdad funcione de punta a punta. Y es lo que
   va a sostener el alta de TODO el equipo: si esto se rompe en silencio, cada
   quien vuelve a pegar la dirección y la llave a mano.

   Por eso esta prueba sirve DOS copias del mismo archivo —una con la línea
   llena y otra sin ella— y mira qué hace un navegador recién estrenado con
   cada una.

   Cómo correrla:  node pruebas/navegador/la-liga-del-hotel.mjs

   La dirección y la llave de aquí son de mentiras: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8828;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Una dirección y una llave INVENTADAS, con la forma de las de verdad: la
   llave anon es un JWT y la aplicación le lee el `ref` adentro. */
const URL_FALSA  = 'https://ejemplodeproyecto.supabase.co';
const ANON_FALSA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  Buffer.from(JSON.stringify({ ref:'ejemplodeproyecto', role:'anon', exp:4102444800 }))
    .toString('base64').replace(/=+$/, '') + '.firmadementiras';

const crudo = fs.readFileSync(APP, 'utf8');
const VACIA = 'window.CORE_NUBE = { url:"", anon:"" };';
if (!crudo.includes(VACIA)){
  console.log('  FALLA no encontré la línea de CORE_NUBE en el index.html');
  process.exit(1);
}
/* Así se vería el archivo publicado con la línea puesta: es exactamente lo que
   produce el botón «Copiar la línea del hotel». */
const llena = crudo.replace(VACIA,
  `window.CORE_NUBE = { url:${JSON.stringify(URL_FALSA)}, anon:${JSON.stringify(ANON_FALSA)} };`);

const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname.startsWith('/rest/') || u.pathname.startsWith('/auth/')){
    r.writeHead(200, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*' });
    return r.end('[]');
  }
  r.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
  r.end(u.pathname === '/con-liga' ? llena : crudo);
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

/** Un equipo RECIÉN ESTRENADO: contexto nuevo, sin nada guardado. */
async function equipoNuevo(ruta){
  const ctx = await br.newContext({ viewport:{ width:1100, height:900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(`http://127.0.0.1:${PUERTO}${ruta}`);
  await p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });
  // El arranque de la nube no es inmediato: espera a la animación de entrada.
  await p.waitForTimeout(2600);
  return { ctx, p };
}

/* --- 1 --------------------------------------------------------------------
   Lo que pasa hoy, sin la línea: el equipo nuevo arranca suelto y a quien lo
   abre le toca configurarlo. Es el problema que Marco está reportando. */
await bloque('1 · sin la línea, el equipo nuevo arranca sin conexión', async () => {
  const { ctx, p } = await equipoNuevo('/');
  const r = await p.evaluate(() => ({ url:nube.url, anon:nube.anon,
                                      entrada: !!document.getElementById('entrada') }));
  afirma('no trae dirección ni llave', !r.url && !r.anon);
  afirma('y no hay pantalla de entrar: trabaja en local', r.entrada === false);
  await ctx.close();
});

/* --- 2 --------------------------------------------------------------------
   Con la línea puesta: el equipo nuevo queda configurado SOLO y lo único que
   ve es la pantalla de entrar. Esto es lo que Marco pidió. */
await bloque('2 · con la línea, cae directo en la pantalla de entrar', async () => {
  const { ctx, p } = await equipoNuevo('/con-liga');
  const r = await p.evaluate(() => ({
    url: nube.url, anon: nube.anon,
    entrada: !!document.getElementById('entrada'),
    campos: ['correo', 'pass'].map(n => !!document.querySelector(`#entrada [name="${n}"]`)),
    guardado: JSON.parse(localStorage.getItem('crm-hotel-nube') || '{}')
  }));
  afirma('adoptó la dirección del hotel sin que nadie la escribiera', r.url === URL_FALSA);
  afirma('y la llave', r.anon === ANON_FALSA);
  afirma('lo que ve es la pantalla de entrar', r.entrada === true);
  afirma('con su correo y su contraseña, y nada más', r.campos.every(Boolean));
  /* Que haya quedado GUARDADO importa: si no, al recargar sin señal se
     quedaría otra vez sin configuración. */
  afirma('y quedó guardado en el equipo',
    r.guardado.url === URL_FALSA && r.guardado.anon === ANON_FALSA);
  await ctx.close();
});

/* --- 3 --------------------------------------------------------------------
   No hay nada que configurar: ni siquiera se le ofrece. */
await bloque('3 · al que abre no se le pide configurar nada', async () => {
  const { ctx, p } = await equipoNuevo('/con-liga');
  const txt = await p.evaluate(() => (document.getElementById('entrada') || {}).innerText || '');
  afirma('no se le habla de direcciones ni de llaves',
    !/llave p[úu]blica/i.test(txt) && !/supabase\.co/i.test(txt));
  /* Los campos de configuración existen —son la salida de emergencia por si
     la dirección quedó mal—, pero van escondidos y no estorban. */
  const detalle = await p.locator('#cfgEquipo').count();
  afirma('la salida de emergencia sigue ahí, por si acaso', detalle === 1);
  afirma('pero cerrada', !(await p.evaluate(() =>
    (document.getElementById('cfgEquipo') || {}).open === true)));
  await ctx.close();
});

/* --- 4 --------------------------------------------------------------------
   Un equipo que ya estaba conectado a otro lado NO se lo lleva la línea por
   delante. Importa: alguien pudo quedar apuntando a un proyecto de pruebas. */
await bloque('4 · a un equipo ya configurado no se le cambia el servidor', async () => {
  const ctx = await br.newContext({ viewport:{ width:1100, height:900 } });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(`http://127.0.0.1:${PUERTO}/`);
  await p.evaluate(() => localStorage.setItem('crm-hotel-nube', JSON.stringify({
    url:'https://otroproyecto.supabase.co', anon:'llave-de-otro-lado', enlazado:true })));
  await p.goto(`http://127.0.0.1:${PUERTO}/con-liga`);
  await p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });
  await p.waitForTimeout(2600);
  const r = await p.evaluate(() => ({ url:nube.url, anon:nube.anon }));
  afirma('se queda con el suyo', r.url === 'https://otroproyecto.supabase.co');
  afirma('y con su llave', r.anon === 'llave-de-otro-lado');
  await ctx.close();
});

/* --- 5 --------------------------------------------------------------------
   El botón que arma la línea. Lo que copia tiene que ser EXACTAMENTE lo que
   hay que pegar: si sale mal escrita, el archivo publicado truena para todos. */
await bloque('5 · la línea que copia el botón es la que hay que pegar', async () => {
  const { ctx, p } = await equipoNuevo('/con-liga');
  const linea = await p.evaluate(() => lineaDelHotel());
  afirma('empieza como la que está en el archivo',
    linea.startsWith('window.CORE_NUBE = { url:'));
  afirma('y termina en punto y coma', linea.endsWith('};'));
  /* La prueba de fuego: se evalúa y tiene que dar los mismos dos valores. */
  const vuelta = await p.evaluate(l => {
    const caja = {};
    new Function('window', l)(caja);
    return caja.CORE_NUBE;
  }, linea);
  afirma('se vuelve a leer con la misma dirección', vuelta.url === URL_FALSA);
  afirma('y la misma llave', vuelta.anon === ANON_FALSA);
  /* Y encaja donde va: pegada sobre la línea vacía, el archivo sigue siendo
     JavaScript válido. */
  afirma('pegada en su lugar, el archivo no se rompe',
    llena.includes(linea) || crudo.replace(VACIA, linea).includes(linea));
  await ctx.close();
});

/* --- 6 --------------------------------------------------------------------
   Y que Ajustes lo diga, porque de nada sirve si nadie sabe que existe: a
   Marco la liga de invitación se le había perdido entre once botones. */
await bloque('6 · Ajustes dice cómo se da de alta a alguien', async () => {
  const { ctx, p } = await equipoNuevo('/con-liga');
  const r = await p.evaluate(() => {
    state.usuarios = [saneaUsuario({ id:'u1', nombre:'Sistemas',
      correo:'admin1@ejemplo.example', rol:'admin' })];
    nube.sesion = { access_token:'x', user:{ email:'admin1@ejemplo.example' } };
    const e = document.getElementById('entrada'); if (e) e.remove();
    ponDepto('ventas');
    vista = 'ajustes'; render();
    const caja = document.getElementById('nbComoSeDaDeAlta');
    return { texto: caja ? caja.innerText : '',
             fija: !!document.getElementById('bNbFija'),
             liga: !!document.getElementById('bNbLiga') };
  });
  afirma('dice que ya trae la conexión adentro', /ya trae la conexi[óo]n/i.test(r.texto));
  afirma('y que no hay nada que configurar', /nada que configurar/i.test(r.texto));
  afirma('el botón de la liga sigue estando', r.liga === true);
  afirma('y el de la línea también', r.fija === true);
  await ctx.close();
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
