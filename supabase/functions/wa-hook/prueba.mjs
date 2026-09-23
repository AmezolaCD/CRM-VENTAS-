// Prueba la lógica de la puerta de WhatsApp sin Supabase y sin 360dialog: se
// le dan los mismos avisos que manda el proveedor y se comprueba que saque los
// mensajes buenos, que tire lo que no es un lead, y que no deje pasar a nadie
// sin la llave.
//
// Lo que se prueba se saca del propio index.ts, tal cual está escrito, para
// que no se pueda probar una copia distinta de la que se sube.
//
//   node supabase/functions/wa-hook/prueba.mjs
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c){ pass++; console.log('  ok   ' + n); }
                               else { fail++; console.log('  FALLA ' + n + (x ? ' :: ' + x : '')); } };

const src = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const ini = src.indexOf('//  LÓGICA PURA · empieza');
const fin = src.indexOf('//  LÓGICA PURA · termina');
if (ini < 0 || fin < 0) { console.log('No se encontraron las marcas de la lógica pura.'); process.exit(1); }

const { llaveOk, mensajesDe, textoDe, anuncioDe, campanaDe } =
  new Function(`
    ${src.slice(ini, fin)}
    return { llaveOk, mensajesDe, textoDe, anuncioDe, campanaDe };
  `)();

// Un aviso como el que manda 360dialog, en formato de Meta.
const aviso = (...mensajes) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '1', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '526641110000', phone_number_id: '999' },
    contacts: [{ profile: { name: 'Rosa Vega' }, wa_id: '5216645550000' }],
    messages: mensajes
  } }] }]
});

const texto = (extra = {}) => Object.assign({
  from: '5216645550000', id: 'wamid.ABC', timestamp: '1790000000',
  type: 'text', text: { body: 'Hola, quiero información de salones' }
}, extra);

const DE_ANUNCIO = {
  source_url: 'https://fb.me/xyz', source_type: 'ad',
  source_id: '120210000000007',
  headline: 'Bodas en Quartz', body: 'Salones para 200 personas',
  media_type: 'image', ctwa_clid: 'ARBxyz123'
};

console.log('\n== La cerradura ==');
/* Con "Verify JWT" apagado esta dirección la puede tocar cualquiera, y las
   cuentas de cliente de 360dialog NO firman sus webhooks. La cabecera secreta
   es la única defensa: sin ella, cualquiera inventa leads. */
{
  const bueno = 'un-secreto-bastante-largo-de-verdad';
  ok('LA LLAVE BUENA ABRE', llaveOk(bueno, bueno));
  ok('UNA LLAVE DISTINTA NO', !llaveOk('otra-cosa-igual-de-larga-pero-no', bueno));
  ok('y una vacía tampoco', !llaveOk('', bueno) && !llaveOk(undefined, bueno));
  ok('NI UN PREFIJO DE LA BUENA', !llaveOk(bueno.slice(0, -1), bueno));
  ok('ni la buena con algo pegado', !llaveOk(bueno + 'x', bueno));

  /* Si el secreto no se puso, NADIE entra. Lo contrario —abrir cuando no hay
     secreto— convertiría un olvido de configuración en una puerta abierta. */
  ok('SIN SECRETO PUESTO NO ENTRA NADIE, ni con la cadena vacía',
     !llaveOk('', '') && !llaveOk('lo que sea', ''));
  ok('y un secreto corto se trata como no puesto',
     !llaveOk('corto', 'corto'));
}

console.log('\n== Qué es un lead y qué no ==');
{
  const m = mensajesDe(aviso(texto()), '526641110000');
  ok('UN MENSAJE QUE ENTRA ES UN LEAD', m.length === 1, JSON.stringify(m));
  ok('con su teléfono y su id', m[0].telefono === '5216645550000' &&
     m[0].mensaje_id === 'wamid.ABC', JSON.stringify(m[0]));
  ok('y el nombre que trae su WhatsApp', m[0].perfil === 'Rosa Vega');
  ok('y lo que escribió', m[0].texto === 'Hola, quiero información de salones');

  /* La mayoría del tráfico son acuses de "entregado" y "leído". Un acuse no es
     un lead: meterlos llenaría el CRM de gente que no escribió nada. */
  const acuse = { object:'whatsapp_business_account', entry:[{ changes:[{ value:{
    statuses:[{ id:'wamid.ABC', status:'delivered', recipient_id:'5216645550000' }] } }] }] };
  ok('UN ACUSE DE ENTREGA NO ES UN LEAD', mensajesDe(acuse, '526641110000').length === 0);

  /* Lo que manda el hotel tampoco: es la respuesta, no un prospecto. */
  const propio = aviso(texto({ from:'526641110000', id:'wamid.MIO' }));
  ok('LO QUE MANDA EL HOTEL TAMPOCO ES UN LEAD',
     mensajesDe(propio, '526641110000').length === 0);
  ok('pero sin saber el número del hotel no se tira nada',
     mensajesDe(propio, '').length === 1);

  ok('un mensaje sin id se tira: sin él no hay cómo evitar duplicarlo',
     mensajesDe(aviso(texto({ id:'' })), '526641110000').length === 0);
  ok('y uno sin remitente también',
     mensajesDe(aviso(texto({ from:'' })), '526641110000').length === 0);

  ok('un aviso vacío no truena',
     mensajesDe({}, '1').length === 0 && mensajesDe(undefined, '1').length === 0);

  const dos = mensajesDe(aviso(texto(), texto({ id:'wamid.DOS' })), '526641110000');
  ok('DOS MENSAJES EN UN AVISO SON DOS LEADS, no uno', dos.length === 2);
}

console.log('\n== De qué anuncio llegó ==');
/* Esto es lo que hace valiosa toda la conexión: sin el id del anuncio, el lead
   cae sin saber de dónde vino y el conjunto sigue saliendo con cero leads. */
{
  const m = mensajesDe(aviso(texto({ referral: DE_ANUNCIO })), '526641110000');
  ok('EL MENSAJE SE QUEDA CON EL ANUNCIO DEL QUE VINO',
     anuncioDe(m[0].referral) === '120210000000007', JSON.stringify(m[0].referral));
  ok('y se guarda el referral COMPLETO, no sólo el id',
     m[0].referral.headline === 'Bodas en Quartz' &&
     m[0].referral.ctwa_clid === 'ARBxyz123');

  ok('sin referral no se inventa un anuncio',
     anuncioDe(mensajesDe(aviso(texto()), '526641110000')[0].referral) === '');
  ok('y lo que viene de otro lado tampoco cuenta como anuncio',
     anuncioDe({ source_type:'post', source_id:'123' }) === '');
  ok('ni un referral sin id', anuncioDe({ source_type:'ad' }) === '');
  ok('sin nada, tampoco truena', anuncioDe(null) === '' && anuncioDe(undefined) === '');
}

console.log('\n== Lo que escribió, venga como venga ==');
{
  ok('texto normal', textoDe({ type:'text', text:{ body:'Hola' } }) === 'Hola');
  ok('EL BOTÓN DEL ANUNCIO TAMBIÉN DICE ALGO',
     textoDe({ type:'button', button:{ text:'Quiero informes' } }) === 'Quiero informes');
  ok('y la opción que escogió de una lista',
     textoDe({ type:'interactive',
               interactive:{ list_reply:{ title:'Salones' } } }) === 'Salones');
  ok('el pie de una foto cuenta',
     textoDe({ type:'image', image:{ caption:'¿Este salón?' } }) === '¿Este salón?');
  ok('LO QUE NO TRAE TEXTO NO LLEGA EN BLANCO: se dice qué fue',
     textoDe({ type:'audio', audio:{ id:'1' } }) === '(mandó audio)');
  ok('y sin mensaje no truena', textoDe(null) === '' && textoDe(undefined) === '');
}

console.log('\n== De qué campaña del CRM es ==');
/* Se resuelve en el servidor y no en el navegador a propósito: el catálogo de
   Meta sólo lo puede leer marketing y las campañas no le bajan a ventas, así
   que si lo resolviera quien sincroniza, un gerente de ventas dejaría todos
   los leads sin campaña —y sin remedio, porque el mensaje ya quedó marcado—. */
{
  const campanas = [
    { datos: { id:'cb', nombre:'QZ_BODAS_TJ',    metaIds:['201'] } },
    { datos: { id:'cc', nombre:'QZ_CATERING_TJ', metaIds:['202','203'] } },
    { datos: { id:'cx', nombre:'Expo, sin Meta', metaIds:[] } }
  ];
  ok('EL CONJUNTO ENCUENTRA SU CAMPAÑA', campanaDe(campanas, '201') === 'cb');
  ok('y una campaña con varios conjuntos también',
     campanaDe(campanas, '203') === 'cc');
  ok('UN CONJUNTO QUE NADIE TIENE ENLAZADO NO SE CUELGA DE OTRA:\n' +
     '       más vale sin campaña que en la equivocada',
     campanaDe(campanas, '999') === '');
  ok('sin conjunto no hay campaña', campanaDe(campanas, '') === '' &&
     campanaDe(campanas, null) === '');
  ok('y sin campañas tampoco truena', campanaDe([], '201') === '' &&
     campanaDe(undefined, '201') === '');
  ok('los ids se comparan como texto, vengan como vengan de la nube',
     campanaDe([{ datos:{ id:'c1', metaIds:[201] } }], '201') === 'c1');
}

console.log('\n== Lo que el archivo promete ==');
{
  ok('NO MIRA EL CUERPO HASTA COMPROBAR LA LLAVE',
     src.indexOf('llaveOk(traida, secreto)') < src.indexOf('await req.json()'),
     'la comprobación va después de leer el cuerpo');
  ok('el secreto sale de los secretos del proyecto, no está escrito aquí',
     src.includes('Deno.env.get("WA_SECRET")') &&
     !/WA_SECRET\s*=\s*["'][^"']{8,}/.test(src));
  ok('NO SE DUPLICA UN MENSAJE REINTENTADO',
     src.includes('onConflict: "mensaje_id"') && src.includes('ignoreDuplicates: true'));
  ok('CONTESTA 200 AUNQUE FALLE, para que el proveedor no reintente sin fin',
     /catch[\s\S]{0,400}responde\(200/.test(src));
  ok('y deja anotado el fallo en la bitácora',
     /catch[\s\S]{0,700}anota\("error", false/.test(src));
  ok('un acuse también contesta 200: si no, se reintentaría para siempre',
     /anota\("acuse"[\s\S]{0,120}responde\(200/.test(src));
  ok('NUNCA ESCRIBE EN WHATSAPP: esta puerta sólo recibe',
     !/graph\.facebook[\s\S]{0,200}method:\s*["']POST["']/.test(src) &&
     !/360dialog\.io/.test(src));
  ok('y no anota en la bitácora lo que escribió la gente',
     !/anota\([^)]*texto/.test(src));
  ok('LA CAMPAÑA SE RESUELVE AQUÍ, donde se ve el catálogo Y las campañas',
     src.includes('from("crm_meta_objetos")') && src.includes('from("crm_datos")') &&
     src.includes('campana_id: campanaDe('));
  ok('y si no se puede resolver, el mensaje se guarda igual: perder el amarre\n' +
     '       es malo, perder el lead es peor',
     /no se pudo resolver la campaña[\s\S]{0,900}upsert\(filas/.test(src));
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
