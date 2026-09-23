// Prueba la lógica de la función de Supabase sin Supabase y sin Meta: se le
// dan las mismas respuestas que manda Meta y se comprueba que las desarme
// bien, que no cuente de más y que un error se traduzca a algo que una
// persona pueda leer.
//
// Lo que se prueba se saca del propio index.ts, tal cual está escrito, para
// que no se pueda probar una copia distinta de la que se sube.
//
//   node supabase/functions/meta-sync/prueba.mjs
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c){ pass++; console.log('  ok   ' + n); }
                               else { fail++; console.log('  FALLA ' + n + (x ? ' :: ' + x : '')); } };

const src = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const ini = src.indexOf('//  LÓGICA PURA · empieza');
const fin = src.indexOf('//  LÓGICA PURA · termina');
if (ini < 0 || fin < 0) { console.log('No se encontraron las marcas de la lógica pura.'); process.exit(1); }

const VERSION_DEF = (src.match(/const VERSION_DEF = "([^"]+)"/) || [])[1] || '';
ok('el archivo fija una versión de la API de Meta', /^v\d+\.\d+$/.test(VERSION_DEF), VERSION_DEF);

const { ventana, leadsDe, filaMetrica, objetosDeInsights, mensajeDeError, normalizaCuenta,
        nivelDe } =
  new Function('VERSION_DEF', `
    ${src.slice(ini, fin)}
    return { ventana, leadsDe, filaMetrica, objetosDeInsights, mensajeDeError, normalizaCuenta,
             nivelDe };
  `)(VERSION_DEF);

console.log('\n== La cuenta publicitaria, como la pegue quien la pegue ==');
{
  ok('EL NÚMERO PELÓN TAMBIÉN SIRVE', normalizaCuenta('1234567890') === 'act_1234567890',
     normalizaCuenta('1234567890'));
  ok('con act_ adelante, igual', normalizaCuenta('act_1234567890') === 'act_1234567890');
  ok('con espacios de más, igual', normalizaCuenta('  act_1234567890 ') === 'act_1234567890');
  ok('con comillas pegadas al copiar, igual',
     normalizaCuenta('"act_1234567890"') === 'act_1234567890');
  ok('un espacio en medio no lo parte', normalizaCuenta('act_ 1234567890') === 'act_1234567890');
  ok('lo que no es una cuenta se rechaza, no se adivina',
     normalizaCuenta('la cuenta del hotel') === '' && normalizaCuenta('') === '' &&
     normalizaCuenta('act_') === '' && normalizaCuenta(undefined) === '');
}

console.log('\n== La ventana que se vuelve a leer ==');
{
  const v = ventana('2026-09-21', 7);
  ok('SON SIETE DÍAS CONTANDO HOY', v.desde === '2026-09-15' && v.hasta === '2026-09-21',
     JSON.stringify(v));
  const m = ventana('2026-03-02', 7);
  ok('y cruza el cambio de mes sin inventarse fechas',
     m.desde === '2026-02-24' && m.hasta === '2026-03-02', JSON.stringify(m));
  const b = ventana('2028-03-01', 3);
  ok('ni se le pierde el 29 de febrero de un año bisiesto',
     b.desde === '2028-02-28' && b.hasta === '2028-03-01', JSON.stringify(b));
  const u = ventana('2026-09-21', 1);
  ok('un solo día es ese día, no cero días', u.desde === u.hasta && u.desde === '2026-09-21',
     JSON.stringify(u));
}

console.log('\n== Cuántos leads trajo de verdad ==');
{
  ok('suma el lead de toda la vida', leadsDe([{ action_type:'lead', value:'3' }]) === 3);
  ok('y el del formulario de Meta',
     leadsDe([{ action_type:'onsite_conversion.lead_grouped', value:'2' }]) === 2);
  ok('NO CUENTA CLICS NI VISTAS COMO LEADS',
     leadsDe([{ action_type:'link_click', value:'480' },
              { action_type:'video_view', value:'9000' },
              { action_type:'post_engagement', value:'1200' }]) === 0);
  ok('de una lista revuelta saca nada más los leads',
     leadsDe([{ action_type:'link_click', value:'480' },
              { action_type:'lead', value:'4' },
              { action_type:'onsite_conversion.lead_grouped', value:'1' }]) === 5);
  ok('sin acciones no truena', leadsDe(undefined) === 0 && leadsDe([]) === 0);
}

console.log('\n== Un renglón de Meta se vuelve un renglón de la tabla ==');
{
  const ins = { campaign_id:'120210000000000123', campaign_name:'Bodas verano',
    spend:'1234.567', impressions:'45000', reach:'30000', clicks:'780',
    actions:[{ action_type:'lead', value:'12' }, { action_type:'link_click', value:'700' }],
    date_start:'2026-09-20', date_stop:'2026-09-20' };
  const f = filaMetrica(ins, 'act_999', 'MXN');
  ok('el gasto llega a centavos, no a milésimas', f.gasto === 1234.57, String(f.gasto));
  ok('los números llegan como números y no como texto',
     f.impresiones === 45000 && f.clics === 780 && typeof f.impresiones === 'number');
  ok('los leads salen de las acciones', f.leads === 12, String(f.leads));
  ok('se guarda la moneda de la cuenta', f.moneda === 'MXN');
  ok('la llave es nivel, objeto y fecha',
     f.nivel === 'campana' && f.objeto === '120210000000000123' && f.fecha === '2026-09-20');

  ok('NO SE GUARDA NADA MÁS QUE CIFRAS',
     !JSON.stringify(f).includes('Bodas verano'), JSON.stringify(f));

  ok('un renglón sin campaña se tira', filaMetrica({ date_start:'2026-09-20' }) === null);
  ok('y uno con fecha rara también',
     filaMetrica({ campaign_id:'1', date_start:'la semana pasada' }) === null);
  const vacio = filaMetrica({ campaign_id:'1', date_start:'2026-09-20' }, 'act_1', '');
  ok('un día sin gasto es cero, no es basura',
     vacio.gasto === 0 && vacio.impresiones === 0 && vacio.leads === 0);
}

console.log('\n== De qué nivel es cada renglón ==');
/* Meta contesta los insights con los campos del nivel que se le pidió y con
   los de arriba: un renglón de conjunto trae adset_id Y campaign_id. Si se
   leyera nada más el campaign_id, el gasto de los conjuntos se guardaría como
   si fuera de la campaña —y el mismo dinero quedaría contado dos veces—. */
{
  const camp = nivelDe({ campaign_id:'120210000000000123', campaign_name:'Bodas verano' });
  ok('un renglón de campaña es una campaña y no cuelga de nadie',
     camp.nivel === 'campana' && camp.objeto === '120210000000000123' &&
     camp.nombre === 'Bodas verano' && camp.padre === '', JSON.stringify(camp));

  const conj = nivelDe({ adset_id:'120210000000000999', adset_name:'QZ_CATERING_TJ',
                         campaign_id:'120210000000000123', campaign_name:'Bodas verano' });
  ok('UN RENGLÓN CON adset_id ES UN CONJUNTO, NO LA CAMPAÑA',
     conj.nivel === 'conjunto' && conj.objeto === '120210000000000999',
     JSON.stringify(conj));
  ok('Y CUELGA DE SU CAMPAÑA, que es lo que después evita contar doble',
     conj.padre === '120210000000000123', conj.padre);
  ok('con su propio nombre, no el de la campaña', conj.nombre === 'QZ_CATERING_TJ');

  ok('sin nada útil no inventa un objeto', nivelDe({}).objeto === '' &&
     nivelDe(undefined).objeto === '');
}

console.log('\n== Un conjunto de anuncios se guarda aparte de su campaña ==');
{
  const conj = { adset_id:'120210000000000999', adset_name:'QZ_CATERING_TJ',
    campaign_id:'120210000000000123', campaign_name:'Bodas verano',
    spend:'300.50', impressions:'900', clicks:'40',
    actions:[{ action_type:'lead', value:'3' }],
    date_start:'2026-09-20', date_stop:'2026-09-20' };
  const f = filaMetrica(conj, 'act_999', 'MXN');
  ok('SE GUARDA EN EL NIVEL DE CONJUNTO, con su id, no con el de la campaña',
     f.nivel === 'conjunto' && f.objeto === '120210000000000999', JSON.stringify(f));
  ok('con sus propias cifras', f.gasto === 300.5 && f.leads === 3);
  ok('y tampoco aquí se guarda un nombre', !JSON.stringify(f).includes('CATERING'));

  const o = objetosDeInsights([conj,
    { campaign_id:'120210000000000123', campaign_name:'Bodas verano',
      date_start:'2026-09-20' }], 'act_999');
  ok('EL CATÁLOGO LOS DISTINGUE: dos renglones, no uno', o.length === 2, String(o.length));
  const oc = o.find(x => x.nivel === 'conjunto');
  ok('el conjunto trae el nombre del conjunto y el id de su campaña',
     oc && oc.nombre === 'QZ_CATERING_TJ' && oc.padre === '120210000000000123',
     JSON.stringify(oc));
  ok('y la campaña sigue sin padre',
     o.find(x => x.nivel === 'campana').padre === '');

  /* El mismo id en dos niveles no pasa en Meta, pero si pasara no se deben
     pisar: la llave del catálogo lleva el nivel, como la de la tabla. */
  const chocan = objetosDeInsights([
    { campaign_id:'777', campaign_name:'La campaña', date_start:'2026-09-20' },
    { adset_id:'777', adset_name:'El conjunto', campaign_id:'888',
      date_start:'2026-09-20' }], 'act_999');
  ok('UN ID REPETIDO ENTRE NIVELES NO SE PISA', chocan.length === 2,
     JSON.stringify(chocan));
}

console.log('\n== El catálogo de nombres ==');
{
  const filas = [
    { campaign_id:'1', campaign_name:'Bodas verano', date_start:'2026-09-19' },
    { campaign_id:'1', campaign_name:'Bodas verano', date_start:'2026-09-20' },
    { campaign_id:'2', campaign_name:'Quinceañeras', date_start:'2026-09-20' },
    { campaign_name:'sin id', date_start:'2026-09-20' }
  ];
  const o = objetosDeInsights(filas, 'act_999');
  ok('UNA CAMPAÑA DE SIETE DÍAS ES UNA CAMPAÑA, NO SIETE', o.length === 2, String(o.length));
  ok('con su nombre para poder escogerla de una lista',
     o[0].nombre === 'Bodas verano' && o[1].nombre === 'Quinceañeras');
  ok('lo que viene sin id no entra', !o.some(x => !x.objeto));
}

console.log('\n== Un error de Meta, en cristiano ==');
{
  const caducado = mensajeDeError(400, { error:{ code:190, error_subcode:463,
    message:'Error validating access token: Session has expired' } });
  ok('UN ACCESO CADUCADO SE DICE ASÍ, NO CON EL CÓDIGO 190',
     caducado.includes('caducó') && caducado.includes('META_TOKEN'), caducado);
  ok('y dice dónde está explicado', caducado.includes('META.md'));

  const revocado = mensajeDeError(400, { error:{ code:190, message:'Invalid OAuth access token' } });
  ok('un acceso inválido manda a generar otro', revocado.includes('META_TOKEN'), revocado);

  const permiso = mensajeDeError(403, { error:{ code:200, message:'Permissions error' } });
  ok('la falta de permiso nombra ads_read', permiso.includes('ads_read'), permiso);

  const tope = mensajeDeError(400, { error:{ code:17, message:'User request limit reached' } });
  ok('EL TOPE DE CONSULTAS DICE QUE NO ES DEL CRM',
     tope.includes('no es nada del CRM') || tope.includes('No es nada del CRM'), tope);
  ok('y tranquiliza: lo que ya estaba no se tocó', tope.includes('no se tocaron'), tope);

  const version = mensajeDeError(400, { error:{ code:100,
    message:'(#100) Unsupported version: v26.0' } });
  ok('una versión que Meta ya no reconoce manda a META_API_VERSION',
     version.includes('META_API_VERSION'), version);

  const cuenta = mensajeDeError(400, { error:{ code:803,
    message:'Unsupported get request. Object with ID act_0 does not exist' } });
  ok('una cuenta que no existe manda a revisar META_CUENTA',
     cuenta.includes('META_CUENTA') && cuenta.includes('act_'), cuenta);

  const raro = mensajeDeError(500, { error:{ code:1, message:'An unknown error occurred' } });
  ok('y un error que no conocemos se repite tal cual en vez de inventarse',
     raro.includes('500') && raro.includes('unknown error'), raro);
  ok('sin cuerpo tampoco truena', typeof mensajeDeError(500, null) === 'string');
}

console.log('\n== Lo que el archivo promete ==');
{
  ok('EL CATÁLOGO SE GUARDA ANTES QUE LAS CIFRAS',
     src.indexOf('crm_meta_objetos") \n') < 0 &&
     src.indexOf('from("crm_meta_objetos")') < src.indexOf('from("crm_meta_metricas")\n'));
  ok('y si el catálogo no se guarda, truena en vez de dejar conjuntos sin padre',
     /crm_meta_objetos[\s\S]{0,260}if \(error\) throw/.test(src));
  ok('LEE LOS DOS NIVELES: campañas y conjuntos de anuncios',
     /level=\$\{nivel\}/.test(src) &&
     src.includes('insightsDe("campaign"') && src.includes('insightsDe("adset"'));
  ok('y los conjuntos no tumban la sincronización si fallan',
     /crudasConj[\s\S]{0,400}catch/.test(src));
  ok('NUNCA ESCRIBE EN META: no hay un solo POST a graph.facebook.com',
     !/method:\s*["']POST["'][\s\S]{0,200}graph\.facebook/.test(src) &&
     !/graph\.facebook[\s\S]{0,200}method:\s*["']POST["']/.test(src));
  ok('el acceso sale de los secretos, no está escrito aquí',
     src.includes('Deno.env.get("META_TOKEN")') && !/EAA[A-Za-z0-9]{20,}/.test(src));
  ok('comprueba la sesión antes de cualquier cosa',
     /auth\.getUser\(/.test(src) &&
     // antes de ir por el acceso de Meta, no después
     src.indexOf('auth.getUser(') < src.indexOf('const token = Deno.env.get("META_TOKEN")'));
  ok('y la comprueba con la llave de servicio, que siempre está puesta',
     !src.includes('SUPABASE_ANON_KEY'));
  ok('Y TAMBIÉN EL PAPEL, no sólo la sesión',
     src.includes('PAPELES.includes(papel)') && src.includes('"gte_marketing"'));
  ok('el papel se busca con la llave de servicio, no con la sesión de quien pregunta',
     src.indexOf('const admin = createClient(url, servicio)') <
     src.indexOf('.eq("tipo", "usuarios")'));
  ok('la bitácora se escribe también cuando falla',
     /catch[\s\S]{0,200}await anota\(false/.test(src));
  ok('y un fallo NO pone las cifras en cero',
     !/upsert[\s\S]{0,100}gasto:\s*0/.test(src));
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
