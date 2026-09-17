// ===========================================================================
//  CRM CORE · La función que le pregunta a Gemini
//
//  La llave de Google NO puede vivir en index.html: esa página es pública y
//  cualquiera podría sacarla y gastar con ella. Vive aquí, como secreto del
//  proyecto, y esta función es la única que la usa. Antes de contestar
//  comprueba que quien pregunta traiga una sesión válida del CRM.
//
//  Cómo se sube, sin terminal: en supabase.com → Edge Functions →
//  "Deploy a new function" → "Via Editor", con el nombre exacto "ia", y se
//  pega este archivo completo. La llave se guarda ahí mismo, en Secrets,
//  con el nombre GEMINI_API_KEY.
//
//  Todo el detalle, en IA.md.
// ===========================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Un renglón de JSON por pedazo: el CRM los va pintando conforme llegan. */
const linea = (o: unknown) => new TextEncoder().encode(JSON.stringify(o) + "\n");

type Mensaje = { role: "user" | "assistant"; content: string };

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
let modelosCache: string[] = [];

/** Google anda ocupado o nos pasamos de cuota: se puede reintentar. */
class Pasajero extends Error {}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Qué modelos usar, en orden de preferencia.
 *
 * Google renombra sus modelos cada pocos meses, así que en vez de dejar un
 * nombre escrito a mano que algún día deje de existir, se le pregunta a Google
 * cuáles tiene. Se prefieren los "flash" —los baratos, los de la capa
 * gratuita— y de ésos, los de versión más alta que sean estables.
 *
 * Se devuelve la lista entera y no sólo el primero porque en la capa gratuita
 * es común que el modelo de moda esté saturado: si pasa, se baja al siguiente
 * en vez de dejar al usuario con un error.
 */
async function escogerModelos(key: string): Promise<string[]> {
  const forzado = Deno.env.get("GEMINI_MODEL");
  if (forzado) return [forzado];
  if (modelosCache.length) return modelosCache;

  const r = await fetch(`${GEMINI}/models?key=${encodeURIComponent(key)}&pageSize=200`);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(
      `Google no aceptó la llave al listar sus modelos (${r.status}). ` +
      `Revise que GEMINI_API_KEY esté bien puesta. ${t.slice(0, 200)}`,
    );
  }
  const { models = [] } = await r.json();

  const candidatos = models
    .filter((m: any) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent") &&
      /(^|\/)models\/gemini-/.test(m.name ?? "") &&
      !/(embedding|aqa|vision|tts|image|live|native-audio)/i.test(m.name)
    )
    .map((m: any) => {
      const id: string = String(m.name).replace(/^models\//, "");
      const v = parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) ?? [])[1] ?? "0");
      // flash primero (es el de la capa gratuita), luego lite, luego pro
      const familia = /flash-lite/.test(id) ? 1 : /flash/.test(id) ? 2 : /pro/.test(id) ? 0 : 0;
      const estable = /(exp|preview|latest)/i.test(id) ? 0 : 1;
      return { id, puntos: familia * 1000 + v * 10 + estable };
    })
    .sort((a: any, b: any) => b.puntos - a.puntos)
    .map((x: any) => x.id);

  if (!candidatos.length)
    throw new Error("Google no devolvió ningún modelo de texto para esta llave.");
  modelosCache = candidatos;
  return modelosCache;
}

/** Una pasada contra un modelo. Devuelve true si alcanzó a escribir algo. */
async function unIntento(
  key: string, modelo: string, sistema: string, mensajes: Mensaje[],
  emite: (o: unknown) => void, marcaEscrito: () => void,
){
  const r = await fetch(
    `${GEMINI}/models/${modelo}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sistema }] },
        contents: mensajes.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 4096, temperature: 0.4 },
      }),
    },
  );

  if (!r.ok || !r.body) {
    const t = await r.text().catch(() => "");
    // 429: se acabó la cuota del rato. 503/500: Google anda saturado.
    // Los dos se arreglan solos esperando o cambiando de modelo.
    if (r.status === 429 || r.status === 503 || r.status === 500)
      throw new Pasajero(String(r.status));
    throw new Error(`Google contestó ${r.status}. ${t.slice(0, 300)}`);
  }

  const lector = r.body.getReader();
  const deco = new TextDecoder();
  let resto = "";
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    resto += deco.decode(value, { stream: true });
    const partes = resto.split("\n");
    resto = partes.pop() ?? "";
    for (const l of partes) {
      const s = l.trim();
      if (!s.startsWith("data:")) continue;
      const crudo = s.slice(5).trim();
      if (!crudo || crudo === "[DONE]") continue;
      let d: any;
      try { d = JSON.parse(crudo); } catch { continue; }
      if (d.error) throw new Error(d.error.message ?? "error de Google");
      for (const p of d.candidates?.[0]?.content?.parts ?? [])
        if (p.text) { marcaEscrito(); emite({ t: p.text }); }
      const fin = d.candidates?.[0]?.finishReason;
      if (fin === "MAX_TOKENS") emite({ t: "\n\n[La respuesta se cortó por larga.]" });
      else if (fin && fin !== "STOP")
        emite({ error: `Google cortó la respuesta (${fin}). Pruebe a preguntarlo de otra manera.` });
    }
  }
}

/**
 * Pregunta, insistiendo cuando Google anda ocupado.
 *
 * En la capa gratuita el 503 es pan de cada día: el modelo de moda se satura
 * a ratos. Se reintenta una vez sobre el mismo modelo y, si sigue, se baja al
 * siguiente de la lista. Eso sí, en cuanto empezó a escribir ya no se
 * reintenta nada: se vería la respuesta repetida a medias.
 */
async function preguntar(
  key: string, sistema: string, mensajes: Mensaje[],
  emite: (o: unknown) => void,
): Promise<string> {
  const modelos = (await escogerModelos(key)).slice(0, 3);
  let escribio = false;
  const marca = () => { escribio = true; };

  for (let i = 0; i < modelos.length; i++) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        await unIntento(key, modelos[i], sistema, mensajes, emite, marca);
        return modelos[i];
      } catch (e) {
        if (escribio || !(e instanceof Pasajero)) throw e;
        // Un respiro antes de volver a tocar el mismo modelo.
        if (intento === 0) await espera(1500);
      }
    }
  }

  throw new Error(
    "Google está saturado en este momento y ya probamos con " +
    `${modelos.length} de sus modelos. Espere un par de minutos y vuelva a preguntar; ` +
    "no es nada del CRM.",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const responde = (cod: number, cuerpo: unknown) =>
    new Response(JSON.stringify(cuerpo), {
      status: cod,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    // ---- 1. ¿Quién pregunta? Tiene que ser alguien del equipo -------------
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return responde(401, { error: "Falta la sesión." });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user }, error: errUser } = await supabase.auth.getUser();
    if (errUser || !user) return responde(401, { error: "La sesión no es válida." });

    // ---- 2. La llave -----------------------------------------------------
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key)
      return responde(500, {
        error: "Falta la llave de Google en Supabase. Sistemas la pone con:\n" +
               "  supabase secrets set GEMINI_API_KEY=...",
      });

    // ---- 3. Lo que viene del CRM ----------------------------------------
    const { mensajes, instrucciones, contexto } = await req.json();
    if (!Array.isArray(mensajes) || !mensajes.length)
      return responde(400, { error: "No llegó ninguna pregunta." });

    const sistema = [
      String(instrucciones ?? ""),
      contexto
        ? "Esto es lo que la persona que pregunta alcanza a ver en el CRM en este " +
          "momento:\n\n" + String(contexto)
        : "La persona decidió no compartir sus datos del CRM en esta conversación. " +
          "Conteste con lo que sepa en general y dígale que, para respuestas sobre su " +
          "cartera, active la casilla de abajo.",
    ].join("\n\n");

    // ---- 4. Se pregunta y se devuelve conforme va llegando ---------------
    const stream = new ReadableStream({
      async start(controller) {
        const emite = (o: unknown) => controller.enqueue(linea(o));
        try {
          const modelo = await preguntar(key, sistema, mensajes, emite);
          emite({ motor: "gemini", modelo });
        } catch (e) {
          emite({ error: (e as Error).message ?? "falló la consulta" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...CORS, "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  } catch (e) {
    return responde(500, { error: (e as Error).message ?? "error inesperado" });
  }
});
