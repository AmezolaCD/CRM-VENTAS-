// ===========================================================================
//  CRM CORE · La función que le pregunta a Meta cuánto se gastó
//
//  El acceso de Meta NO puede vivir en index.html: esa página es pública y
//  cualquiera podría sacarlo. Vive aquí, como secreto del proyecto, y esta
//  función es la única que lo usa. Antes de contestar comprueba que quien
//  pregunta traiga una sesión del CRM Y que le toque ver lo de marketing.
//
//  Cómo se sube, sin terminal: en supabase.com → Edge Functions →
//  "Deploy a new function" → "Via Editor", con el nombre exacto "meta-sync",
//  y se pega este archivo completo. Los accesos se guardan ahí mismo, en
//  Secrets:
//
//      META_TOKEN        el acceso de Meta, con permiso ads_read
//      META_CUENTA       la cuenta publicitaria, act_XXXXXXXXXX
//      META_API_VERSION  opcional; por omisión v26.0
//
//  ESTA FUNCIÓN NUNCA ESCRIBE EN META. Sólo lee. Por eso el acceso se pide
//  con ads_read y no con ads_management: con permiso de escritura, un acceso
//  filtrado puede crear campañas y gastar el dinero del hotel.
//
//  Todo el detalle, en META.md.
// ===========================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* La versión de la API de Meta va fija a propósito: si no se dice cuál, Meta
   contesta con la más vieja que siga viva, y ésa cambia sola de un día para
   otro. v26.0 salió el 29 de julio de 2026 y cada versión vive unos dos años.
   Cuando salga una nueva no hay que tocar este archivo: se pone el secreto
   META_API_VERSION y ya. */
const VERSION_DEF = "v26.0";

/* Cuántos días hacia atrás se vuelven a leer en cada sincronización.
   NO es "desde la última vez": Meta CORRIGE sus cifras días después —hay
   atribución que entra tarde y cargos que se acomodan al rato—, así que leer
   sólo lo nuevo dejaría al hotel con la primera versión de cada número, que
   casi nunca es la buena. Releer es gratis porque la llave de la tabla es
   (nivel, objeto, fecha): volver a bajar el mismo día lo pisa, no lo duplica. */
const DIAS_ATRAS = 7;

/* Los papeles a los que les toca ver lo de los anuncios. Es la misma lista de
   crm_ve_marketing() en meta.sql: aquí se pregunta otra vez porque esta
   función escribe con la llave de servicio, que pasa por encima de las reglas
   de la base de datos. Una sola reja nunca basta. */
const PAPELES = ["admin", "direccion", "marketing", "gte_marketing"];

// ===========================================================================
//  LÓGICA PURA · empieza
//
//  Todo lo que hay entre esta marca y la de abajo no toca la red ni la base
//  de datos: entra un dato, sale otro. prueba.mjs lo saca de este archivo tal
//  cual está escrito y lo corre con respuestas de mentiras, para que lo que se
//  prueba sea exactamente lo que se sube.
//
//  Por eso este pedazo va sin anotaciones de tipo: se corre como JavaScript
//  del común desde la prueba, sin compilar nada. Lo demás sí las lleva.
// ===========================================================================

/**
 * El pedazo de calendario que se vuelve a leer.
 *
 * Las fechas se arman con la parte de texto de la fecha ISO y no con
 * getDate(), porque el servidor de Supabase corre en UTC y el hotel no: a las
 * 6 de la tarde en Tijuana ya es otro día en UTC, y la ventana se recorrería
 * un día sin que nadie lo note.
 */
function ventana(hoyISO, dias) {
  const fin = new Date(hoyISO + "T00:00:00Z");
  const ini = new Date(fin.getTime() - (dias - 1) * 86400000);
  const d = (x) => x.toISOString().slice(0, 10);
  return { desde: d(ini), hasta: d(fin) };
}

/**
 * Cuántos leads trajo un renglón de Meta.
 *
 * Meta no entrega "leads" como un número: entrega una lista de acciones de
 * toda clase —clics, vistas de video, mensajes— y el lead es una de ellas,
 * con tres nombres distintos según de dónde venga. Se suman esos tres y nada
 * más; contar "todas las acciones" daría números enormes que no son leads.
 */
function leadsDe(acciones) {
  const CUENTAN = ["lead", "onsite_conversion.lead_grouped", "leadgen_grouped"];
  let n = 0;
  for (const a of acciones || [])
    if (CUENTAN.includes(String(a.action_type))) n += Number(a.value) || 0;
  return n;
}

/** Un número de Meta, que viene como texto y a veces no viene. */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Un renglón de Meta se vuelve un renglón de la tabla.
 *
 * Se queda fuera todo lo que no sea una cifra: nombres de creativos, textos
 * de anuncios, públicos. Lo único que el hotel necesita de aquí son números.
 */
function filaMetrica(ins, cuenta, moneda) {
  const fecha = String(ins.date_start || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const objeto = String(ins.campaign_id || "").trim();
  if (!objeto) return null;
  return {
    nivel: "campana",
    objeto,
    fecha,
    cuenta: String(cuenta || ""),
    gasto: Math.round(num(ins.spend) * 100) / 100,
    impresiones: Math.round(num(ins.impressions)),
    alcance: Math.round(num(ins.reach)),
    clics: Math.round(num(ins.clicks)),
    leads: Math.round(leadsDe(ins.actions)),
    moneda: String(moneda || ""),
    actualizado: new Date().toISOString(),
  };
}

/**
 * Los nombres que se vieron de pasada, para el catálogo.
 *
 * Se arma con lo que ya trajeron los insights en vez de pedir la lista otra
 * vez: una campaña que gastó algo en la ventana es justo la que interesa
 * poder enlazar desde el CRM.
 */
function objetosDeInsights(filas, cuenta) {
  const m = new Map();
  for (const ins of filas || []) {
    const objeto = String(ins.campaign_id || "").trim();
    if (!objeto || m.has(objeto)) continue;
    m.set(objeto, {
      nivel: "campana",
      objeto,
      nombre: String(ins.campaign_name || "").slice(0, 300),
      padre: "",
      estado: "",
      cuenta: String(cuenta || ""),
      visto: new Date().toISOString(),
    });
  }
  return [...m.values()];
}

/**
 * Lo que se le dice a una persona que no sabe qué es un token.
 *
 * Un "(#190) Error validating access token" no le dice nada a nadie: hay que
 * traducirlo a qué pasó y qué hacer. Los códigos son los de Meta.
 */
function mensajeDeError(estado, cuerpo) {
  const e = (cuerpo && cuerpo.error) || {};
  const codigo = Number(e.code);
  const sub = Number(e.error_subcode);
  const texto = String(e.message || "").slice(0, 300);

  if (codigo === 190 || estado === 401)
    return sub === 463
      ? "El acceso de Meta caducó. Hay que generar uno nuevo y volver a guardarlo " +
        "en los secretos de Supabase, en META_TOKEN. Viene explicado en META.md."
      : "Meta no aceptó el acceso. Puede ser que lo hayan revocado, que le hayan " +
        "cambiado la contraseña a la cuenta o que el acceso no sea de esta cuenta " +
        "publicitaria. Hay que generar uno nuevo y guardarlo en META_TOKEN.";

  if (codigo === 10 || codigo === 200 || estado === 403)
    return "El acceso entró, pero Meta dice que no tiene permiso de leer los " +
      "anuncios de esta cuenta. Revise que traiga el permiso ads_read y que la " +
      "persona que lo generó tenga acceso a la cuenta publicitaria en el " +
      "Business Manager del hotel.";

  if (codigo === 17 || codigo === 4 || codigo === 613 || estado === 429)
    return "Meta está limitando las consultas en este momento. No es nada del " +
      "CRM y se arregla solo: vuelva a intentar en un rato. Las cifras que ya " +
      "estaban no se tocaron.";

  if (codigo === 100 && /version/i.test(texto))
    return "Meta ya no reconoce la versión de su API que trae el CRM. Se arregla " +
      "poniendo la nueva en los secretos de Supabase, en META_API_VERSION " +
      `(hoy trae ${VERSION_DEF}). Viene explicado en META.md.`;

  if (codigo === 803 || /Unsupported get request/i.test(texto))
    return "Meta no encontró la cuenta publicitaria. Revise que META_CUENTA sea " +
      "la del hotel y que empiece con act_ (por ejemplo act_1234567890).";

  return `Meta contestó un error (${estado}${codigo ? " · " + codigo : ""}). ` +
    (texto || "No dijo más.");
}

// ===========================================================================
//  LÓGICA PURA · termina
// ===========================================================================

/** Una llamada a Meta, ya con la versión y el acceso puestos. */
async function aMeta(version: string, ruta: string,
                     params: Record<string, string | number>, token: string) {
  const u = new URL(`https://graph.facebook.com/${version}/${ruta}`);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, String(v));
  u.searchParams.set("access_token", token);
  return pide(u.toString());
}

async function pide(url: string) {
  const r = await fetch(url);
  const t = await r.text();
  let j: any = null;
  try { j = t ? JSON.parse(t) : null; } catch { /* Meta contestó algo que no es JSON */ }
  if (!r.ok || (j && j.error)) {
    const err = new Error(mensajeDeError(r.status, j)) as any;
    err.crudo = t.slice(0, 500);
    throw err;
  }
  return j || {};
}

/**
 * Todos los renglones, siguiendo las páginas.
 *
 * Meta entrega de a poco y deja una liga a la siguiente tanda. Se sigue hasta
 * que se acabe, con un tope: si algún día una cuenta trae tantos días y tantas
 * campañas que no terminara, más vale cortar y decirlo que quedarse colgado.
 */
async function todo(primera: string, tope = 25) {
  const filas: any[] = [];
  let url: string | null = primera;
  let vueltas = 0;
  while (url && vueltas < tope) {
    const j: any = await pide(url);
    for (const f of j.data || []) filas.push(f);
    url = (j.paging && j.paging.next) || null;
    vueltas++;
  }
  return { filas, incompleto: !!url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const responde = (cod: number, cuerpo: unknown) =>
    new Response(JSON.stringify(cuerpo), {
      status: cod,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  const url = Deno.env.get("SUPABASE_URL")!;
  const servicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let correo = "";
  let cuenta = "";
  let desde = "";
  let hasta = "";

  /* La bitácora se escribe pase lo que pase. Es lo único que le dice a una
     persona si la conexión sigue viva, así que un fallo que no quede anotado
     es un fallo que nadie va a ver hasta la junta. */
  const anota = async (ok: boolean, filas: number, detalle: string) => {
    try {
      await createClient(url, servicio).from("crm_meta_sync").insert({
        quien: correo, cuenta, desde: desde || null, hasta: hasta || null,
        filas, ok, detalle: detalle.slice(0, 500),
      });
    } catch { /* si ni la bitácora se puede escribir, no hay más que hacer */ }
  };

  try {
    // ---- 1. ¿Quién pregunta? ---------------------------------------------
    const auth = req.headers.get("Authorization") ?? "";

    /* Estas anotaciones salen en Supabase → Edge Functions → meta-sync → Logs.
       NO se anota el token ni un pedazo de él: sólo si venía y qué tan largo es,
       que es lo que hace falta para saber si el problema es la sesión o el
       camino. Un registro es un lugar público dentro de la casa. */
    console.log(JSON.stringify({
      paso: "entra", metodo: req.method,
      traeAuth: auth.startsWith("Bearer "), largoAuth: auth.length,
      traeApikey: !!req.headers.get("apikey"),
      hayServicio: !!servicio,
      hayToken: !!Deno.env.get("META_TOKEN"),
      hayCuenta: !!Deno.env.get("META_CUENTA"),
    }));

    if (!auth.startsWith("Bearer ")) {
      console.log("meta-sync: llegó sin sesión");
      return responde(401, { error: "Falta la sesión." });
    }

    /* La sesión se comprueba con la llave de SERVICIO, no con la pública.
       Da lo mismo para comprobar —quien contesta quién es el dueño del token es
       el servidor de cuentas de Supabase, no la llave—, pero la de servicio
       siempre está puesta, y la pública cambió de nombre en los proyectos
       nuevos: si falta, esto tronaba con un error que no decía nada. */
    const admin = createClient(url, servicio);
    const { data: { user }, error: errUser } = await admin.auth.getUser(auth.slice(7).trim());
    if (errUser || !user) {
      console.log("meta-sync: la sesión no pasó ::", errUser?.message ?? "sin usuario");
      return responde(401, {
        error: "La sesión no es válida. " + (errUser?.message ?? ""),
      });
    }
    correo = String(user.email || "").toLowerCase();
    console.log("meta-sync: entra", correo);

    // ---- 2. ¿Y le toca? --------------------------------------------------
    //  El papel se busca con la llave de servicio a propósito: si se buscara
    //  con la sesión de quien pregunta, las reglas de la base podrían
    //  esconderle su propio renglón y el CRM leería "no es de nadie".
    const { data: usuarios } = await admin
      .from("crm_datos").select("datos")
      .eq("tipo", "usuarios").eq("borrado", false);
    const mio = (usuarios || []).find(
      (u: any) => String(u.datos?.correo || "").toLowerCase() === correo);
    const papel = String(mio?.datos?.rol || "");
    // Sin lista de usuarios todavía —un proyecto recién montado— se deja
    // pasar a quien tenga sesión, igual que hace el resto del CRM.
    if (usuarios && usuarios.length && !PAPELES.includes(papel)) {
      console.log("meta-sync: papel sin permiso ::", papel || "(ninguno)");
      return responde(403, {
        error: "Esta cuenta no tiene permiso de ver lo de marketing. " +
               "Lo de los anuncios lo alcanzan marketing, dirección y administración.",
      });
    }

    // ---- 3. Los accesos --------------------------------------------------
    const token = Deno.env.get("META_TOKEN");
    cuenta = String(Deno.env.get("META_CUENTA") || "").trim();
    const version = String(Deno.env.get("META_API_VERSION") || VERSION_DEF).trim();

    if (!token)
      return responde(400, {
        error: "Falta el acceso de Meta. Se guarda en Supabase → Edge Functions → " +
               "Secrets, con el nombre META_TOKEN. Viene explicado paso a paso en META.md.",
        falta: "META_TOKEN",
      });
    if (!/^act_\d+$/.test(cuenta))
      return responde(400, {
        error: "Falta la cuenta publicitaria, o está mal escrita. Se guarda en " +
               "Supabase → Edge Functions → Secrets, con el nombre META_CUENTA, y " +
               "se ve así: act_1234567890.",
        falta: "META_CUENTA",
      });

    const peticion: any = await req.json().catch(() => ({}));
    const accion = String(peticion.accion || "sincroniza");
    const dias = peticion.dias;

    // ---- 4a. El catálogo, para poder enlazar campañas --------------------
    if (accion === "catalogo") {
      const { filas } = await todo(
        `https://graph.facebook.com/${version}/${cuenta}/campaigns` +
        `?fields=id,name,status,effective_status&limit=200` +
        `&access_token=${encodeURIComponent(token)}`);
      const lista = filas.map((c: any) => ({
        id: String(c.id), nombre: String(c.name || ""),
        estado: String(c.effective_status || c.status || ""),
      }));

      if (lista.length)
        await admin.from("crm_meta_objetos").upsert(lista.map((c: any) => ({
          nivel: "campana", objeto: c.id, nombre: c.nombre, padre: "",
          estado: c.estado, cuenta, visto: new Date().toISOString(),
        })), { onConflict: "nivel,objeto" });

      return responde(200, { ok: true, cuenta, campanas: lista });
    }

    // ---- 4b. Las cifras --------------------------------------------------
    const v = ventana(new Date().toISOString().slice(0, 10),
                      Math.min(Math.max(Number(dias) || DIAS_ATRAS, 1), 92));
    desde = v.desde; hasta = v.hasta;

    /* La moneda se pregunta aparte porque los insights no la traen, y sin ella
       el CRM no sabría si ese "1500" son pesos o dólares. */
    let moneda = "";
    try {
      const c = await aMeta(version, cuenta, { fields: "currency,name" }, token);
      moneda = String(c.currency || "");
    } catch { /* si no se puede, se sigue sin moneda: el gasto vale igual */ }

    const liga = `https://graph.facebook.com/${version}/${cuenta}/insights` +
      `?level=campaign&time_increment=1` +
      `&time_range=${encodeURIComponent(JSON.stringify({ since: desde, until: hasta }))}` +
      `&fields=${encodeURIComponent(
        "campaign_id,campaign_name,spend,impressions,reach,clicks,actions,date_start,date_stop")}` +
      `&limit=500&access_token=${encodeURIComponent(token)}`;

    const { filas: crudas, incompleto } = await todo(liga);

    const metricas = crudas.map((f: any) => filaMetrica(f, cuenta, moneda)).filter(Boolean);
    const objetos = objetosDeInsights(crudas, cuenta);

    if (metricas.length) {
      const { error } = await admin.from("crm_meta_metricas")
        .upsert(metricas, { onConflict: "nivel,objeto,fecha" });
      if (error) throw new Error("No se pudieron guardar las cifras: " + error.message);
    }
    if (objetos.length)
      await admin.from("crm_meta_objetos").upsert(objetos, { onConflict: "nivel,objeto" });

    await anota(true, metricas.length,
      incompleto ? "Se cortó por demasiadas páginas; acorte el periodo." : "");

    return responde(200, {
      ok: true, cuenta, desde, hasta, moneda,
      filas: metricas.length, campanas: objetos.length, incompleto,
    });
  } catch (e) {
    const msg = (e as Error).message || "error inesperado";
    await anota(false, 0, msg);
    /* 502 y no 500: el que falló fue Meta, no nosotros. Y NO se toca una sola
       cifra de las que ya estaban: un cero se lee como "no gastamos" y una
       casilla vieja se lee como "esto es de antier", que es la verdad. */
    return responde(502, { error: msg });
  }
});
