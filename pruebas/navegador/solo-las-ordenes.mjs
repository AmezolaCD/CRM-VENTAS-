/* ===========================================================================
   EL PAPEL QUE SÓLO VE LAS ÓRDENES DE TRABAJO

   Marco: «agrega a un usuario que sería asistente.direccion@… que pueda ver
   sólo el módulo de ODTs».

   No había manera: el papel más cercano era *Marketing*, que además de las
   órdenes ve las campañas, las ligas con UTMs, los prospectos y su tablero.
   Así que se agregó un papel nuevo con una sola pestaña.

   Lo que se cuida aquí:

   · que vea las órdenes y NADA más. Un papel nuevo que se cuele de más es
     peor que no tenerlo: se le dio a alguien precisamente para que no viera
     la cartera;
   · que no le pidan escoger departamento al entrar. Las órdenes vienen de
     todos los departamentos del hotel, así que escoger uno no acota nada y
     sería un trámite sin sentido delante de alguien que sólo quiere trabajar;
   · que los demás papeles no se hayan movido —el grupo de control—;
   · Y EL QUE DE VERDAD IMPORTA: que `roles.sql` conozca el papel. El servidor
     decide por su cuenta qué le manda a cada quien, y un papel que no esté
     nombrado ahí cae en la rama de ventas, que EXCLUYE las órdenes. Sería una
     cuenta que entra, ve su pestaña y la encuentra vacía para siempre, sin un
     solo error en pantalla. La mitad de este cambio vive en un archivo que
     Marco tiene que correr, y esta prueba es lo que impide que se nos olvide.

   Cómo correrla:  node pruebas/navegador/solo-las-ordenes.mjs

   TODO lo de aquí es inventado: el repositorio es público.
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const SQL    = process.env.ROLES_SQL || '/home/user/CRM-VENTAS-/roles.sql';
const PUERTO = 8839;
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

/** Entra como alguien con el papel que se le pida y devuelve lo que alcanza. */
const comoAlguienCon = rol => p.evaluate((r) => {
  /* Sin nube, `rolActual()` contesta "admin" a todo el mundo —quien abre el
     archivo en su equipo es dueño de sus datos—, así que los papeles no se
     pueden probar sin fingir una sesión. Se finge con datos inventados: la
     dirección y la llave no se usan para nada aquí, nadie va a llamar a ese
     servidor, y el sondeo se apaga en seguida para que no lo intente. */
  nube.url    = 'https://ejemplodeproyecto.supabase.co';
  nube.anon   = 'llave-de-mentiras';
  nube.sesion = { user: { email: 'alguien@ejemplo.example' } };
  detenerSondeo();
  programarSubida = () => {};

  state.usuarios = [saneaUsuario({ id:'u1', nombre:'Persona De Ejemplo',
    correo:'alguien@ejemplo.example', rol:r })];
  depto = '';
  guardar();
  return {
    rol: rolActual(),
    vistas: vistasDelRol(),
    deptos: misDepartamentos().map(d => d.id),
    escoge: escogeDepto(),
    ve: { odts:puedeVer('odts'), clientes:puedeVer('clientes'), ajustes:puedeVer('ajustes'),
          campanas:puedeVer('campanas'), leads:puedeVer('leads'), convenios:puedeVer('convenios'),
          mktdash:puedeVer('mktdash'), formulario:puedeVer('formulario') }
  };
}, rol);

/* --- 1 -------------------------------------------------------------------- */
await bloque('1 · el papel existe y se puede escoger en Ajustes', async () => {
  const r = await p.evaluate(() => ({
    hay: ROLES.some(x => x.id === 'odts'),
    nombre: (ROLES.find(x => x.id === 'odts') || {}).name,
    ayuda: (ROLES.find(x => x.id === 'odts') || {}).ayuda || '',
    /* El desplegable de la ficha de usuario se arma de ROLES, así que basta
       con que esté ahí para poder asignarlo. */
    enLaLista: ROLES.map(x => x.id)
  }));
  afirma('el papel está dado de alta', r.hay);
  afirma('con un nombre que se entiende en la pantalla', r.nombre === 'Órdenes de trabajo');
  afirma('y su ayuda dice lo que NO ve, no sólo lo que ve',
    /no ve la cartera/i.test(r.ayuda));
  afirma('sin pisar a ninguno de los que ya estaban',
    ['admin','direccion','gerente','ejecutivo','captura','gte_banquetes','banquetes',
     'gte_marketing','marketing','odts'].every(x => r.enLaLista.includes(x)));
});

/* --- 2 --------------------------------------------------------------------
   Lo que se le dio a alguien precisamente para que NO viera lo demás. */
await bloque('2 · ve las órdenes y nada más', async () => {
  const r = await comoAlguienCon('odts');
  afirma('el papel se reconoce', r.rol === 'odts');
  afirma('UNA SOLA PESTAÑA', r.vistas.length === 1 && r.vistas[0] === 'odts');
  afirma('ve las órdenes de trabajo', r.ve.odts);
  afirma('NO ve la cartera de clientes',   !r.ve.clientes);
  afirma('NO ve los convenios',            !r.ve.convenios);
  afirma('NO ve los Ajustes',              !r.ve.ajustes);
  afirma('NO ve las campañas',             !r.ve.campanas);
  afirma('NO ve el tablero de marketing',  !r.ve.mktdash);
  afirma('NO ve los leads',                !r.ve.leads);
  afirma('ni el formulario de prospección',!r.ve.formulario);
});

/* --- 3 --------------------------------------------------------------------
   Las órdenes vienen de todos los departamentos del hotel: escoger uno no
   acotaría nada. */
await bloque('3 · no le preguntan departamento al entrar', async () => {
  const r = await comoAlguienCon('odts');
  afirma('no alcanza ningún departamento', r.deptos.length === 0);
  afirma('Y NO LE SALE LA PANTALLA DE ESCOGER', r.escoge === false);
});

/* --- 4 --------------------------------------------------------------------
   El grupo de control: un papel nuevo no tiene por qué mover a los demás. */
await bloque('4 · los demás papeles siguen igual', async () => {
  const mk = await comoAlguienCon('marketing');
  afirma('marketing sigue viendo sus campañas y sus órdenes',
    mk.ve.campanas && mk.ve.odts && mk.ve.mktdash);
  const ej = await comoAlguienCon('ejecutivo');
  afirma('el ejecutivo de ventas sigue con su cartera y sin órdenes',
    ej.ve.clientes && ej.ve.convenios && !ej.ve.odts);
  const ad = await comoAlguienCon('admin');
  afirma('y el administrador sigue alcanzando los Ajustes', ad.ve.ajustes && ad.ve.odts);
});

/* --- 5 --------------------------------------------------------------------
   LA MITAD QUE VIVE EN EL SERVIDOR.

   Esto no se puede comprobar contra Supabase desde aquí, pero sí se puede
   comprobar que el archivo que Marco corre nombre el papel. Sin ese renglón
   la cuenta entra, ve su pestaña y la encuentra vacía PARA SIEMPRE, y no hay
   error en pantalla que lo explique: es la clase de falla que se descubre
   preguntándole a alguien por qué no usa el sistema. */
await bloque('5 · roles.sql conoce el papel', async () => {
  const sql = fs.readFileSync(SQL, 'utf8');
  /* `crm_rol()` va envuelta en `(select ...)` dentro de las políticas, y no es
     cosmético: sin eso Postgres la reevalúa en CADA FILA y la sincronización
     entera se pasaba del límite de ocho segundos de Supabase. Las búsquedas de
     aquí abajo no fijan la envoltura —eso lo mide `pruebas/sql/papeles.sql`—,
     pero tienen que tolerarla. */
  afirma('la regla de lectura lo nombra',
    /crm_rol\(\)\)?\s*=\s*'odts'/.test(sql));
  afirma('Y LE DEJA LEER LAS ÓRDENES',
    /crm_rol\(\)\)?\s*=\s*'odts'[\s\S]{0,600}?tipo in \([^)]*'odts'[^)]*\)/.test(sql));
  /* Sin los ajustes no tiene los datos del hotel ni la lista de
     departamentos; sin usuarios, el propio servidor no sabe qué papel tiene
     quien pregunta. Con cualquiera de los dos fuera, entra a una pantalla en
     blanco. */
  /* La rama, y sólo la rama: hasta el `when` siguiente o el `else`. Pasarse
     de ahí leería la de ventas y esto diría que alcanza las campañas. */
  const desde = sql.search(/crm_rol\(\)\)?\s*=\s*'odts'/);
  const hasta = sql.slice(desde).search(/\n\s*(when|else)\b/);
  const rama = sql.slice(desde, desde + (hasta > 0 ? hasta : 300));
  afirma('con los ajustes, de donde sale la lista de departamentos',
    /'ajustes'/.test(rama));
  afirma('y con los usuarios, de donde el servidor saca su papel',
    /'usuarios'/.test(rama));
  /* Y lo que NO debe alcanzar, que es el punto entero del papel. */
  afirma('pero NO la cartera ni las campañas',
    !/'clientes'/.test(rama) && !/'campanas'/.test(rama) && !/'convenios'/.test(rama));

  /* El renglón tiene que ir ANTES del `else`, o nunca se llega a él. */
  const iOdts  = sql.search(/crm_rol\(\)\)?\s*=\s*'odts'/);
  const iElse  = sql.indexOf("else tipo not in ('eventos','campanas','odts')");
  afirma('y va antes de la rama de ventas, que excluye las órdenes',
    iOdts > 0 && iElse > iOdts);
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
