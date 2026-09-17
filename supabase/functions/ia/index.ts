// ===========================================================================
//  CRM CORE · La función que le pregunta a Claude
//
//  La llave de Anthropic NO puede vivir en index.html: esa página es pública
//  y cualquiera podría sacarla y gastar con ella. Vive aquí, en Supabase,
//  como secreto del proyecto, y esta función es la única que la usa.
//
//  Antes de contestar comprueba que quien pregunta traiga una sesión válida
//  del CRM. Sin eso, cualquiera con la dirección podría gastar la llave.
//
//  Cómo se sube (una vez, desde la computadora de sistemas):
//
//    npm install -g supabase
//    supabase login
//    supabase link --project-ref <el-ref-del-proyecto>
//    supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//    supabase functions deploy ia
//
//  Todo el detalle, en IA.md.
// ===========================================================================

import Anthropic from "npm:@anthropic-ai/sdk@0.71.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Un renglón de JSON por pedazo: el CRM los va pintando conforme llegan. */
const linea = (o: unknown) => new TextEncoder().encode(JSON.stringify(o) + "\n");

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
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey)
      return responde(500, {
        error: "Falta la llave de Anthropic en Supabase. " +
               "Sistemas la pone con: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...",
      });

    // ---- 3. Lo que viene del CRM ----------------------------------------
    const { mensajes, instrucciones, contexto } = await req.json();
    if (!Array.isArray(mensajes) || !mensajes.length)
      return responde(400, { error: "No llegó ninguna pregunta." });

    const sistema = [
      { type: "text" as const, text: String(instrucciones ?? "") },
      ...(contexto
        ? [{
            type: "text" as const,
            text: "Esto es lo que la persona que pregunta alcanza a ver en el CRM " +
                  "en este momento:\n\n" + String(contexto),
          }]
        : [{
            type: "text" as const,
            text: "La persona decidió no compartir sus datos del CRM en esta " +
                  "conversación. Conteste con lo que sepa en general y dígale que, " +
                  "para respuestas sobre su cartera, active la casilla de abajo.",
          }]),
    ];

    const anthropic = new Anthropic({ apiKey });

    // ---- 4. Se pregunta y se devuelve conforme va llegando ---------------
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const respuesta = anthropic.beta.messages.stream({
            model: "claude-opus-5",
            max_tokens: 8000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            thinking: { type: "adaptive" },
            output_config: { effort: "medium" },
            system: sistema,
            messages: mensajes,
          });

          for await (const evento of respuesta) {
            if (
              evento.type === "content_block_delta" &&
              evento.delta.type === "text_delta"
            ) controller.enqueue(linea({ t: evento.delta.text }));
          }

          const final = await respuesta.finalMessage();
          if (final.stop_reason === "refusal")
            controller.enqueue(linea({
              error: "El servicio no quiso contestar esta petición. " +
                     "Pruebe a preguntarlo de otra manera.",
            }));
          else if (final.stop_reason === "max_tokens")
            controller.enqueue(linea({ t: "\n\n[La respuesta se cortó por larga.]" }));
        } catch (e) {
          controller.enqueue(linea({ error: (e as Error).message ?? "falló la consulta" }));
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
