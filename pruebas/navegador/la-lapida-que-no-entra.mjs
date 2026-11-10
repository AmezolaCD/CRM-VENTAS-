/* ===========================================================================
   UNA LÁPIDA QUE EL SERVIDOR RECHAZA SE SUELTA, NO SE INSISTE

   Marco le corrigió el nombre a un ejecutivo en Ajustes. El servidor reparte
   por nombre —`roles.sql`—, así que dejó de entregarle sus filas; la
   computadora del ejecutivo las vio DESAPARECER y `anotarLoQueSeFue` les puso
   lápida, guardada en su navegador.

   El servidor rechaza esa lápida, y con razón: esas filas ya no son suyas para
   borrarlas. Pero al bajar hay un renglón que dice «si tengo lápida de esta
   fila, ignórala cuando llegue». Así que una vez arreglado el nombre, el
   servidor sí le mandaba sus convenios Y SU PROPIA MÁQUINA LOS TIRABA AL
   LLEGAR. Para siempre, porque la lápida nunca se confirmaba y nunca se
   soltaba. Desde ninguna pantalla se veía por qué.

   Si el servidor no me deja borrar algo, mi borrado no va a ocurrir nunca:
   insistir sólo me esconde el renglón a mí. Se suelta la lápida y que el
   renglón vuelva.

   Lo que se cuida aquí:

   · que una lápida RECHAZADA POR PERMISOS se suelte, y que el renglón vuelva
     en la siguiente bajada;
   · y los dos grupos de control que sostienen el arreglo: si lo que falló fue
     la RED, la lápida se conserva y se reintenta —ahí el borrado sigue siendo
     legítimo—; y una lápida ACEPTADA se olvida y el renglón NO vuelve, que es
     el borrado de toda la vida y no se puede romper.

   Cómo correrla:  node pruebas/navegador/la-lapida-que-no-entra.mjs
   Con APP_HTML se le apunta a otra copia del index.html: contra la versión de
   antes tiene que ponerse roja.

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8887;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

/* ----- El servidor de mentiras, al que se le pide cómo contestar ----- */
const tabla = new Map();
let reloj = 0;
let modo = 'acepta';          // 'acepta' · 'rls' · 'red'
const sello = () => new Date(Date.UTC(2026, 10, 10, 12, 0, reloj++)).toISOString();

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
        const hayLapida = lote.some(f => f.borrado === true);
        /* Lo que hace PostgREST con roles.sql puesto cuando el renglón es de
           otra persona: rechaza el lote entero por la regla de filas. */
        if (hayLapida && modo === 'rls')
          return manda(403, { message:'new row violates row-level security policy for table "crm_datos"' });
        /* Y lo que pasa cuando se cae la red o el servidor: no es un renglón
           malo, es que no hubo viaje. */
        if (hayLapida && modo === 'red')
          return manda(500, { message:'upstream connect error or disconnect/reset before headers' });
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
const p  = await br.newPage({ viewport:{ width:1200, height:900 } });
p.on('pageerror', e => { console.log('  FALLA error de JavaScript: ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/app`);
await p.waitForFunction(() => typeof sincronizar === 'function', null, { timeout:15000 });

/**
 * Deja el equipo con un convenio que YA ESTABA aquí y que acaba de
 * desaparecer del estado: es lo que le pasa a una fila cuando el servidor deja
 * de entregársela. Al guardar, `anotarLoQueSeFue` le pone lápida.
 */
const conLapida = () => p.evaluate(url => {
  state.usuarios = [saneaUsuario({ id:'u1', correo:'yo@ejemplo.example',
                                   nombre:'Quien Vende', rol:'ejecutivo' })];
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA UNO SA DE CV',
                                   ejecutivo:'Quien Vende', estatus:'nuevo' })];
  state.convenios = [saneaConv({ id:'v1', folio:'CV-2026-030', clienteId:'c1',
                                 ejecutivo:'Quien Vende' })];
  nube.url = url; nube.anon = 'llave-de-mentiras';
  nube.sesion = { access_token:'ficticio', user:{ email:'yo@ejemplo.example' } };
  nube.enlazado = true;
  nube.ultimo = '';
  tumbas = new Set();
  sincronizado = new Map();
  /* Se apunta el estado tal cual está: así lo que falte después cuenta como
     desaparecido, que es de donde salen las lápidas. */
  alDiaSinTumbar(true);
  // Y ahora el convenio se cae del estado, como cuando el servidor lo deja de dar.
  state.convenios = [];
  guardar();
  return [...tumbas];
}, `http://127.0.0.1:${PUERTO}`);

/** El convenio, puesto en el servidor como si fuera de otra persona. */
const enElServidor = () => {
  tabla.set('convenios:v1', {
    id:'convenios:v1', tipo:'convenios', borrado:false, duenio:'Quien Vende',
    datos:{ id:'v1', folio:'CV-2026-030', clienteId:'c1', ejecutivo:'Quien Vende',
            estado:'borrador', habitaciones:[], grupos:{}, textos:{} },
    actualizado: sello()
  });
};

const sincro = () => p.evaluate(async () => { await sincronizar(); return nube.estado; });
const lapidas = () => p.evaluate(() => [...tumbas]);
const hayConvenio = () => p.evaluate(() => state.convenios.some(v => v.id === 'v1'));

/* --- 1 ---------------------------------------------------------------------
   Primero, que la lápida de verdad se apunte: sin eso no hay nada que probar. */
await bloque('1 · una fila que desaparece deja lápida', async () => {
  tabla.clear(); modo = 'acepta';
  const t = await conLapida();
  afirma('quedó apuntada', t.includes('convenios:v1'));
});

/* --- 2 ---------------------------------------------------------------------
   EL CASO DEL EJECUTIVO. Hoy nace en rojo: la lápida se queda para siempre y
   el convenio no vuelve nunca. */
await bloque('2 · si el servidor la rechaza por permisos, se suelta', async () => {
  tabla.clear(); modo = 'rls';
  await conLapida();
  enElServidor();
  await sincro();

  afirma('EL SERVIDOR LA RECHAZÓ',
    await p.evaluate(() => nube.rechazados.some(r => r.id === 'convenios:v1')));
  afirma('Y LA LÁPIDA SE SOLTÓ', !(await lapidas()).includes('convenios:v1'));

  /* Y ahora que el servidor sí lo entrega, su máquina ya no lo tira. Volver a
     bajar desde cero es lo que hace una recarga: `nube.ultimo` no se guarda. */
  modo = 'acepta';
  await p.evaluate(() => { nube.ultimo = ''; });
  await sincro();
  afirma('EL CONVENIO VOLVIÓ', await hayConvenio() === true);
});

/* --- 3 ---------------------------------------------------------------------
   GRUPO DE CONTROL: si lo que falló fue la RED, el borrado sigue siendo
   legítimo y la lápida se conserva. Soltarla aquí resucitaría lo que alguien
   borró a propósito. */
await bloque('3 · si se cayó la red, la lápida se conserva', async () => {
  tabla.clear(); modo = 'red';
  await conLapida();
  enElServidor();
  await sincro();

  afirma('LA LÁPIDA SIGUE APUNTADA', (await lapidas()).includes('convenios:v1'));
  /* Y mientras siga apuntada, el renglón no vuelve: eso es lo correcto, el
     borrado todavía no se ha podido mandar. */
  await p.evaluate(() => { nube.ultimo = ''; });
  await sincro();
  afirma('y el renglón no vuelve', await hayConvenio() === false);
});

/* --- 4 ---------------------------------------------------------------------
   GRUPO DE CONTROL, EL QUE NO SE PUEDE ROMPER: el borrado de toda la vida.
   Lápida aceptada, renglón muerto, y no resucita. */
await bloque('4 · una lápida aceptada se olvida y el renglón no vuelve', async () => {
  tabla.clear(); modo = 'acepta';
  await conLapida();
  enElServidor();
  await sincro();

  afirma('la lápida se olvidó', !(await lapidas()).includes('convenios:v1'));
  afirma('el servidor lo tiene por borrado',
    (tabla.get('convenios:v1') || {}).borrado === true);
  await p.evaluate(() => { nube.ultimo = ''; });
  await sincro();
  afirma('Y NO RESUCITA', await hayConvenio() === false);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
