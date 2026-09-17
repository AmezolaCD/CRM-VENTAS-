# Preguntarle a la IA

En el CRM hay un botón redondo abajo a la derecha. Abre un recuadro donde cualquiera del
equipo puede preguntar en español sobre su propia cartera: *qué clientes llevan un mes sin que
nadie los toque*, *qué convenios están a medio firmar*, *escríbeme un correo de seguimiento
para tal cliente*.

Funciona sobre **lo que esa persona ya ve en pantalla**. A un ejecutivo le contesta con su
cartera; a gerencia y a administración, con la de todo el equipo.

---

## Qué motor usar

Sirve con dos, y **se escoge solo según la llave que se le ponga**:

| | **Google Gemini** | **Claude** |
|---|---|---|
| Costo | **Tiene capa gratuita** | Siempre de paga, por uso |
| Dónde se saca la llave | <https://aistudio.google.com/apikey> | <https://console.anthropic.com> → *API Keys* |
| Para empezar | ✅ Recomendado | Cuando la capa gratuita quede corta |

**Empiece con Gemini.** Google regala cierto uso al día sin tarjeta; los límites exactos los
fija Google y se ven en la misma consola donde se saca la llave. Para un equipo de cuatro
personas preguntando cosas de su cartera, alcanza de sobra.

Si algún día hace falta cambiar, es **cambiar una llave** — no hay que tocar el CRM ni volver
a programar nada.

### Cuánto costaría con Claude, para tener el número

Cada pregunta manda el resumen de la cartera y recibe una respuesta: son unos **3 mil**
"pedazos de texto" de ida y unos **500** de vuelta. A los precios de hoy:

- Con el modelo grande (`claude-opus-5`): unos **3 centavos de dólar por pregunta**. Cien
  preguntas al día salen alrededor de **90 dólares al mes**.
- Con el modelo chico (`claude-haiku-4-5`): menos de **un centavo por pregunta**, o sea del
  orden de **15 dólares al mes** con ese mismo uso.

Para cambiar al modelo chico basta con: `supabase secrets set CLAUDE_MODEL=claude-haiku-4-5`.

---

## Por qué hace falta montar algo

La llave **no puede ir dentro de `index.html`**. Esa página es pública —está en internet y el
repositorio también—, así que cualquiera podría sacarla y gastar con ella a nombre del hotel.

Por eso la llave se queda en **Supabase**, guardada como secreto, y ahí vive una función
pequeña (`supabase/functions/ia`) que es la única que habla con el motor. El CRM le pregunta a
esa función; la función comprueba que quien pregunta traiga una sesión válida del CRM y recién
entonces consulta.

```
CRM (navegador)  ──►  Supabase · función "ia"  ──►  Gemini o Claude
                       (aquí vive la llave)
```

Mientras la función no esté montada, el botón sigue apareciendo y explica lo que falta en vez
de fallar callado.

---

## Cómo se monta (una sola vez, desde la computadora de sistemas)

```bash
npm install -g supabase          # la herramienta de Supabase
supabase login                   # abre el navegador para autorizar
supabase link --project-ref <el-ref-del-proyecto>

supabase secrets set GEMINI_API_KEY=...          # la de Google AI Studio
supabase functions deploy ia
```

El *ref del proyecto* es la parte que va antes de `.supabase.co` en la dirección de la nube
que está en *Ajustes → Nube y equipo*.

Para comprobar que quedó: entrar al CRM, tocar el botón y preguntar cualquier cosa. Abajo del
recuadro aparece **quién contestó**.

### Para usar Claude en su lugar

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ia
```

Si están puestas las dos llaves gana Gemini, por ser el que no cobra. Para forzar una:
`supabase secrets set MOTOR_IA=claude` (o `gemini`).

> **La llave no se pega en el CRM ni se manda por WhatsApp.** Sólo se escribe en ese comando
> `supabase secrets set`. Si alguna vez se filtra, se revoca desde la consola de Google o de
> Anthropic y se pone una nueva con el mismo comando.

---

## Qué se le manda y qué no

Al preguntar, el CRM arma un **resumen en texto** de lo que esa persona ve: clientes con su
estatus y su última actividad, convenios, contratos, la bitácora de los últimos 60 días, los
prospectos y el catálogo de habitaciones con sus tarifas públicas.

**No se manda** ninguna firma, ningún PDF ni ningún archivo escaneado.

Aun así, ese resumen lleva **datos reales de clientes** —nombres, teléfonos, correos y tarifas
negociadas— y sale hacia el servicio del motor que se haya elegido para poder contestar. Eso
está dicho en el propio recuadro, y ahí mismo hay una casilla para **apagarlo**: sin ella, la
IA contesta sólo lo que sepa en general, sin ver nada de la cartera.

Vale la pena saber que **la capa gratuita de Google suele usar lo que se le manda para mejorar
sus modelos**, mientras que las llaves de paga normalmente no. Si eso pesa, conviene revisar
las condiciones de Google antes de repartirlo, o usar la casilla apagada. En cualquier caso,
que gerencia sepa que esto existe antes de darlo al equipo.

---

## Detalles para quien mantenga esto

- **El modelo de Gemini no está escrito a mano.** Google los renombra cada pocos meses, así
  que la función le pregunta a Google qué modelos tiene y escoge un *flash* —el barato, el de
  la capa gratuita— de la versión más alta que encuentre. Para fijar uno:
  `supabase secrets set GEMINI_MODEL=<el que sea>`.
- Con Claude, el modelo por omisión es `claude-opus-5`, con razonamiento adaptativo y esfuerzo
  `medium`, y **fallback del lado del servidor**: si el modelo declina una petición, la vuelve
  a correr solo en otro en la misma llamada. Se cambia con `CLAUDE_MODEL`.
- La respuesta **viaja por pedazos** (un JSON por renglón) para que el texto aparezca conforme
  se escribe y no se quede el recuadro en blanco medio minuto.
- La conversación **no se guarda**: vive mientras el recuadro esté abierto. No ocupa espacio
  ni viaja a los demás equipos.
- La función **rechaza a quien no traiga sesión del CRM**, así que la dirección por sí sola no
  sirve para gastar la llave.
