/* ===========================================================================
   CON EL SERVIDOR DE DATOS CAÍDO SE SIGUE TRABAJANDO

   El 17 de noviembre el servidor de datos del hotel se quedó con el reloj
   detenido: aceptaba las contraseñas pero rechazaba todo pase recién emitido.
   La gerente de ventas tecleó bien su contraseña y se quedó AFUERA, mirando un
   aviso, con sus datos guardados en su propia computadora y sin poder tocarlos.
   Dos días así.

   El CRM guarda todo en el equipo. Si el servidor de CUENTAS ya dijo que esa
   persona es quien dice ser, dejarla afuera no protege nada —su contraseña se
   verificó— y le cuesta el día entero.

   Lo que se afirma aquí:

   1. Con el servidor de datos rechazando los pases nuevos, al entrar con la
      contraseña correcta el recuadro de acceso SE QUITA y el CRM queda a la
      vista con lo que este equipo tiene.
   2. Se ve por qué: la banda de arriba lo dice, y el chip de la nube no dice
      «En línea».
   3. La que de verdad importa: lo capturado durante el apagón SUBE SOLO cuando
      el servidor se compone, sin recargar, y lo del hotel llega sin borrarlo.
   4. Cerrar sesión durante el apagón avisa que lo de este equipo se pierde, y
      ya NO promete que «todo vive en el servidor» —que es mentira mientras el
      servidor no reciba, y `salir()` borra los datos del equipo—.
   5. Grupo de control: una contraseña mala sigue sin entrar.
   6. Grupo de control: un 401 que NO es del reloj sigue mandando al recuadro.

   Cómo correrla:  node pruebas/navegador/trabajar-sin-servidor.mjs
   Con APP_HTML se le apunta a otra copia del index.html, que es como se
   comprueba que esta prueba de verdad atrapa algo.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8895;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

/* Cómo se porta el servidor de datos:
   'reloj'   → 401 PGRST303 «issued at future», el reloj detenido
   'caduco'  → 401 de sesión vencida, que NO es lo mismo y sí debe sacar
   'ok'      → contesta normal
   La contraseña se acepta siempre, salvo con `claveMala`. */
let datos = 'reloj';
let claveMala = false;

/* Lo que el hotel tiene allá arriba. Un cliente, para ver que al componerse el
   servidor llega SIN borrar lo que se capturó aquí abajo. */
const DEL_HOTEL = [{
  id: 'clientes:srv1', tipo: 'clientes', borrado: false,
  actualizado: '2026-11-18T10:00:00.000Z', actualizado_por: 'alguien@ejemplo.example',
  datos: { id:'srv1', empresa:'EMPRESA DEL SERVIDOR SA', contacto:'Quien sea',
           telefono:'6640000000', email:'contacto@ejemplo.example',
           estatus:'prospecto', ejecutivo:'Persona de ejemplo' }
}];

/** Lo que este equipo logró mandar: así se comprueba que lo capturado SÍ subió. */
const recibido = [];

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
                 'Access-Control-Expose-Headers':'*', 'Content-Type':'application/json' };
  if (req.method === 'OPTIONS'){ res.writeHead(200, cors); return res.end('{}'); }

  if (u.pathname === '/app'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(APP, 'utf8'));
  }

  if (u.pathname === '/auth/v1/token'){
    if (claveMala){
      res.writeHead(400, cors);
      return res.end('{"error_code":"invalid_credentials","msg":"Invalid login credentials"}');
    }
    res.writeHead(200, cors);
    return res.end(JSON.stringify({ access_token:'pase-ficticio', refresh_token:'otro-ficticio',
      token_type:'bearer', expires_in:3600,
      user:{ id:'u1', email:'alguien@ejemplo.example' } }));
  }

  if (u.pathname.startsWith('/rest/v1/')){
    if (datos === 'reloj'){
      res.writeHead(401, cors);
      return res.end('{"code":"PGRST303","message":"JWT claims validation or parsing failed",' +
                     '"details":"issued at future","hint":null}');
    }
    if (datos === 'caduco'){
      res.writeHead(401, cors);
      return res.end('{"code":"PGRST301","message":"JWT expired","details":null,"hint":null}');
    }
    if (req.method === 'POST'){
      let cuerpo = '';
      req.on('data', t => cuerpo += t);
      req.on('end', () => {
        try{ for (const f of JSON.parse(cuerpo)) recibido.push(f); }catch(e){}
        res.writeHead(201, cors); res.end('');
      });
      return;
    }
    res.writeHead(200, cors);
    return res.end(JSON.stringify(u.pathname === '/rest/v1/crm_datos' ? DEL_HOTEL : []));
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
const ctx = await br.newContext({ viewport:{ width:1200, height:900 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
/* Los confirm() de la sincronización se contestan que sí; el de «¿adoptar la
   nube y reemplazar lo de aquí?» NO debe llegar a salir, y el bloque 3 lo
   comprueba contándolos. */
const dichos = [];
p.on('dialog', d => { dichos.push(d.message()); d.accept().catch(() => {}); });

await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof pantallaEntrada === 'function', null, { timeout: 15000 });
/* A propósito NO se corta aquí si falta `abrirSinServidor`: contra el index.html
   de antes se quiere ver fallar lo que la gente vive —que se queda en la puerta,
   que no hay banda, que lo capturado no sube— y no un solo renglón de que falta
   una función. */

/** Deja el equipo como uno recién configurado y sin sesión, y abre la entrada. */
const desdeCero = () => p.evaluate(url => {
  document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
  nube.url = url; nube.anon = 'llave-de-mentiras';
  nube.sesion = null; nube.enlazado = false; nube.trabajoSinServidor = false;
  nube.estado = 'local'; nube.ultimo = '';
  sincronizado = new Map();
  guardarNubeCfg();
  pantallaEntrada();
}, `http://127.0.0.1:${PUERTO}`);

/** Teclea la contraseña y espera a que la pantalla decida algo. */
const entrarYa = async () => {
  await p.evaluate(() => {
    const f = document.querySelector('#fEntrar');
    f.querySelector('[name="correo"]').value = 'alguien@ejemplo.example';
    f.querySelector('[name="pass"]').value   = 'lo-que-sea';
    f.requestSubmit();
  });
  return p.evaluate(async () => {
    for (let i = 0; i < 120; i++){
      if (!document.getElementById('entrada')) return 'entró';
      const caja = document.querySelector('#errEntrar');
      if (caja && caja.innerText.trim()) return 'se quedó afuera: ' + caja.innerText;
      await new Promise(r => setTimeout(r, 100));
    }
    return '(nunca decidió)';
  });
};

await bloque('1 · con el servidor de datos caído, se entra de todos modos', async () => {
  datos = 'reloj'; claveMala = false;
  await desdeCero();
  const r = await entrarYa();
  afirma('el recuadro de acceso se quita', r === 'entró');
  const v = await p.evaluate(() => ({
    candado: document.body.classList.contains('sin-sesion'),
    estado:  nube.estado,
    marca:   nube.trabajoSinServidor,
    guardado: JSON.parse(localStorage.getItem('crm-hotel-nube') || '{}').trabajoSinServidor
  }));
  afirma('el CRM queda a la vista, sin candado',  v.candado === false);
  afirma('y el CRM sabe en qué situación está',   v.estado === 'sinServidor');
  afirma('se apunta que aquí hay trabajo sin subir', v.marca === true);
  afirma('y se apunta de modo que sobreviva a recargar', v.guardado === true);
});

await bloque('2 · se ve por qué, sin tener que ir a buscarlo', async () => {
  const v = await p.evaluate(() => {
    const b = document.getElementById('bandaServidor');
    return { banda: b && !b.hidden ? b.innerText : '(no hay banda)',
             chip: document.getElementById('estadoNube').innerText };
  });
  afirma('la banda dice que es el servidor',        /servidor de datos/i.test(v.banda));
  afirma('y que no es su contraseña ni su equipo',  /no es su contrase[ñn]a/i.test(v.banda));
  afirma('y que puede seguir trabajando',           /seguir trabajando/i.test(v.banda));
  afirma('y lo que más importa: que no cierre sesión',
    /no cierre su sesi[óo]n/i.test(v.banda));
  afirma('y cómo llevarse lo capturado si tiene que cerrar',
    /Respaldo completo/i.test(v.banda));
  afirma('el chip NO dice «En línea»',              !/En l[íi]nea/i.test(v.chip));
  afirma('ni manda a revisar el módem',             !/Sin conexi[óo]n/i.test(v.chip));
});

await bloque('3 · lo capturado durante el apagón sube solo al volver el servidor', async () => {
  // Un cliente capturado con el servidor caído, como cualquier día de trabajo.
  await p.evaluate(() => {
    state.clientes.push(saneaCliente({ id:'local1', empresa:'CAPTURADO SIN SERVIDOR SA',
      contacto:'Alguien', telefono:'6640000001', email:'otro@ejemplo.example',
      estatus:'prospecto', ejecutivo:'Persona de ejemplo' }));
    guardar();
  });
  const antes = dichos.length;
  datos = 'ok';                       // el servidor se compone
  const subio = await p.evaluate(async () => {
    await ponerseAlDia();
    return { estado: nube.estado, marca: nube.trabajoSinServidor,
             sigueElLocal: state.clientes.some(c => c.id === 'local1'),
             llegoElDelHotel: state.clientes.some(c => c.id === 'srv1') };
  });
  afirma('lo capturado aquí llegó al servidor',
    recibido.some(f => f.id === 'clientes:local1'));
  afirma('y NO se borró de este equipo',     subio.sigueElLocal === true);
  afirma('lo del hotel bajó a este equipo',  subio.llegoElDelHotel === true);
  afirma('sin preguntar si reemplaza lo de aquí',
    !dichos.slice(antes).some(t => /reemplazar/i.test(t)));
  afirma('el CRM vuelve a estar al día',     subio.estado === 'listo');
  afirma('y se olvida la marca del apagón',  subio.marca === false);
  afirma('la banda se va sola',
    await p.evaluate(() => document.getElementById('bandaServidor').hidden) === true);
});

await bloque('4 · cerrar sesión durante el apagón avisa de lo que se pierde', async () => {
  const t = await p.evaluate(() => {
    nube.estado = 'sinServidor';
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    menuSesion();
    const txt = document.querySelector('.modal-body').innerText;
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    return txt;
  });
  afirma('NO promete que todo vive en el servidor', !/todo vive en el servidor/i.test(t));
  afirma('dice que lo de hoy todavía no está allá', /todav[íi]a NO est[áa] all[áa]/i.test(t));
  afirma('y manda a sacar el respaldo antes',       /Respaldo completo/i.test(t));

  /* Y con el servidor bien, el texto de siempre: esto no puede volverse un
     aviso de miedo permanente. */
  const u = await p.evaluate(() => {
    nube.estado = 'listo';
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    menuSesion();
    const txt = document.querySelector('.modal-body').innerText;
    document.querySelectorAll('.overlay, .modal-ov').forEach(e => e.remove());
    return txt;
  });
  afirma('con el servidor bien, vuelve a decir lo de siempre',
    /todo vive en el servidor/i.test(u));
});

await bloque('5 · grupo de control: una contraseña mala no entra', async () => {
  datos = 'reloj'; claveMala = true;
  await desdeCero();
  const r = await entrarYa();
  afirma('se queda afuera',                 r !== 'entró');
  afirma('y se le dice que es la contraseña',
    /Correo o contrase[ñn]a incorrectos/i.test(r));
  claveMala = false;
});

await bloque('6 · grupo de control: una sesión vencida de verdad sigue pidiendo contraseña', async () => {
  datos = 'caduco';
  await desdeCero();
  const r = await entrarYa();
  afirma('se queda afuera',                      r !== 'entró');
  afirma('y NO se le abre el CRM sin servidor',
    await p.evaluate(() => nube.estado !== 'sinServidor'));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
