# Preguntarle a la IA

En el CRM hay un botón redondo abajo a la derecha. Abre un recuadro donde cualquiera del
equipo puede preguntar en español sobre su propia cartera: *qué clientes llevan un mes sin que
nadie los toque*, *qué convenios están a medio firmar*, *escríbeme un correo de seguimiento
para tal cliente*.

Funciona sobre **lo que esa persona ya ve en pantalla**. A un ejecutivo le contesta con su
cartera; a gerencia y a administración, con la de todo el equipo.

Usa **Google Gemini**, que tiene capa gratuita.

---

## Por qué hace falta montar algo

La llave de Google **no puede ir dentro de `index.html`**. Esa página es pública —está en
internet y el repositorio también—, así que cualquiera podría sacarla y gastar con ella a
nombre del hotel.

Por eso la llave se queda en **Supabase**, guardada como secreto, y ahí vive una función
pequeña (`supabase/functions/ia`) que es la única que habla con Google. El CRM le pregunta a
esa función; la función comprueba que quien pregunta traiga una sesión válida del CRM y recién
entonces consulta.

```
CRM (navegador)  ──►  Supabase · función "ia"  ──►  Google Gemini
                       (aquí vive la llave)
```

Mientras la función no esté montada, el botón sigue apareciendo y explica lo que falta en vez
de fallar callado.

---

## Los tres pasos

**Todo se hace con el ratón, desde el navegador. No hace falta terminal.**

### 1. Sacar la llave de Google

Entrar a **<https://aistudio.google.com/apikey>** con una cuenta de Google —la del hotel, no
la personal de alguien que un día se vaya— y darle a **Create API key**. No pide tarjeta.

> Ojo: en esa página también hay una ventana de *Detalles del proyecto*, con el nombre y el
> número del proyecto. **Eso no es la llave** y no sirve aquí. La llave es la cadena larga que
> se copia desde el renglón de la propia llave.

### 2. Guardar la llave en Supabase

En **supabase.com** → el proyecto → **Edge Functions** → sección **Secrets** →
*Add new secret*:

- Name: `GEMINI_API_KEY` (así, en mayúsculas y con guiones bajos)
- Value: la llave

### 3. Subir la función

En esa misma pantalla de **Edge Functions** → **Deploy a new function** → **Via Editor**.

- El nombre tiene que ser exactamente **`ia`**, en minúsculas. El CRM la busca así.
- Borrar el código de ejemplo que trae y pegar completo
  `supabase/functions/ia/index.ts` de este repositorio.
- Desplegar.

### Y probar

Entrar al CRM, recargar con Ctrl+F5, tocar el botón redondo y preguntar cualquier cosa. Abajo
del recuadro debe aparecer **“Contesta Google Gemini.”**

> **Los comandos `npm` y `supabase` no van en el editor SQL de Supabase.** Ésa es otra
> pantalla, y sólo entiende SQL —es donde se corrieron `nube.sql` y `roles.sql`—. Quien
> prefiera la terminal puede usar `supabase secrets set` y `supabase functions deploy ia`,
> pero desde la terminal de su computadora, no desde el navegador.

> **La llave no se pega en el CRM ni se manda por WhatsApp.** Sólo se escribe en ese comando
> `supabase secrets set`. Si alguna vez se filtra, se borra desde
> <https://aistudio.google.com/apikey> y se pone una nueva con el mismo comando.

---

## Sobre la capa gratuita

Google regala cierto uso al día sin cobrar. Los límites los fija Google y cambian; se ven en
la misma página donde se saca la llave. Para cuatro personas preguntando cosas de su cartera,
alcanza de sobra.

Si en algún momento se acaba la cuota del rato, el recuadro lo dice con esas palabras y basta
con esperar unos minutos. No se cae nada más del CRM.

**Para un equipo más grande o mucho uso**, en esa misma consola de Google se puede activar el
plan de paga; no hay que tocar nada aquí, es la misma llave.

---

## Qué se le manda y qué no

Al preguntar, el CRM arma un **resumen en texto** de lo que esa persona ve: clientes con su
estatus y su última actividad, convenios, contratos, la bitácora de los últimos 60 días, los
prospectos y el catálogo de habitaciones con sus tarifas públicas.

**No se manda** ninguna firma, ningún PDF ni ningún archivo escaneado.

Aun así, ese resumen lleva **datos reales de clientes** —nombres, teléfonos, correos y tarifas
negociadas— y sale hacia Google para poder contestar. Eso está dicho en el propio recuadro, y
ahí mismo hay una casilla para **apagarlo**: sin ella, la IA contesta sólo lo que sepa en
general, sin ver nada de la cartera.

> **Esto sí conviene verlo con gerencia antes de repartirlo.** La capa gratuita de Google
> suele usar lo que se le manda para entrenar y mejorar sus modelos; los planes de paga
> normalmente no. Las condiciones exactas están en los términos de Google AI Studio y cambian
> con el tiempo. Si la idea de que los datos de clientes salgan bajo esas condiciones no
> convence, hay dos salidas: dejar la casilla apagada, o pagar el plan.

---

## Detalles para quien mantenga esto

- **El nombre del modelo no va escrito a mano.** Google los renombra cada pocos meses, así que
  la función le pregunta a Google qué modelos tiene y escoge un *flash* —el barato, el de la
  capa gratuita— de la versión más alta y estable que encuentre, saltándose los de
  embeddings, imagen, audio y voz. Para fijar uno:
  `supabase secrets set GEMINI_MODEL=<el que sea>`.
- La respuesta **viaja por pedazos** (un JSON por renglón) para que el texto aparezca conforme
  se escribe y no se quede el recuadro en blanco medio minuto.
- La conversación **no se guarda**: vive mientras el recuadro esté abierto. No ocupa espacio
  ni viaja a los demás equipos.
- La función **rechaza a quien no traiga sesión del CRM**, así que la dirección por sí sola no
  sirve para gastar la llave.
- `supabase/functions/ia/prueba.mjs` prueba la parte delicada —cómo escoge modelo y cómo
  desarma la respuesta de Google— sin llaves ni internet: `node supabase/functions/ia/prueba.mjs`.
