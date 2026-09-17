// ===========================================================================
//  CRM CORE · La función que le pregunta a la IA
//
//  Sirve con dos motores y se escoge solo según la llave que esté puesta:
//
//    GEMINI_API_KEY     → Google Gemini (tiene capa gratuita)
//    ANTHROPIC_API_KEY  → Claude (siempre de paga, por uso)
//
//  Si están las dos, manda MOTOR_IA ("gemini" o "claude"); sin eso, gana
//  Gemini por ser el que no cobra.
//
//  La llave NO puede vivir en index.html: esa página es pública y cualquiera
//  podría sacarla y gastar con ella. Vive aquí, como secreto del proyecto, y
//  esta función es la única que la usa. Antes de contestar comprueba que quien
//  pregunta traiga una sesión válida del CRM.
//
//  Cómo se sube (una vez, desde la computadora de sistemas):
//
//    npm install -g supabase
//    supabase login
//    supabase link --project-ref <el-ref-del-proyecto>
//    supabase secrets set GEMINI_API_KEY=...        # o ANTHROPIC_API_KEY=sk-ant-...
//    supabase functions deploy ia
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

// ---------------------------------------------------------------------------
//  Gemini
// ---------------------------------------------------------------------------
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
let modeloGeminiCache = "";

/**
 * Qué modelo usar.
 *
 * Google renombra sus modelos cada pocos meses, así que en vez de dejar un
 * nombre escrito a mano que algún día deje de existir, se le pregunta a Google
 * cuáles tiene y se escoge. Se prefiere un "flash" —el barato, el que entra en
 * la capa gratuita— y de ésos, el de versión más alta.
 */
async function modeloGemini(key: string): Promise<string> {
  const forzado = Deno.env.get("GEMINI_MODEL");
  if (forzado) return forzado;
  if (modeloGeminiCache) return modeloGeminiCache;

  const r = await fetch(`${GEMINI}/models?key=${encodeURIComponent(key)}&pageSize=200`);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Google no aceptó la llave al listar modelos (${r.status}). ${t.slice(0, 200)}`);
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
    .sort((a: any, b: any) => b.puntos - a.puntos);

  if (!candidatos.length)
    throw new Error("Google no devolvió ningún modelo de texto para esta llave.");
  modeloGeminiCache = candidatos[0].id;
  return modeloGeminiCache;
}

async function conGemini(
  key: string, sistema: string, mensajes: Mensaje[],
  emite: (o: unknown) => void,
){
  const modelo = await modeloGemini(key);
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
        if (p.text) emite({ t: p.text });
      const fin = d.candidates?.[0]?.finishReason;
      if (fin && fin !== "STOP" && fin !== "MAX_TOKENS")
        emite({ error: `Google cortó la respuesta (${fin}). Pruebe a preguntarlo de otra manera.` });
      if (fin === "MAX_TOKENS") emite({ t: "\n\n[La respuesta se cortó por larga.]" });
    }
  }
  return modelo;
}

// ---------------------------------------------------------------------------
//  Claude
// ---------------------------------------------------------------------------
async function conClaude(
  key: string, sistema: string, mensajes: Mensaje[],
  emite: (o: unknown) => void,
){
  const { default: Anthropic } = await import("npm:@anthropic-ai/sdk@0.71.0");
  const modelo = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5";
  const anthropic = new Anthropic({ apiKey: key });

  const stream = anthropic.beta.messages.stream({
    model: modelo,
    max_tokens: 4096,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [{ type: "text", text: sistema }],
    messages: mensajes,
  });

  for await (const ev of stream)
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta")
      emite({ t: ev.delta.text });

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal")
    emite({ error: "El servicio no quiso contestar esta petición. Pruebe a preguntarlo de otra manera." });
  else if (final.stop_reason === "max_tokens")
    emite({ t: "\n\n[La respuesta se cortó por larga.]" });
  return modelo;
}

// ---------------------------------------------------------------------------
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

    // ---- 2. Qué motor y con qué llave ------------------------------------
    const llaveG = Deno.env.get("GEMINI_API_KEY");
    const llaveC = Deno.env.get("ANTHROPIC_API_KEY");
    const pedido = (Deno.env.get("MOTOR_IA") ?? "").toLowerCase();
    // Sin preferencia gana Gemini: es el que tiene capa gratuita.
    const motor = pedido === "claude" ? "claude"
                : pedido === "gemini" ? "gemini"
                : llaveG ? "gemini" : llaveC ? "claude" : "";

    if (!motor || (motor === "gemini" && !llaveG) || (motor === "claude" && !llaveC))
      return responde(500, {
        error: "Falta la llave de la IA en Supabase. Sistemas la pone con uno de estos:\n" +
               "  supabase secrets set GEMINI_API_KEY=...        (gratis hasta cierto uso)\n" +
               "  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  (de paga, por uso)",
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
          const modelo = motor === "gemini"
            ? await conGemini(llaveG!, sistema, mensajes, emite)
            : await conClaude(llaveC!, sistema, mensajes, emite);
          emite({ motor, modelo });
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
