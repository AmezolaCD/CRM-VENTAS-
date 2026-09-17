# Preguntarle a la IA

En el CRM hay un botón redondo abajo a la derecha. Abre un recuadro donde cualquiera del
equipo puede preguntar en español sobre su propia cartera: *qué clientes llevan un mes sin que
nadie los toque*, *qué convenios están a medio firmar*, *escríbeme un correo de seguimiento
para tal cliente*.

Funciona sobre **lo que esa persona ya ve en pantalla**. A un ejecutivo le contesta con su
cartera; a gerencia y a administración, con la de todo el equipo.

---

## Por qué hace falta montar algo

La llave de Anthropic **no puede ir dentro de `index.html`**. Esa página es pública —está en
internet y el repositorio también—, así que cualquiera podría sacarla y gastar con ella a
nombre del hotel.

Por eso la llave se queda en **Supabase**, guardada como secreto, y ahí vive una función
pequeña (`supabase/functions/ia`) que es la única que habla con Anthropic. El CRM le pregunta
a esa función; la función comprueba que quien pregunta traiga una sesión válida del CRM y
recién entonces consulta.

```
CRM (navegador)  ──►  Supabase · función "ia"  ──►  API de Anthropic
                       (aquí vive la llave)
```

Mientras la función no esté montada, el botón sigue apareciendo y explica lo que falta en vez
de fallar callado.

---

## Cómo se monta (una sola vez, desde la computadora de sistemas)

Se necesita una **llave de la API de Anthropic** —se saca en <https://console.anthropic.com>,
en *API Keys*— y es de pago por uso: se cobra por lo que se pregunte.

```bash
npm install -g supabase          # la herramienta de Supabase
supabase login                   # abre el navegador para autorizar
supabase link --project-ref <el-ref-del-proyecto>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ia
```

El *ref del proyecto* es la parte que va antes de `.supabase.co` en la dirección de la nube
que está en *Ajustes → Nube y equipo*.

Para comprobar que quedó: entrar al CRM, tocar el botón y preguntar cualquier cosa.

> **La llave no se pega en el CRM ni se manda por WhatsApp.** Sólo se escribe en ese comando
> `supabase secrets set`. Si alguna vez se filtra, se revoca desde la consola de Anthropic y
> se pone una nueva con el mismo comando.

---

## Qué se le manda y qué no

Al preguntar, el CRM arma un **resumen en texto** de lo que esa persona ve: clientes con su
estatus y su última actividad, convenios, contratos, la bitácora de los últimos 60 días, los
prospectos y el catálogo de habitaciones con sus tarifas públicas.

**No se manda** ninguna firma, ningún PDF ni ningún archivo escaneado.

Aun así, ese resumen lleva **datos reales de clientes** —nombres, teléfonos, correos y
tarifas negociadas— y sale hacia el servicio de Anthropic para poder contestar. Eso está
dicho en el propio recuadro, y ahí mismo hay una casilla para **apagarlo**: sin ella, la IA
contesta sólo lo que sepa en general, sin ver nada de la cartera.

Conviene que gerencia sepa que esto existe antes de repartirlo al equipo.

---

## Detalles para quien mantenga esto

- El modelo es **`claude-opus-5`**, con razonamiento adaptativo y esfuerzo `medium` —un
  término medio entre calidad y costo para un recuadro de preguntas—. Se cambia en
  `supabase/functions/ia/index.ts`.
- Va con **fallback del lado del servidor** activado: si el modelo declina una petición, la
  vuelve a correr solo en otro modelo en la misma llamada, en vez de quedarse callado.
- La respuesta **viaja por pedazos** (un JSON por renglón) para que el texto aparezca
  conforme se escribe y no se quede el recuadro en blanco medio minuto.
- La conversación **no se guarda**: vive mientras el recuadro esté abierto. No ocupa espacio
  ni viaja a los demás equipos.
- La función **rechaza a quien no traiga sesión del CRM**, así que la dirección por sí sola no
  sirve para gastar la llave.
