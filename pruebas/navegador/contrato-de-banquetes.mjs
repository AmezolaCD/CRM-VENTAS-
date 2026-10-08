/* ===========================================================================
   EL CONTRATO DE BANQUETES, CLÁUSULA POR CLÁUSULA

   Marco, con su contrato real en la mano: «en el apartado de contrato veo que
   COMPACTASTE TODO, sin embargo es importante que venga CLÁUSULA POR
   CLÁUSULA».

   Tenía razón, y era peor que el acomodo: el texto estaba RESUMIDO. Su
   documento trae ~19,300 caracteres de texto legal y la aplicación generaba
   ~8,800, con las sublistas aplanadas en párrafos corridos. Y el contrato
   está REGISTRADO EN PROFECO: lo que obliga es el texto registrado, no un
   resumen que se lea bonito.

   Lo que se prueba:
     · que estén las 19, con su ordinal y su título;
     · que las sublistas que se habían aplanado estén de vuelta;
     · que un dato legal sin capturar salga como RAYA y no inventado, y que
       capturado aparezca donde debe;
     · y que los datos del hotel no se escapen al cuerpo sin escapar.

   Cómo correrla:  node pruebas/navegador/contrato-de-banquetes.mjs
   =========================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const APP    = process.env.APP_HTML || '/home/user/CRM-VENTAS-/index.html';
const PUERTO = 8812;
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
const p  = await br.newPage({ viewport:{ width:1100, height:900 } });
p.on('pageerror', e => { console.log('  FALLA ' + e.message); fallas++; });
p.on('dialog', d => d.accept().catch(() => {}));
await p.goto(`http://127.0.0.1:${PUERTO}/`);
await p.waitForFunction(() => typeof guardar === 'function', null, { timeout:15000 });

/* Datos legales INVENTADOS: los del hotel se capturan en Ajustes y no viven
   en el repositorio, que es público. Lo que se prueba es que lleguen al
   lugar correcto del contrato, no cuáles son. */
const LEGALES = {
  razonSocial:'RAZÓN SOCIAL DE EJEMPLO S.A. DE C.V.',
  representante:'Representante de ejemplo', rfc:'XAXX010101000',
  escritura:'número 1 de ejemplo', domicilioFiscal:'Domicilio fiscal de ejemplo',
  banco:'Banco de ejemplo', cuenta:'0000000000', clabe:'000000000000000000',
  registroProfeco:'0000/2026', multaFumar:'20,000'
};

/** Arma un contrato y devuelve su hoja ya pintada, como la ve el cliente. */
const hoja = (legales) => p.evaluate(async leg => {
  state.usuarios = [saneaUsuario({ id:'u1', nombre:'Sistemas',
                                   correo:'a@ejemplo.example', rol:'admin' })];
  nube.sesion = { access_token:'x', user:{ email:'a@ejemplo.example' } };
  Object.assign(state.ajustes.hotel, leg);
  state.clientes = [saneaCliente({ id:'c1', empresa:'EMPRESA DE EJEMPLO A.C.',
                                   ejecutivo:'Sistemas', contacto:'Contacto de ejemplo' })];
  const e = saneaEvento({ id:'ct1', tipo:'contrato', clienteId:'c1', estado:'borrador',
    folio:'CB-EJEMPLO', fecha:'2026-10-08', titulo:'Evento de ejemplo', garantiaPax:'150',
    bloques:[saneaBloqueEv({ fecha:'2026-11-20', horario:'08:00-11:00', evento:'Desayuno',
                             pax:'150', salon:'Salón de ejemplo', horas:'3' })],
    lineas:[saneaLineaEv({ servicio:'Desayuno de ejemplo', cantidad:150, precio:400,
                           conServicio:true })] });
  state.eventos = [e]; guardar();

  const caja = document.createElement('div');
  caja.innerHTML = `<div class="doc-contenido">${docEvento(e, cliente(e.clienteId))}</div>`;
  document.body.appendChild(caja);
  await new Promise(r => setTimeout(r, 200));
  const cls = [...caja.querySelectorAll('.cl')];
  const res = {
    clausulas: cls.length,
    titulos: cls.map(x => x.querySelector('b').textContent.trim()),
    listas: caja.querySelectorAll('.cl ul.ct-serv').length,
    parrafos: caja.querySelectorAll('.cl .cl-p').length,
    texto: caja.innerText,
    html: caja.innerHTML,
    porTitulo: {}
  };
  for (const x of cls){
    const t = x.querySelector('b').textContent.split('.')[0].trim();
    res.porTitulo[t] = { texto:x.innerText, listas:x.querySelectorAll('ul').length };
  }
  caja.remove();
  return res;
}, legales);

await bloque('1 · están las diecinueve, con su ordinal', async () => {
  const r = await hoja(LEGALES);
  afirma('diecinueve cláusulas', r.clausulas === 19);
  /* Los ordinales en orden: si alguien inserta una y se le olvida renumerar,
     esto se pone rojo. */
  const esperados = ['PRIMERA','SEGUNDA','TERCERA','CUARTA','QUINTA','SEXTA','SÉPTIMA',
    'OCTAVA','NOVENA','DÉCIMA','DÉCIMA PRIMERA','DÉCIMA SEGUNDA','DÉCIMA TERCERA',
    'DÉCIMA CUARTA','DÉCIMA QUINTA','DÉCIMA SEXTA','DÉCIMA SÉPTIMA','DÉCIMA OCTAVA',
    'DÉCIMA NOVENA'];
  const salieron = r.titulos.map(t => t.split('.')[0].trim());
  afirma('en orden y sin saltarse ninguna',
    esperados.every((x, i) => salieron[i] === x));
  afirma('cada una con su nombre, no sólo el número',
    r.titulos.every(t => /\.\s*\S/.test(t)));
});

await bloque('2 · lo que se había resumido está de vuelta', async () => {
  const r = await hoja(LEGALES);
  /* La medida más directa de «compactaste todo»: antes eran ~8,800
     caracteres de texto legal; el documento de Marco trae ~19,300. */
  afirma(`el contrato pesa lo que debe (${r.texto.length} caracteres)`,
    r.texto.length > 15000);
  afirma('hay sublistas, no párrafos corridos', r.listas >= 7);
  afirma('y cláusulas de varios párrafos', r.parrafos >= 20);

  /* Las tres que más se habían aplanado. */
  afirma('TERCERA trae sus cuatro servicios en lista',
    r.porTitulo['TERCERA'].listas === 1 &&
    /Renta de salones para eventos/.test(r.porTitulo['TERCERA'].texto) &&
    /Prestar todos aquellos servicios/.test(r.porTitulo['TERCERA'].texto));
  afirma('CUARTA trae las cuatro formas de pago',
    /En efectivo en las instalaciones/.test(r.porTitulo['CUARTA'].texto) &&
    /tarjeta de crédito/.test(r.porTitulo['CUARTA'].texto) &&
    /transferencia interbancaria/.test(r.porTitulo['CUARTA'].texto) &&
    /depósito bancario/.test(r.porTitulo['CUARTA'].texto));
  afirma('SEXTA separa las obligaciones de cada parte',
    r.porTitulo['SEXTA'].listas === 2);
  /* La SÉPTIMA repite las penas: una vez para el cliente y otra para el
     hotel. Es así en el documento registrado. */
  afirma('SÉPTIMA trae los DOS juegos de penas',
    r.porTitulo['SÉPTIMA'].listas === 2);
});

await bloque('3 · los datos legales llegan a su cláusula', async () => {
  const r = await hoja(LEGALES);
  afirma('la cuenta y la CLABE, en la CUARTA',
    /0000000000/.test(r.porTitulo['CUARTA'].texto) &&
    /000000000000000000/.test(r.porTitulo['CUARTA'].texto));
  afirma('la razón social, donde va',
    /RAZÓN SOCIAL DE EJEMPLO/.test(r.porTitulo['CUARTA'].texto));
  afirma('la multa por fumar, en la DÉCIMA TERCERA',
    /20,000/.test(r.porTitulo['DÉCIMA TERCERA'].texto));
});

await bloque('4 · sin capturar, sale raya y NO un dato inventado', async () => {
  /* Un contrato con el banco en blanco tiene que verse incompleto, no
     plausible: una cuenta inventada en un contrato firmado es un problema
     mucho peor que una raya. */
  const r = await hoja({ razonSocial:'', representante:'', rfc:'', escritura:'',
    domicilioFiscal:'', banco:'', cuenta:'', clabe:'', registroProfeco:'',
    multaFumar:'20,000' });
  afirma('la CUARTA enseña rayas donde falta la cuenta',
    /____/.test(r.porTitulo['CUARTA'].texto));
  afirma('y no se inventa ningún banco',
    !/Banco de ejemplo|BBVA|Bancomer/i.test(r.porTitulo['CUARTA'].texto));
  afirma('las diecinueve siguen saliendo', r.clausulas === 19);
});

await bloque('5 · el texto del hotel no se cuela sin escapar', async () => {
  /* Alguien captura una razón social con un «&» o un «<» y, sin escapar,
     se rompe el documento o peor. */
  const r = await hoja(Object.assign({}, LEGALES,
    { razonSocial:'A & B <script>alert(1)</script> S.A.' }));
  afirma('el ampersand sobrevive como texto',
    /A & B/.test(r.porTitulo['CUARTA'].texto));
  afirma('y la etiqueta NO se ejecuta ni se inyecta',
    !/<script>/i.test(r.html));
});

await br.close(); srv.close();
console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTodo en verde.\n');
process.exit(fallas ? 1 : 0);
