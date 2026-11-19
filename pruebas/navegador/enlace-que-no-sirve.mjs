/* ===========================================================================
   LO QUE SE LE DICE A LA GENTE CUANDO ALGO DEL SERVIDOR NO SIRVE

   Dos historias de verdad, las dos del mismo tipo: el servidor no puede hacer
   algo y el CRM no lo decía, o lo decía de una manera que mandaba a buscar el
   problema donde no estaba.

   NO SE REPARTE UN ENLACE DE FIRMA QUE NO VA A FUNCIONAR

   Un cliente de verdad leyó su convenio, lo firmó con el dedo y al mandarlo le
   salió un error de base de datos: al servidor le faltaba la regla que lo deja
   depositar su firma. El ejecutivo le había mandado un enlace que NUNCA pudo
   funcionar, y no había forma de saberlo hasta que el cliente se topó con eso.

   Lo que se afirma aquí:

   1. `buzonMontado()` dice la verdad: falso cuando el servidor contesta 404
      —ni siquiera existe la pregunta, así que firmas.sql no se ha corrido— y
      falso cuando contesta que la regla no está.
   2. Cuando el servidor SÍ lo tiene montado, dice que sí.
   3. Si se cae la red NO estorba: un ejecutivo sin señal no se queda sin poder
      mandar su enlace.
   4. Y lo que importa: al mandarle el convenio al cliente, si el buzón no está
      montado el ejecutivo ve el aviso y **no se le ofrece el enlace**. Sólo el
      PDF, que sí funciona.

   «401 · JWT ISSUED AT FUTURE» NO ES UNA CONTRASEÑA MALA (bloques 6 a 8)

   A la gerente de ventas la pantalla de acceso le soltó ese renglón y nos
   pasamos la tarde buscando un problema de contraseña. No lo era: su contraseña
   fue aceptada y el que rechazaba el pase era el servidor de datos, con el reloj
   atrasado cerca de una hora, así que un pase recién emitido le parecía venir
   del futuro. Lo que se afirma:

   5. Con el servidor contestando 401 y `PGRST303 … issued at future`, la
      pantalla de acceso NO dice «contraseña incorrecta», NO enseña el error
      crudo, y no deja a nadie plantado en la puerta: la contraseña fue
      aceptada, así que entra y trabaja con lo de su equipo. Lo que ve adentro
      se comprueba en `trabajar-sin-servidor.mjs`.
   6. Grupo de control: un 401 de credenciales malas sigue diciendo lo de
      siempre.
   7. Y el código del servidor llega hasta aquí: `message` de PostgREST es
      siempre la misma frase genérica y sin `code` ni `details` no se distingue
      un reloj atrasado de un permiso de fila.

   Cómo correrla:  node pruebas/navegador/enlace-que-no-sirve.mjs
   Con APP_HTML se le apunta a otra copia del index.html, que es como se
   comprueba que esta prueba de verdad atrapa algo.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const SQL    = '/home/user/CRM-VENTAS-/firmas.sql';
const PUERTO = 8794;
const CHROME = process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium';

/* Qué contesta el servidor cuando se le pregunta por el buzón:
   'falta'  → 404, como un proyecto donde firmas.sql nunca se corrió
   'tirada' → 200 false, el buzón existe pero sin la regla
   'ok'     → 200 true  */
let buzon = 'falta';

/* Qué le pasa a quien trata de entrar (bloque 6; apagado el resto del tiempo):
   'reloj'  → la contraseña es aceptada y el servidor de DATOS rechaza el pase
              recién emitido, como cuando el reloj de PostgREST se atrasa
   'malas'  → contraseña incorrecta de verdad, el grupo de control  */
let acceso = 'apagado';

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }
  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }
  if (u.pathname === '/firmas.sql'){
    res.writeHead(200, { 'Content-Type':'text/plain; charset=utf-8' });
    return res.end(fs.readFileSync(SQL, 'utf8'));
  }
  if (u.pathname === '/auth/v1/token'){
    if (acceso === 'malas'){
      res.writeHead(400, cors);
      return res.end('{"error_code":"invalid_credentials","msg":"Invalid login credentials"}');
    }
    res.writeHead(200, cors);
    return res.end(JSON.stringify({ access_token:'pase-ficticio', refresh_token:'otro-ficticio',
                                    token_type:'bearer', expires_in:3600,
                                    user:{ id:'u1', email:'alguien@ejemplo.example' } }));
  }
  /* El reloj atrasado: el pase entra bien y los DATOS lo rechazan. Tal cual lo
     contesta PostgREST, con su código y su detalle. */
  if (acceso === 'reloj' && u.pathname.startsWith('/rest/v1/')){
    res.writeHead(401, cors);
    return res.end('{"code":"PGRST303","message":"JWT claims validation or parsing failed",' +
                   '"details":"issued at future","hint":null}');
  }
  if (u.pathname === '/rest/v1/rpc/crm_buzon_ok'){
    if (buzon === 'falta'){ res.writeHead(404, cors); return res.end('{"message":"no existe"}'); }
    res.writeHead(200, cors);
    return res.end(buzon === 'ok' ? 'true' : 'false');
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
const ctx = await br.newContext({ viewport:{ width:900, height:1000 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
try{
  await p.waitForFunction(() => typeof buzonMontado === 'function', null, { timeout: 15000 });
}catch(e){
  console.log('\nFALLA · esta versión del index.html no tiene buzonMontado():');
  console.log('        reparte enlaces de firma sin preguntar si el buzón está montado.\n');
  await br.close(); srv.close(); process.exit(1);
}

/* Se le pone al CRM una nube de mentiras: sin esto `buzonMontado` contesta que
   sí sin preguntar nada, que es lo correcto cuando no hay nube. */
await p.evaluate(url => {
  nube.url = url; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio' };
}, `http://127.0.0.1:${PUERTO}`);

/** Vuelve a preguntar desde cero: la respuesta se guarda por sesión. */
const preguntar = async modo => {
  buzon = modo;
  return p.evaluate(async () => { _buzonOk = false; return await buzonMontado(); });
};

await bloque('1 · buzonMontado() dice la verdad', async () => {
  afirma('404 (firmas.sql nunca se corrió) → no',   await preguntar('falta')  === false);
  afirma('la regla está tirada → no',               await preguntar('tirada') === false);
  afirma('el buzón está montado → sí',              await preguntar('ok')     === true);
});

await bloque('2 · sin señal no estorba', async () => {
  const r = await p.evaluate(async () => {
    _buzonOk = false;
    const antes = window.fetch;
    window.fetch = () => Promise.reject(new Error('sin red'));
    const v = await buzonMontado();
    window.fetch = antes;
    return v;
  });
  afirma('si se cae la red, el enlace se sigue ofreciendo', r === true);
});

/** Olvida lo que el CRM ya sabía: como empezar sesión de nuevo. */
const sesionNueva = () => p.evaluate(() => { _buzonOk = false; });

/**
 * Abre «Enviar convenio al cliente» y devuelve lo que ve el ejecutivo.
 *
 * Por omisión arranca como una sesión nueva. El bloque 5 pide lo contrario a
 * propósito —`fresco:false`—, porque lo que prueba es justamente qué pasa
 * DENTRO de una misma sesión cuando el servidor se arregla.
 */
const mandarConvenio = async (modo, op = {}) => {
  buzon = modo;
  if (op.fresco !== false) await sesionNueva();
  return p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    // saneaConv rellena lo que un convenio de verdad trae (textos, impuestos…).
    const v = saneaConv({ id:'v1', folio:'CV-2026-040', tokenFirma:'laclave', clienteId:'c1',
      fecha:'2026-10-01', vigenciaDesde:'2026-10-01', vigenciaHasta:'2027-12-31',
      habitaciones:[{ tipoId:'h1', codigo:'STKN', nombre:'Standard King',
                      grupo:'deluxe', publica:5300, convenio:2800 }],
      firmaHotel:{ nombre:'Ejecutivo de ejemplo' } });
    const c = { empresa:'EMPRESA DE EJEMPLO SA DE CV', contacto:'Juan Pérez',
                telefono:'664 000 0000', email:'contacto@ejemplo.example' };
    enviarConvenio(v, c);
    // El cuerpo se pinta cuando acaba el PDF, falle o no.
    for (let i = 0; i < 100; i++){
      const caja = document.querySelector('#cuerpoEnvioC');
      if (caja && !/Preparando el convenio/.test(caja.innerText)){
        return { texto: caja.innerText,
                 botonesDeEnlace: caja.querySelectorAll('[data-mail="liga"], [data-wa="liga"], #cCopiar').length };
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return { texto:'(nunca se pintó)', botonesDeEnlace:-1 };
  });
};

await bloque('3 · sin buzón, al ejecutivo NO se le ofrece el enlace', async () => {
  const r = await mandarConvenio('falta');
  afirma('se le avisa que el enlace todavía no funciona',
    /todav[ií]a NO funciona/i.test(r.texto));
  afirma('se le dice qué pasaría con el cliente',
    /no se va a poder registrar/i.test(r.texto));
  afirma('y cómo arreglarlo, sin mandarlo a buscar nada',
    /Arreglar esto/i.test(r.texto));
  afirma('y que el documento se puede cerrar de todos modos',
    /Subir uno firmado/i.test(r.texto));
  afirma('NO hay un solo botón para mandar el enlace', r.botonesDeEnlace === 0);
  afirma('el PDF sí se le sigue ofreciendo', /Descargar el PDF/i.test(r.texto));
  /* El botón lleva su onclick en el propio HTML. Si la función no estuviera al
     alcance, el botón no haría NADA y nadie se enteraría hasta usarlo. */
  const abre = await p.evaluate(async () => {
    const b = document.querySelector('#avisoSinBuzon button');
    if (!b) return 'no hay botón';
    b.click();
    await new Promise(r => setTimeout(r, 300));
    return document.querySelector('#afCopiar') ? 'abre' : 'no abrió';
  });
  afirma('y el botón de verdad abre el panel', abre === 'abre');
});

await bloque('4 · con el buzón montado, todo sigue como siempre', async () => {
  const r = await mandarConvenio('ok');
  afirma('se le ofrece el camino corto', /Que lo firme en su pantalla/i.test(r.texto));
  afirma('y los botones del enlace están ahí', r.botonesDeEnlace >= 3);
  afirma('sin el aviso de que falta algo', !/todav[ií]a NO funciona/i.test(r.texto));
});

await bloque('5 · un «no» NO se queda guardado', async () => {
  /* Es el arreglo que importa: si el «no» se guardara por sesión, Marco podría
     correr firmas.sql y el aviso seguiría saliendo hasta que alguien recargue
     la página. Nadie recarga una página para ver si un aviso se fue. */
  const antes = await mandarConvenio('falta');
  afirma('con el buzón caído, no se ofrece el enlace', antes.botonesDeEnlace === 0);
  // Sin recargar y sin olvidar nada: la misma sesión, el servidor ya arreglado.
  const despues = await mandarConvenio('ok', { fresco:false });
  afirma('al montarlo, el enlace vuelve solo', despues.botonesDeEnlace >= 3);
  afirma('y el aviso desaparece', !/todav[ií]a NO funciona/i.test(despues.texto));
});

/* ---------------------------------------------------------------------------
   6 · EL RELOJ DEL SERVIDOR NO ES UNA CONTRASEÑA MALA

   A la gerente de ventas la pantalla de acceso le dijo «401 · JWT issued at
   future» y nos pasamos la tarde buscando un problema de contraseña. No lo era:
   su contraseña fue aceptada y el que rechazaba el pase era el servidor de
   datos, con el reloj atrasado. El recuadro de acceso no puede volver a mandar
   a nadie por ese camino.
   --------------------------------------------------------------------------- */

/** Abre el recuadro de acceso de cero y devuelve lo que queda escrito en él. */
const intentarEntrar = async modo => {
  acceso = modo;
  const texto = await p.evaluate(async () => {
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    nube.sesion = null;
    pantallaEntrada();
    const f = document.querySelector('#fEntrar');
    f.querySelector('[name="correo"]').value = 'alguien@ejemplo.example';
    f.querySelector('[name="pass"]').value   = 'lo-que-sea';
    f.requestSubmit();
    for (let i = 0; i < 120; i++){
      if (!document.getElementById('entrada')) return 'ENTRÓ';
      const caja = document.querySelector('#errEntrar');
      if (caja && caja.innerText.trim()) return caja.innerText;
      await new Promise(r => setTimeout(r, 100));
    }
    return '(nunca dijo nada)';
  });
  acceso = 'apagado';
  return texto;
};

await bloque('6 · con el reloj del servidor atrasado, no se culpa a la contraseña', async () => {
  const t = await intentarEntrar('reloj');
  afirma('NO le dice que su contraseña está mal',    !/contrase[ñn]a incorrect/i.test(t));
  afirma('NO le enseña el error crudo del servidor', !/JWT|PGRST303|401/i.test(t));
  /* Y ya no se queda afuera mirando un aviso: su contraseña fue aceptada, así
     que entra y trabaja con lo de su equipo. Lo que ve adentro —la banda, el
     chip, que lo capturado sube solo al volver el servidor— se comprueba
     entero en trabajar-sin-servidor.mjs. */
  afirma('y no se queda plantado en la puerta',      t === 'ENTRÓ');
});

await bloque('7 · grupo de control: una contraseña mala sigue diciendo lo de siempre', async () => {
  const t = await intentarEntrar('malas');
  afirma('dice que el correo o la contraseña están mal',
    /Correo o contrase[ñn]a incorrectos/i.test(t));
  afirma('y no sale el aviso del reloj',             !/servidor de datos/i.test(t));
});

await bloque('8 · quién reconoce la falla, por dentro', async () => {
  afirma('reconoce el código de PostgREST',
    await p.evaluate(() => fallaDeRelojDelServidor('401 · PGRST303 JWT claims validation')) === true);
  afirma('reconoce el detalle en texto',
    await p.evaluate(() => fallaDeRelojDelServidor('issued at future')) === true);
  afirma('y NO se mete donde no debe: una contraseña mala sigue siendo una contraseña mala',
    await p.evaluate(() => fallaDeRelojDelServidor('Invalid login credentials')) === false);
  /* El código y el detalle de PostgREST tienen que llegar hasta aquí: su
     `message` es siempre la misma frase genérica y no distingue nada. */
  acceso = 'reloj';
  const crudo = await p.evaluate(async () => {
    try{ await api('/rest/v1/loquesea'); return '(no falló)'; }
    catch(ex){ return ex.message; }
  });
  acceso = 'apagado';
  afirma('api() carga el código del servidor, no sólo su frase genérica',
    /PGRST303/.test(crudo));
});

/* Lo que el panel copia y lo que contesta «Ya lo corrí» se comprueba aparte, en
   copiar-el-sql.mjs, que lo hace para los DOS archivos que tienen botón. Aquí
   basta con que el aviso de verdad abra el panel, que es el bloque 3. */

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
