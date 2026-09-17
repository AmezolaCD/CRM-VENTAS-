// Prueba la lógica de la función de Supabase sin Supabase: se le da el mismo
// listado que devuelve Google y se comprueba que escoja bien, y se le da un
// flujo SSE de mentiras para ver que lo desarme igual que el de verdad.
import fs from 'node:fs';
let pass = 0, fail = 0;
const ok = (n, c, x='') => { if (c){ pass++; console.log('  ok   ' + n); }
                             else { fail++; console.log('  FALLA ' + n + (x ? ' :: ' + x : '')); } };

const src = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

// --- se extrae el criterio de selección tal cual está escrito ---
const trozo = src.slice(src.indexOf('const candidatos = models'),
                        src.indexOf('if (!candidatos.length)'));
const escoge = new Function('models', `
  ${trozo.replace(/: any/g, '').replace(/const id: string/, 'const id')}
  return candidatos.length ? candidatos[0] : null;
`);

const m = (name, metodos = ['generateContent']) =>
  ({ name: 'models/' + name, supportedGenerationMethods: metodos });

console.log('\n== Escoger modelo de Gemini ==');
ok('prefiere flash sobre pro',
   escoge([m('gemini-2.5-pro'), m('gemini-2.5-flash')]) === 'gemini-2.5-flash',
   escoge([m('gemini-2.5-pro'), m('gemini-2.5-flash')]));
ok('y la versión más alta',
   escoge([m('gemini-1.5-flash'), m('gemini-2.5-flash'), m('gemini-2.0-flash')]) === 'gemini-2.5-flash',
   escoge([m('gemini-1.5-flash'), m('gemini-2.5-flash'), m('gemini-2.0-flash')]));
ok('prefiere estable antes que preview',
   escoge([m('gemini-3.0-flash-preview'), m('gemini-3.0-flash')]) === 'gemini-3.0-flash',
   escoge([m('gemini-3.0-flash-preview'), m('gemini-3.0-flash')]));
ok('deja fuera los de embeddings',
   escoge([m('text-embedding-004'), m('gemini-embedding-001'), m('gemini-2.5-flash')]) === 'gemini-2.5-flash',
   escoge([m('text-embedding-004'), m('gemini-embedding-001'), m('gemini-2.5-flash')]));
ok('deja fuera imagen, audio y tts',
   escoge([m('gemini-2.5-flash-image'), m('gemini-2.5-flash-tts'),
           m('gemini-2.5-flash-native-audio'), m('gemini-2.5-flash')]) === 'gemini-2.5-flash');
ok('deja fuera lo que no sabe generar texto',
   escoge([m('gemini-9.9-flash', ['embedContent']), m('gemini-2.5-flash')]) === 'gemini-2.5-flash',
   escoge([m('gemini-9.9-flash', ['embedContent']), m('gemini-2.5-flash')]));
ok('aguanta un nombre que todavía no existe',
   escoge([m('gemini-4.0-flash'), m('gemini-2.5-flash')]) === 'gemini-4.0-flash',
   escoge([m('gemini-4.0-flash'), m('gemini-2.5-flash')]));
ok('si sólo hay pro, toma pro',
   escoge([m('gemini-2.5-pro')]) === 'gemini-2.5-pro', escoge([m('gemini-2.5-pro')]));
ok('flash normal antes que flash-lite',
   escoge([m('gemini-2.5-flash-lite'), m('gemini-2.5-flash')]) === 'gemini-2.5-flash',
   escoge([m('gemini-2.5-flash-lite'), m('gemini-2.5-flash')]));
ok('sin nada servible, no escoge', escoge([m('text-embedding-004')]) === null);

console.log('\n== Desarmar lo que manda Google ==');
// mismo recorrido de líneas SSE que hace conGemini
function desarma(texto){
  const out = []; let resto = '';
  for (const pedazo of texto.match(/[\s\S]{1,17}/g)){      // llega cortado a la mitad
    resto += pedazo;
    const partes = resto.split('\n'); resto = partes.pop() ?? '';
    for (const l of partes){
      const s2 = l.trim();
      if (!s2.startsWith('data:')) continue;
      const crudo = s2.slice(5).trim();
      if (!crudo || crudo === '[DONE]') continue;
      let d; try { d = JSON.parse(crudo); } catch { continue; }
      if (d.error) { out.push({ error: d.error.message }); continue; }
      for (const p of d.candidates?.[0]?.content?.parts ?? []) if (p.text) out.push({ t: p.text });
      const fin = d.candidates?.[0]?.finishReason;
      if (fin === 'MAX_TOKENS') out.push({ t: '\n\n[La respuesta se cortó por larga.]' });
      else if (fin && fin !== 'STOP') out.push({ error: 'cortada: ' + fin });
    }
  }
  return out;
}

const sse = [
  'data: ' + JSON.stringify({ candidates:[{ content:{ parts:[{text:'Hola '}] } }] }),
  '',
  'data: ' + JSON.stringify({ candidates:[{ content:{ parts:[{text:'Marco.'}] }, finishReason:'STOP' }] }),
  '', ''
].join('\n');
ok('junta los pedazos en orden',
   desarma(sse).filter(x => x.t).map(x => x.t).join('') === 'Hola Marco.',
   JSON.stringify(desarma(sse)));
ok('aunque lleguen cortados a media línea', desarma(sse).length === 2);

const cortada = 'data: ' + JSON.stringify(
  { candidates:[{ content:{ parts:[{text:'largo'}] }, finishReason:'MAX_TOKENS' }] }) + '\n';
ok('avisa cuando se corta por larga',
   desarma(cortada).some(x => x.t && x.t.includes('se cortó por larga')));

const bloqueada = 'data: ' + JSON.stringify(
  { candidates:[{ finishReason:'SAFETY' }] }) + '\n';
ok('y cuando Google la corta por otra razón',
   desarma(bloqueada).some(x => x.error && x.error.includes('SAFETY')));

const errG = 'data: ' + JSON.stringify({ error:{ message:'Quota exceeded' } }) + '\n';
ok('pasa tal cual el error de Google',
   desarma(errG)[0].error === 'Quota exceeded');

console.log('\n== Insistir cuando Google anda ocupado ==');
// Se copia el mismo lazo de preguntar(): dos intentos por modelo, hasta tres
// modelos, y nada de reintentos una vez que ya empezó a escribir.
class Pasajero extends Error {}
async function conLazo(modelos, plan){
  let escribio = false, llamadas = [];
  for (let i = 0; i < modelos.length; i++){
    for (let intento = 0; intento < 2; intento++){
      llamadas.push(modelos[i]);
      const r = plan(modelos[i], llamadas.length, () => { escribio = true; });
      if (r === 'ok') return { modelo: modelos[i], llamadas, escribio };
      if (escribio || r !== 'ocupado') throw new Error(r);
    }
  }
  throw new Error('saturado');
}
const tres = ['a-flash','b-flash','c-pro'];

let r1 = await conLazo(tres, (m, n) => n === 1 ? 'ocupado' : 'ok');
ok('un 503 suelto se reintenta solo sobre el mismo modelo',
   r1.modelo === 'a-flash' && r1.llamadas.join() === 'a-flash,a-flash', r1.llamadas.join());

let r2 = await conLazo(tres, (m) => m === 'a-flash' ? 'ocupado' : 'ok');
ok('SI UN MODELO SIGUE SATURADO, SE BAJA AL SIGUIENTE',
   r2.modelo === 'b-flash' && r2.llamadas.length === 3, r2.llamadas.join());

let falla = null;
try { await conLazo(tres, () => 'ocupado'); } catch(e){ falla = e.message; }
ok('si todos están saturados, lo dice en vez de colgarse', falla === 'saturado', String(falla));

let r3 = null;
try {
  await conLazo(tres, (m, n, marca) => { if (n === 1){ marca(); return 'ocupado'; } return 'ok'; });
} catch(e){ r3 = e.message; }
ok('YA EMPEZADA LA RESPUESTA NO SE REINTENTA, PARA NO REPETIRLA',
   r3 === 'ocupado', String(r3));

let r4 = null;
try { await conLazo(tres, () => 'llave mala'); } catch(e){ r4 = e.message; }
ok('un error de verdad no se reintenta', r4 === 'llave mala', String(r4));

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
