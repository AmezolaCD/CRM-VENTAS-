// ===========================================================================
//  CRM CORE · La puerta por la que entran los mensajes de WhatsApp
//
//  Los anuncios del hotel son de MENSAJES: la gente da clic y escribe. El
//  proveedor —360dialog— avisa aquí cada vez que entra uno, esta función lo
//  deja en el buzón crm_wa, y el CRM lo recoge y lo vuelve un lead.
//
//  Lo que hace valiosa esta puerta: cuando el mensaje viene de un anuncio de
//  clic-a-WhatsApp, trae un objeto `referral` CON EL ID DEL ANUNCIO. De ahí el
//  CRM sube al conjunto y del conjunto a la campaña, así que el lead cae ya
//  amarrado a lo que lo trajo. Es el amarre que no existía.
//
//  Cómo se sube, sin terminal: en supabase.com → Edge Functions →
//  "Deploy a new function" → "Via Editor", con el nombre exacto "wa-hook", y
//  se pega este archivo completo. Después, en la configuración de la función,
//  HAY QUE APAGAR "Verify JWT": 360dialog no trae sesión de Supabase y si se
//  deja prendido el portón rechaza todo antes de llegar aquí.
//
//  Secretos que necesita:
//
//      WA_SECRET   una cadena larga que se inventa una vez. Es la cerradura.
//                  La misma se pone en la cabecera del webhook de 360dialog.
//
//  ---------------------------------------------------------------------------
//  POR QUÉ LA CERRADURA NO ES OPCIONAL
//  ---------------------------------------------------------------------------
//  Con "Verify JWT" apagado, esta dirección la puede tocar cualquiera. Las
//  cuentas de CLIENTE de 360dialog no firman sus webhooks —la firma
//  x-360dialog-signature es de las cuentas de socio—, así que la única defensa
//  es una cabecera secreta que sólo el proveedor manda.
//
//  Por eso NO SE MIRA EL CUERPO hasta comprobarla. Sin esto, cualquiera que
//  adivine la dirección puede inventar leads, y un CRM con leads inventados es
//  peor que uno vacío: se actúa sobre ellos, se les asigna gente, se reporta
//  que la campaña funcionó.
//
//  Todo el detalle, en WHATSAPP.md.
// ===========================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// ===========================================================================
//  LÓGICA PURA · empieza
//
//  Todo lo que hay entre esta marca y la de abajo no toca la red ni la base
//  de datos: entra un dato, sale otro. prueba.mjs lo saca de este archivo tal
//  cual está escrito y lo corre con mensajes de mentiras, para que lo que se
//  prueba sea exactamente lo que se sube.
// ===========================================================================

/**
 * ¿La cabecera trae la cerradura buena?
 *
 * Se compara en TIEMPO CONSTANTE: una comparación normal se corta en la
 * primera letra distinta, y midiendo cuánto tarda se puede adivinar el secreto
 * letra por letra. Con secretos largos es un ataque lento pero real, y no
 * cuesta nada cerrarlo.
 */
function llaveOk(dada, esperada) {
  const a = String(dada || "");
  const b = String(esperada || "");
  if (!b || b.length < 16) return false;   // sin secreto puesto, nadie entra
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * Los mensajes ENTRANTES que trae un aviso, ya desarmados.
 *
 * Un aviso de WhatsApp puede traer varias cosas a la vez, y la mayoría del
 * tráfico NO son mensajes: son acuses de "entregado" y "leído" —`statuses`—.
 * Ésos se tiran aquí. Un acuse no es un lead, y meterlo al buzón llenaría el
 * CRM de gente que no escribió nada.
 *
 * Los mensajes que MANDA el hotel tampoco entran: vienen con `from` igual al
 * número del propio hotel y no son un prospecto, son la respuesta.
 */
function mensajesDe(cuerpo, numeroDelHotel) {
  const salida = [];
  const mio = String(numeroDelHotel || "").replace(/\D/g, "");
  for (const entrada of (cuerpo && cuerpo.entry) || []) {
    for (const cambio of entrada.changes || []) {
      const v = (cambio && cambio.value) || {};
      const perfiles = new Map();
      for (const c of v.contacts || [])
        perfiles.set(String(c.wa_id || ""), String((c.profile && c.profile.name) || ""));

      for (const m of v.messages || []) {
        const de = String(m.from || "").replace(/\D/g, "");
        if (!de) continue;
        if (mio && de === mio) continue;          // lo mandó el hotel, no es lead
        const id = String(m.id || "").trim();
        if (!id) continue;                         // sin id no hay cómo no duplicar

        salida.push({
          mensaje_id: id,
          telefono: de,
          perfil: perfiles.get(String(m.from)) || "",
          tipo: String(m.type || ""),
          texto: textoDe(m),
          referral: m.referral && typeof m.referral === "object" ? m.referral : {},
        });
      }
    }
  }
  return salida;
}

/**
 * Lo que escribió la persona, sea como sea que lo haya mandado.
 *
 * Un mensaje puede ser texto, o una foto con pie, o un botón de los que el
 * anuncio le puso enfrente. Todos dicen algo, y ese algo es lo que después
 * le explica al ejecutivo qué venía buscando. Lo que no trae texto —un audio,
 * una ubicación— se anota como lo que es, para que no llegue en blanco.
 */
function textoDe(m) {
  if (!m) return "";
  if (m.text && m.text.body) return String(m.text.body);
  if (m.button && m.button.text) return String(m.button.text);
  if (m.interactive) {
    const i = m.interactive;
    const r = (i.button_reply || i.list_reply || {});
    if (r.title) return String(r.title);
  }
  for (const k of ["image", "video", "document"])
    if (m[k] && m[k].caption) return String(m[k].caption);
  const tipo = String(m.type || "");
  if (tipo && tipo !== "text") return "(mandó " + tipo + ")";
  return "";
}

/** De qué anuncio llegó, si es que llegó de uno. */
function anuncioDe(referral) {
  const r = referral || {};
  if (String(r.source_type || "").toLowerCase() !== "ad") return "";
  return String(r.source_id || "").trim();
}

/**
 * Qué campaña del CRM tiene enlazado ese conjunto de anuncios.
 *
 * Se resuelve AQUÍ y no en el navegador porque aquí se ve todo: el catálogo de
 * Meta sólo lo puede leer marketing, y las campañas no le bajan a ventas. Si
 * lo resolviera quien sincroniza, un gerente de ventas dejaría todos los leads
 * sin campaña —y sin remedio, porque el mensaje ya quedó marcado—.
 */
function campanaDe(filasCampanas, conjunto) {
  const c = String(conjunto || "").trim();
  if (!c) return "";
  for (const f of filasCampanas || []) {
    const ids = ((f.datos && f.datos.metaIds) || []).map((x) => String(x));
    if (ids.includes(c)) return String((f.datos && f.datos.id) || "");
  }
  return "";
}

// ===========================================================================
//  LÓGICA PURA · termina
// ===========================================================================

Deno.serve(async (req) => {
  const responde = (code, body) =>
    new Response(JSON.stringify(body), {
      status: code, headers: { "Content-Type": "application/json" },
    });

  /* 360dialog verifica la dirección con un GET antes de mandar nada. Se
     contesta 200 a secas: no hay nada que enseñar aquí. */
  if (req.method === "GET") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return responde(405, { error: "Sólo POST." });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const servicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const secreto = Deno.env.get("WA_SECRET") || "";

  /* LA CERRADURA, ANTES DE MIRAR EL CUERPO. No se lee el JSON, no se anota
     nada, no se toca la base: se cierra la puerta y ya. Y el mensaje de vuelta
     no dice qué faltó, porque eso le ayudaría a quien está probando. */
  const traida = req.headers.get("x-crm-llave") ||
                 req.headers.get("X-Crm-Llave") || "";
  if (!llaveOk(traida, secreto)) {
    console.log("wa-hook: tocaron sin la llave buena");
    return responde(401, { error: "No." });
  }

  if (!url || !servicio) {
    console.log("wa-hook: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    return responde(500, { error: "La función no está configurada." });
  }

  const admin = createClient(url, servicio, { auth: { persistSession: false } });
  const anota = async (evento, ok, detalle) => {
    try {
      await admin.from("crm_wa_log").insert({
        evento, ok, detalle: String(detalle || "").slice(0, 500),
      });
    } catch { /* si ni la bitácora se puede escribir, no hay más que hacer */ }
  };

  try {
    const cuerpo = await req.json().catch(() => ({}));
    const míos = mensajesDe(cuerpo, Deno.env.get("WA_NUMERO") || "");

    if (!míos.length) {
      /* Casi todo el tráfico es esto: acuses de entregado y leído. Se contesta
         200 igual, porque si no 360dialog reintenta el mismo aviso una y otra
         vez creyendo que algo falló. */
      await anota("acuse", true, "");
      return responde(200, { ok: true, mensajes: 0 });
    }

    /* De qué conjunto y de qué campaña es cada uno. Dos consultas para todo el
       lote, no dos por mensaje. Si algo de esto falla, el mensaje se guarda de
       todos modos sin campaña: perder el amarre es malo, perder el lead es
       peor. */
    const anuncios = [...new Set(míos.map((m) => anuncioDe(m.referral)).filter(Boolean))];
    const porAnuncio = new Map();
    let campanas: any[] = [];
    if (anuncios.length) {
      try {
        const { data } = await admin.from("crm_meta_objetos")
          .select("objeto,padre").eq("nivel", "anuncio").in("objeto", anuncios);
        for (const o of data || []) porAnuncio.set(String(o.objeto), String(o.padre || ""));
        const r = await admin.from("crm_datos")
          .select("datos").eq("tipo", "campanas").eq("borrado", false);
        campanas = r.data || [];
      } catch (e) {
        console.log("wa-hook: no se pudo resolver la campaña ::", String(e));
      }
    }

    const filas = míos.map((m) => {
      const conjunto = porAnuncio.get(anuncioDe(m.referral)) || "";
      return { ...m, conjunto, campana_id: campanaDe(campanas, conjunto), aplicada: false };
    });

    /* Se inserta ignorando los repetidos. Meta y 360dialog REINTENTAN cuando
       no reciben el 200 a tiempo, y sin esto un reintento levantaría un segundo
       lead de la misma persona. El índice único de mensaje_id es quien lo
       impide; aquí sólo se le dice que el choque no es un error. */
    const { error } = await admin.from("crm_wa")
      .upsert(filas, { onConflict: "mensaje_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    const deAnuncio = míos.filter((m) => anuncioDe(m.referral)).length;
    await anota("mensaje", true,
      míos.length + " mensaje(s), " + deAnuncio + " de anuncio");
    return responde(200, { ok: true, mensajes: míos.length });
  } catch (e) {
    /* Se anota y se contesta 200 DE TODOS MODOS.

       Suena mal y es lo correcto: si se contesta error, 360dialog reintenta el
       mismo aviso durante horas y tapa la cola con algo que no va a mejorar
       solo. Queda en la bitácora, que es donde se ve. */
    console.log("wa-hook: falló ::", String(e));
    await anota("error", false, String(e && e.message ? e.message : e));
    return responde(200, { ok: false });
  }
});
