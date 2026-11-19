/* ===========================================================================
   UN RENGLÓN RECHAZADO NO SE REENVÍA PARA SIEMPRE

   Medido en el servidor del hotel: 25 900 peticiones rechazadas en un día desde
   UNA sola sesión, y después 4 697 en cuarenta minutos entre dos equipos. El
   90 % del tráfico del proyecto era el CRM reenviando, cada quince segundos y
   desde octubre, los mismos renglones que el servidor ya le había dicho que no.

   La causa es sencilla: un renglón rechazado no se marca como sincronizado —con
   razón, no subió—, así que vuelve a salir en la lista de cambios de la vuelta
   siguiente. Y en la siguiente. Nadie lo veía: el chip decía «Falta subir N» y
   ya.

   Lo que se afirma aquí:

   1. Con varias sincronizaciones seguidas, el servidor recibe UN intento de ese
      renglón, no uno por vuelta.
   2. Y se sigue contando: «Falta subir 1» no desaparece por estar frenado. Un
      renglón frenado no es un renglón olvidado.
   3. El freno no le estorba a lo demás: lo que sí puede subir, sube.
   4. Editar el renglón suelta el freno en el acto.
   5. «Volver a intentar» intenta de verdad, en ese momento.
   6. Cuando el servidor lo acepta, el freno se olvida.
   7. La espera crece: el segundo rechazo espera más que el primero.

   Cómo correrla:  node pruebas/navegador/el-freno-del-reintento.mjs
   Con APP_HTML se le apunta a otra copia del index.html, que es como se
   comprueba que esta prueba de verdad atrapa algo.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8898;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

/* El servidor rechaza al cliente «malo» con la regla de fila, como PostgREST, y
   acepta todo lo demás. `seArregla` simula que le componen el permiso. */
let seArregla = false;
const intentos = [];               // cada id que el servidor vio llegar

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/rest/v1/crm_datos'){
    if (req.method !== 'POST'){ res.writeHead(200, cors); return res.end('[]'); }
    let cuerpo = '';
    req.on('data', t => cuerpo += t);
    req.on('end', () => {
      let filas = [];
      try{ filas = JSON.parse(cuerpo); }catch(e){}
      for (const f of filas) intentos.push(f.id);
      const malo = filas.some(f => f.id === 'clientes:malo');
      if (malo && !seArregla){
        res.writeHead(403, cors);
        return res.end('{"code":"42501","message":"new row violates row-level security ' +
                       'policy for table \\"crm_datos\\"","details":null,"hint":null}');
      }
      res.writeHead(201, cors); res.end('');
    });
    return;
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
const ctx = await br.newContext({ viewport:{ width:900, height:800 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout: 15000 });

/** Deja el equipo con un cliente que el servidor acepta y otro que rechaza. */
const preparar = async () => {
  seArregla = false;
  await p.evaluate(url => {
    nube.url = url; nube.anon = 'llave-de-mentiras';
    nube.sesion = { access_token:'ficticio' };
    nube.enlazado = true; nube.ultimo = ''; nube.estado = 'listo';
    sincronizado = new Map();
    if (typeof soltarElFreno === 'function') soltarElFreno();
    /* Esperas cortas, para no tardar una hora de reloj en comprobar una hora de
       espera. Es el mismo mecanismo, con otros números. */
    if (typeof ESPERAS !== 'undefined') ESPERAS.splice(0, ESPERAS.length, 250, 100000);
    state.clientes = [
      saneaCliente({ id:'bueno', empresa:'CLIENTE QUE SÍ SUBE SA', contacto:'Alguien',
        telefono:'6640000001', email:'uno@ejemplo.example', estatus:'prospecto' }),
      saneaCliente({ id:'malo',  empresa:'CLIENTE QUE EL SERVIDOR RECHAZA SA', contacto:'Otro',
        telefono:'6640000002', email:'dos@ejemplo.example', estatus:'prospecto' })
    ];
    state.actividades = []; state.convenios = []; state.huespedes = [];
    guardar();
  }, `http://127.0.0.1:${PUERTO}`);
};

/** Sincroniza n veces seguidas, como el sondeo cada quince segundos. */
const vueltas = n => p.evaluate(async k => {
  for (let i = 0; i < k; i++) await sincronizar();
  return { faltan: nube.rechazados.length, estado: nube.estado };
}, n);

const cuantosIntentos = id => intentos.filter(x => x === id).length;

await bloque('1 · el renglón rechazado no se reenvía en cada vuelta', async () => {
  await preparar();
  intentos.length = 0;
  await vueltas(10);
  afirma(`el servidor lo vio UNA vez, no diez (lo vio ${cuantosIntentos('clientes:malo')})`,
    cuantosIntentos('clientes:malo') === 1);
});

await bloque('2 · pero se sigue contando: frenado no es olvidado', async () => {
  const r = await vueltas(1);
  afirma('sigue diciendo que falta subir uno', r.faltan === 1);
  afirma('y el CRM lo sabe', r.estado === 'rechazado');
  const dice = await p.evaluate(() => nube.rechazados[0]);
  afirma('con el motivo del servidor',   /row-level security|42501/i.test(dice.motivo || ''));
  afirma('y con cuándo se vuelve a intentar', !!dice.hasta);
});

await bloque('3 · el freno no le estorba a lo demás', async () => {
  intentos.length = 0;
  await p.evaluate(() => {
    state.clientes.push(saneaCliente({ id:'nuevo', empresa:'CAPTURADO DESPUÉS SA',
      contacto:'Alguien', telefono:'6640000003', email:'tres@ejemplo.example',
      estatus:'prospecto' }));
    guardar();
  });
  await vueltas(1);
  afirma('el cliente nuevo subió',       cuantosIntentos('clientes:nuevo') === 1);
  afirma('y el frenado no se reintentó', cuantosIntentos('clientes:malo')  === 0);
});

await bloque('4 · editarlo suelta el freno en el acto', async () => {
  intentos.length = 0;
  await p.evaluate(() => {
    const c = state.clientes.find(x => x.id === 'malo');
    c.notas = 'alguien lo corrigió';
    guardar();
  });
  await vueltas(1);
  /* Se mira «lo intentó o no», no cuántas veces: cuando el renglón rechazado es
     el primero del lote, `subir` lo usa además como sonda de la columna
     `duenio` y lo manda dos veces. Eso es de antes y no es lo que aquí se
     prueba. */
  afirma(`se intentó de inmediato, sin esperar (intentos: ${cuantosIntentos('clientes:malo')})`,
    cuantosIntentos('clientes:malo') >= 1);
});

await bloque('5 · «Volver a intentar» intenta de verdad', async () => {
  intentos.length = 0;
  await vueltas(1);
  afirma('estando frenado, no se intenta solo', cuantosIntentos('clientes:malo') === 0);
  await p.evaluate(async () => { soltarElFreno(); await sincronizar(); });
  afirma(`al pedirlo a mano, sí (intentos: ${cuantosIntentos('clientes:malo')})`,
    cuantosIntentos('clientes:malo') >= 1);
});

await bloque('6 · cuando el servidor lo acepta, el freno se olvida', async () => {
  intentos.length = 0;
  seArregla = true;                      // le arreglaron el permiso
  await p.evaluate(() => { soltarElFreno(); });
  const r = await vueltas(1);
  afirma('subió',                        cuantosIntentos('clientes:malo') >= 1);
  afirma('ya no falta nada por subir',   r.faltan === 0);
  afirma('y el CRM queda al día',        r.estado === 'listo');
  afirma('sin dejar el freno puesto',
    await p.evaluate(() => frenados.size) === 0);
  seArregla = false;
});

await bloque('7 · la espera crece con cada rechazo', async () => {
  await preparar();
  const esperas = await p.evaluate(async () => {
    /* Dos rechazos seguidos, soltando el freno en medio para forzar el segundo
       intento: la segunda espera tiene que ser más larga que la primera. */
    ESPERAS.splice(0, ESPERAS.length, 1000, 60000);
    await sincronizar();
    const primera = frenados.get('clientes:malo').hasta - Date.now();
    frenados.get('clientes:malo').hasta = 0;      // ya le tocaba
    await sincronizar();
    const segunda = frenados.get('clientes:malo').hasta - Date.now();
    return { primera, segunda, veces: frenados.get('clientes:malo').veces };
  });
  afirma(`la segunda espera es más larga (${Math.round(esperas.primera)} → ${Math.round(esperas.segunda)} ms)`,
    esperas.segunda > esperas.primera);
  afirma('y lleva la cuenta de los rechazos', esperas.veces === 2);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
