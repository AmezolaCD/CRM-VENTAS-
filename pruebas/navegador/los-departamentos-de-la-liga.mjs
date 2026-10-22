/* ===========================================================================
   LOS DEPARTAMENTOS QUE VE LA LIGA DE LAS ÓRDENES

   Marco: «agregué un departamento para las ODTs y no me aparecen en la liga».

   La causa no era un error: el formulario que abren los jefes de área NO lee
   la tabla de Ajustes de esta computadora, se la pide al servidor —la función
   `crm_odt_jefes`, que lee el renglón de ajustes guardado en Supabase—. Un
   departamento recién escrito no existe para la liga hasta que ese renglón
   sube. Y el CRM no lo decía en ningún lado: estaba escrito en ODTS.md, que
   es justo donde no se lee cuando pasa.

   Así que ahora se puede preguntar. Lo que se cuida aquí:

   · la comparación en sí —qué le falta al servidor y qué le sobra—, que es lo
     único que el botón de verdad calcula;
   · que SE SUBA ANTES DE PREGUNTAR. Sin eso, el botón contestaría «le falta
     tu departamento» por la única razón que no importa: que todavía no sale
     de aquí, y mandaría a buscar el problema donde no está;
   · que pregunte CON LA MISMA FUNCIÓN que usa el formulario. Dos caminos
     distintos acabarían contestando cosas distintas, y entonces el botón no
     serviría para averiguar nada: sería una tercera opinión;
   · y que cuando no se pueda saber, lo diga y diga por qué —y en particular
     que distinga «falta correr odts.sql» de «el servidor no contestó», que se
     arreglan de maneras muy distintas.

   Cómo correrla:  node pruebas/navegador/los-departamentos-de-la-liga.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8835;
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
  guardar();
});

/* --- 1 --------------------------------------------------------------------
   La comparación, sola. Es lo único que el botón calcula; lo demás es
   preguntar y pintar. */
await bloque('1 · qué le falta al servidor y qué le sobra', async () => {
  const r = await p.evaluate(() => {
    const aqui = [{ depto:'SPA', jefe:'A' }, { depto:'Ama de llaves', jefe:'B' },
                  { depto:'Alimentos y Bebidas', jefe:'C' }];
    return {
      iguales:  difieren(aqui, aqui),
      leFalta:  difieren(aqui, aqui.slice(0, 2)),
      leSobra:  difieren(aqui.slice(0, 2), aqui),
      mayus:    difieren([{ depto:'spa' }], [{ depto:'  SPA  ' }]),
      vacio:    difieren(aqui, []),
      nada:     difieren([], [])
    };
  });
  afirma('listas iguales no reportan nada',
    !r.iguales.faltan.length && !r.iguales.sobran.length);
  afirma('EL QUE FALTA SE NOMBRA, que es lo que se quiere saber',
    r.leFalta.faltan.length === 1 && r.leFalta.faltan[0] === 'Alimentos y Bebidas');
  afirma('y el que sobra también: un departamento que aquí ya se quitó\n' +
         '       sigue ofreciéndose en la liga hasta que suba',
    r.leSobra.sobran.length === 1 && r.leSobra.sobran[0] === 'Alimentos y Bebidas');
  afirma('las mayúsculas y los espacios no inventan diferencias',
    !r.mayus.faltan.length && !r.mayus.sobran.length);
  afirma('un servidor vacío reporta los tres', r.vacio.faltan.length === 3);
  afirma('y sin nada de los dos lados no truena',
    !r.nada.faltan.length && !r.nada.sobran.length);
});

/**
 * Abre Ajustes con la nube fingida, pone la tabla de departamentos que se le
 * pida y le dice al servidor de mentiras qué contestar. Devuelve lo que el
 * botón acaba escribiendo en pantalla, y en qué orden hizo las cosas.
 */
const preguntar = (aqui, respuesta) => p.evaluate(async ({ a, resp }) => {
  state.ajustes.hotel.jefes = saneaJefes(a);
  state.ajustes.hotel.tokenOdt = 'token-de-mentiras-0001';
  guardar();

  /* El orden importa y por eso se anota: subir va ANTES de preguntar. */
  const orden = [];
  window.sincronizar   = async () => { orden.push('subir'); };
  window.jefesDeLaLiga = async (token) => {
    orden.push('preguntar:' + token);
    return resp;
  };

  renderAjustes();
  document.querySelector('#bVerJefes').click();
  /* El manejador es asíncrono: se espera a que deje de decir que está
     preguntando. */
  for (let i = 0; i < 60; i++){
    await new Promise(r => setTimeout(r, 50));
    const t = document.querySelector('#loQueVeLaLiga').innerText;
    if (t && !/preguntándole al servidor/i.test(t)) break;
  }
  const caja = document.querySelector('#loQueVeLaLiga');
  return { texto: caja.innerText, borde: caja.querySelector('.note')?.style.borderLeft || '',
           orden };
}, { a: aqui, resp: respuesta });

const TRES = [{ depto:'SPA', jefe:'Nombre Uno' },
              { depto:'Ama de llaves', jefe:'Nombre Dos' },
              { depto:'Alimentos y Bebidas', jefe:'Nombre Tres' }];

/* --- 2 -------------------------------------------------------------------- */
await bloque('2 · cuando la liga ya ve lo mismo, lo dice en verde', async () => {
  const r = await preguntar(TRES, { lista: TRES, motivo:'' });
  afirma('dice que ya ve los mismos', /ya ve los mismos 3 departamentos/i.test(r.texto));
  afirma('y en verde', /var\(--ok\)/.test(r.borde));
  /* La trampa que queda después de que todo está bien: la pestaña abierta
     desde antes. El formulario baja la lista UNA vez, al abrirse. */
  afirma('AVISA DE LA PESTAÑA YA ABIERTA, que es lo que queda por fallar',
    /vuelva a abrir/i.test(r.texto));
});

/* --- 3 --------------------------------------------------------------------
   El caso de Marco, exacto. */
await bloque('3 · cuando le falta el departamento nuevo, lo nombra', async () => {
  const r = await preguntar(TRES, { lista: TRES.slice(0, 2), motivo:'' });
  afirma('dice que todavía no ve lo mismo', /todav[íi]a no ve lo mismo/i.test(r.texto));
  afirma('Y DICE CUÁL LE FALTA, por su nombre',
    /Le faltan: Alimentos y Bebidas/i.test(r.texto));
  afirma('en ámbar, que no es un error sino algo en camino', /var\(--warn\)/.test(r.borde));
  afirma('y sugiere volver a intentar, porque la subida pudo seguir en camino',
    /otra vez en un momento/i.test(r.texto));
});

/* --- 4 --------------------------------------------------------------------
   El que aquí se quitó y allá sigue vivo: mientras no suba, los jefes de área
   lo siguen viendo en el desplegable y pueden pedir a su nombre. */
await bloque('4 · y también lo que la liga sigue ofreciendo de más', async () => {
  const r = await preguntar(TRES.slice(0, 2), { lista: TRES, motivo:'' });
  afirma('avisa de lo que sigue ofreciendo',
    /sigue ofreciendo: Alimentos y Bebidas/i.test(r.texto));
  afirma('y dice que aquí ya no está', /aqu[íi] ya no est[áa]/i.test(r.texto));
});

/* --- 5 --------------------------------------------------------------------
   Los dos motivos que se arreglan de maneras distintas no se pueden decir
   igual: uno manda a correr un archivo, el otro a volver a intentar. */
await bloque('5 · cuando no se puede saber, dice por qué', async () => {
  const sin = await preguntar(TRES, { lista:[], motivo:'sin-funcion' });
  afirma('falta odts.sql: lo dice con el nombre del archivo',
    /odts\.sql/i.test(sin.texto) && /var\(--bad\)/.test(sin.borde));

  const mudo = await preguntar(TRES, { lista:[], motivo:'sin-respuesta' });
  afirma('y un servidor que no contestó NO se confunde con eso',
    !/odts\.sql/i.test(mudo.texto) && /vuelve a intentarlo/i.test(mudo.texto));

  const solo = await preguntar(TRES, { lista:[], motivo:'sin-nube' });
  afirma('sin nube dice que no hay liga que revisar',
    /no hay liga que revisar/i.test(solo.texto));
});

/* --- 6 --------------------------------------------------------------------
   Lo que hace que el botón sirva de algo. */
await bloque('6 · sube antes de preguntar, y pregunta con el token de la liga', async () => {
  const r = await preguntar(TRES, { lista: TRES, motivo:'' });
  afirma('SUBE PRIMERO Y PREGUNTA DESPUÉS',
    r.orden[0] === 'subir' && /^preguntar:/.test(r.orden[1] || ''));
  afirma('y pregunta con el token de la liga, no con otra cosa',
    r.orden[1] === 'preguntar:token-de-mentiras-0001');
  afirma('una sola pregunta por clic', r.orden.length === 2);
});

/* --- 7 --------------------------------------------------------------------
   El grupo de control. Si el botón preguntara por su cuenta en vez de usar la
   misma función del formulario, podría contestar que todo está bien mientras
   el jefe de área ve otra cosa. */
await bloque('7 · es la MISMA función que usa el formulario', async () => {
  const src = fs.readFileSync(APP, 'utf8');
  const i = src.indexOf('#bVerJefes").onclick');
  const trozo = src.slice(i, i + 2200);
  afirma('el botón llama a jefesDeLaLiga', /jefesDeLaLiga\(/.test(trozo));
  afirma('y NO se arma su propia consulta al servidor',
    !/crm_odt_jefes/.test(trozo) && !/rest\/v1/.test(trozo));
  afirma('el formulario de la liga sigue llamando a la misma',
    /jefesDeLaLiga\(datos\.token\)/.test(src));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
