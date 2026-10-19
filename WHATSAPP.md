# WhatsApp · que los mensajes de los anuncios entren solos al CRM

Los anuncios del hotel son de **mensajes**: la gente da clic y escribe por WhatsApp. Hasta hoy
eso no dejaba rastro en el CRM —o alguien lo capturaba a mano, o se perdía—, y por eso los
conjuntos de anuncios salen con inversión y con cero leads.

Con esto, cada mensaje entra solo a la pestaña **Leads**. Y cuando viene de un anuncio, entra
**sabiendo de qué conjunto vino**, que es lo que permite saber por fin cuál está dejando dinero.

---

## Lo que hace y lo que no

| | |
|---|---|
| **Recibe** | los mensajes que entran, con el teléfono, el nombre del perfil y lo que escribieron |
| **Amarra** | el anuncio del que vinieron → su conjunto → la campaña del CRM |
| **No contesta** | esto es una puerta de entrada, no una bandeja. Se sigue contestando donde se contesta hoy |
| **No manda nada a WhatsApp** | ni un mensaje, ni una plantilla, ni un acuse |
| **No toca el teléfono** | nadie tiene que cambiar cómo trabaja |

Contestar desde el CRM es otra cosa, y más grande: Meta sólo deja responder libre **durante 24
horas** y fuera de esa ventana exige plantillas que aprueba una por una. Si algún día hace
falta, se arma aparte.

---

## Antes de empezar

El número del hotel ya está en la API con **360dialog**. Eso es lo difícil y ya está hecho.

**Una advertencia que hay que leer completa:** si ese número **ya tiene un webhook puesto** —una
bandeja, un chatbot, cualquier cosa que hoy reciba los mensajes—, apuntarlo al CRM **se la
quita**. WhatsApp manda cada mensaje a un solo lugar. Revísalo en el Hub de 360dialog antes de
tocar nada; si hay algo conectado, hay que decidir qué se hace con eso primero.

Si eso que está conectado **tiene que seguir funcionando**, el Hub tiene una opción de *varios
webhooks por número* —hasta tres además del principal, cada uno con su nombre— y por ahí se
agrega el CRM sin quitarle el suyo a nadie. Cuesta que los mensajes tarden un poco más en
llegar, porque hay que entregarlos a todos. Es la salida, no el camino normal.

---

## Los seis pasos, una sola vez

### 1. Correr `whatsapp.sql` en Supabase

En Supabase, menú de la izquierda → **SQL Editor** (el icono de la hoja con `>_`). **No** es el
de *Edge Functions*: si sale una pantalla con `import`, es el equivocado.

**New query** → pegar el archivo completo (Ctrl+A en el archivo, no un pedazo) → **Run**.

Van a salir renglones azules que dicen **NOTICE: … skipping**. Eso está bien: es el archivo
diciendo «esto ya existía». Lo que importa es que termine en **Success**. Se puede repetir.

### 2. Inventar la llave, y guardarla

Es la cerradura de la puerta. Una cadena larga, que no signifique nada. Por ejemplo:

```
qz-wa-7f3a9c2e5b1d8460a7e2c9f4b6d013a8
```

**Cámbiale algunos caracteres**: ésta ya está escrita aquí, en un archivo público.

En Supabase → **Edge Functions** → **Secrets**, se agrega:

| Nombre | Valor |
|---|---|
| `WA_SECRET` | la cadena que acabas de inventar |
| `WA_NUMERO` | el número del hotel, sólo dígitos, con lada de país: `526641234567` |

`WA_NUMERO` sirve para que los mensajes que **manda** el hotel no se cuenten como leads: son la
respuesta, no un prospecto.

### 3. Subir la función `wa-hook`

**Edge Functions** → **Deploy a new function** → **Via Editor**, con el nombre exacto
`wa-hook`, y se pega el archivo `supabase/functions/wa-hook/index.ts` completo. **Deploy**.

Y en seguida, lo que más se olvida:

> **Edge Functions → `wa-hook` → la configuración de la función → apagar
> «Verify JWT with legacy secret».**

Ese interruptor cambia de nombre y de lugar cada tanto. La sección sale como **Settings**, como
**Function Configuration** o detrás del engrane de arriba a la derecha, y la etiqueta hoy dice
«Verify JWT **with legacy secret**», no «Verify JWT» a secas. **Es el único interruptor de esa
pantalla que menciona JWT**: si la pantalla no se parece a lo de arriba, es ése.

360dialog no trae una sesión de Supabase, así que con eso prendido el portón rechaza todo antes
de llegar a la función. La función comprueba por su cuenta quién toca —con la llave del paso
2—, así que apagarlo no abre nada.

> **Y se vuelve a prender solo.** Las funciones nuevas **y las editadas** salen de Supabase con
> ese interruptor encendido. Cada vez que se suba una versión nueva de `wa-hook`, hay que
> apagarlo otra vez. Esto no avisa de ninguna manera: los mensajes simplemente dejan de entrar,
> sin error que ver. Si los WhatsApp se cortan justo después de que alguien tocó la función, es
> esto, casi seguro.

**Compruébalo antes de seguir**, que son treinta segundos. En esa misma pantalla Supabase enseña
la dirección de la función; pégala en el navegador y dale Enter:

| Lo que contesta | Qué significa |
|---|---|
| la palabra **`ok`** | listo, la puerta está abierta: sigue al paso 4 |
| `Missing authorization header`, o `UNAUTHORIZED_NO_AUTH_HEADER` | el interruptor sigue prendido: vuelve arriba |
| `404`, o «function not found» | no se subió, o el nombre no es exactamente `wa-hook` |

Si ya lo apagaste y sigue saliendo lo mismo, ábrela en una **ventana privada**: el navegador se
guarda la respuesta vieja. No hay que volver a subir nada, el interruptor pega de inmediato.

Que conteste `ok` sin pedir nada **no es un hueco**: la cerradura se exige para *mandar*
mensajes, y eso es un POST. Abrir la dirección con el navegador es un GET, y a eso 360dialog
también le pega antes de empezar, así que tiene que contestar `ok`.

### 4. Volver a subir `meta-sync`

Esta parte es fácil de saltarse y es la que decide si el lead entra con campaña o sin ella.

El mensaje trae el id **del anuncio**, no el del conjunto. Para subir de uno al otro, el CRM
necesita la lista de anuncios, y hasta hoy `meta-sync` no la bajaba. Ya la baja —**sólo los
nombres, sin cifras**, para no contar el mismo gasto dos veces—, pero hay que volver a subir la
función.

**Edge Functions → meta-sync → Edit**, se borra todo, se pega
`supabase/functions/meta-sync/index.ts` completo y **Deploy**. Después, en *Campañas*, el botón
**Sincronizar**.

No hay que volver a correr `meta.sql`: la tabla ya tiene dónde guardarlos.

### 5. Apuntar el webhook en 360dialog

Es lo único que se hace fuera de Supabase. La dirección es:

```
https://TU-PROYECTO.supabase.co/functions/v1/wa-hook
```

Que esa dirección conteste `ok` en el navegador —la comprobación del paso 3— **antes** de tocar
el Hub. Si no contesta `ok`, lo que se configure aquí no va a entregar nada.

En el **Hub de 360dialog**: se entra al número del hotel y se busca la sección **API Settings**
—en Hubs más viejos, *WhatsApp Channel → Channel Webhook*—. Ahí hay **dos** webhooks y hay que
escoger bien:

- **Channel webhook** ← **éste**. Es el de ese número.
- *WABA webhook*: manda los eventos de **todos** los números de la cuenta a una sola dirección.
  El día que el hotel tenga un segundo número, ése se los revuelve.

Se pone la dirección de arriba y **una cabecera propia**:

| Cabecera | Valor |
|---|---|
| `x-crm-llave` | la misma cadena del paso 2 |

Tiene que ser **idéntica**, sin un espacio pegado al final. Es el error más común, y la función
no lo dice: contesta `No.` a secas, a propósito, para no ayudarle a quien esté probando la
puerta.

Es probable que al guardar pida un **código de verificación que llega por correo** a la cuenta
del Hub. Ten el correo abierto antes de darle guardar.

Si su Hub no deja poner cabeceras desde la pantalla, se hace con una llamada. El comando es
éste, y **los dos huecos los llenas tú**:

```bash
curl -X POST "https://waba.360dialog.io/v1/configs/webhook" \
  -H "D360-API-KEY: TU_LLAVE_DE_360DIALOG" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://TU-PROYECTO.supabase.co/functions/v1/wa-hook",
       "headers":{"x-crm-llave":"LA_CADENA_DEL_PASO_2"}}'
```

Tres avisos sobre eso:

- **La llave de 360dialog no se manda por chat ni se escribe en ningún archivo.** Es la que abre
  el WhatsApp del hotel. Si alguna vez se escribió en algún lado, se regenera desde el Hub.
- **Regenerar esa llave borra el webhook.** No avisa: los mensajes dejan de llegar y ya. Si
  alguna vez se regenera, hay que volver a hacer este paso 5 completo.
- El dominio puede ser `waba-v2.360dialog.io` si el número está en su plataforma nueva. El Hub
  dice cuál es; si el comando contesta un error de dirección, es ése.

La dirección tampoco admite guiones bajos en el dominio ni un puerto escrito. La de Supabase no
los trae, así que se pega tal cual se copia, sin agregarle nada al final.

### 6. Prender la atribución

En los ajustes de **WhatsApp Business**, la opción de **Atribución**.

Sin ella el mensaje llega igual, pero **sin el id del anuncio** — y entonces el lead cae sin
campaña, que es justo lo que se quería resolver.

---

## Cómo saber si quedó

Abre la pestaña **Leads**. Arriba sale una tira:

- **«WhatsApp · el último mensaje entró hace un momento»** con una línea verde — está vivo.
- **«WhatsApp todavía no está conectado»** — falta el paso 1 o el 3.
- Nada — todavía no ha entrado ningún mensaje. Mándate uno desde otro teléfono y recarga.

La prueba de verdad: **da clic a tu propio anuncio desde otro teléfono** y escribe. En un minuto
debe aparecer en Leads, con la columna *De qué campaña* llena.

---

## Cuando algo no cuadra

**Entra el lead pero sin campaña.** Cuatro motivos, en orden de probabilidad:

1. Falta prender **Atribución** (paso 6).
2. Falta volver a subir `meta-sync` (paso 4). Sin la lista de anuncios no hay cómo subir del
   anuncio a su conjunto, y **todos** los leads salen sin campaña. Si es ése, se nota porque es
   todos, no uno.
3. El anuncio es nuevo y todavía no está en el catálogo. Aprieta **Sincronizar** en *Campañas* y
   los que entren después ya salen amarrados.
4. Ese conjunto no está enlazado a ninguna campaña del CRM. Se ve en *Campañas*.

El CRM **nunca adivina**: si no puede resolverlo, deja el lead sin campaña. Un lead colgado de la
campaña equivocada ensucia el costo por lead de las dos, y eso no se nota hasta que alguien toma
una decisión con el número malo.

**No entra nada.** Revisa, en este orden: que *«Verify JWT with legacy secret»* esté apagado
—y que **no se haya vuelto a prender solo** al subir la última versión de la función, que es lo
que pasa—; que la cabecera
`x-crm-llave` del webhook sea **idéntica** a `WA_SECRET` —un espacio de más cuenta—; y en
Supabase → Edge Functions → **wa-hook → Logs**, si dice *«tocaron sin la llave buena»* es la
cabecera.

**Entran mensajes que no son leads.** Los acuses de «entregado» y «leído» se tiran solos, y lo
que manda el hotel también, si `WA_NUMERO` está bien puesto. Si aparecen respuestas del propio
hotel como si fueran prospectos, ese secreto está mal.

---

## Por qué está hecho así

**La cerradura no es opcional.** Con *Verify JWT* apagado, esa dirección la puede tocar
cualquiera, y las cuentas de **cliente** de 360dialog no firman sus webhooks —la firma
`x-360dialog-signature` es de las cuentas de socio—. Por eso la función **no mira el cuerpo**
hasta comprobar la cabecera. Sin eso, cualquiera que adivine la dirección puede inventar leads, y
un CRM con leads inventados es peor que uno vacío: se les asigna gente y se reporta que la
campaña funcionó.

**El mensaje repetido no duplica.** Meta y 360dialog reintentan cuando no reciben respuesta a
tiempo. El buzón tiene un índice único por `mensaje_id`: el reintento choca y se ignora.

**La campaña se resuelve en el servidor, no en el navegador.** El catálogo de Meta sólo lo puede
leer marketing, y las campañas no le bajan a ventas. Si lo resolviera quien sincroniza, bastaría
con que la primera cuenta en sincronizar fuera de ventas para que el lead quedara sin campaña —y
sin remedio, porque el mensaje ya se marcó como atendido—. La función tiene la llave de servicio
y lo ve todo: resuelve una vez, bien, y a cualquiera que recoja le llega ya amarrado.

**Quien escribe tres veces es una persona, no tres.** Si ya hay un lead con ese teléfono sin
pasar a la cartera, el mensaje nuevo se le anexa a las notas.

---

## Para deshacerlo

Quitar el webhook en el Hub de 360dialog —o los mensajes seguirán tocando una puerta que ya no
abre nadie—, borrar la función, y al final de `whatsapp.sql` están las líneas para tirar las
tablas.

**Los leads que ya se crearon no se pierden**: viven en la cartera, no en el buzón. Y el botón
**+ Lead de WhatsApp** de la pestaña Leads sigue ahí para capturarlos a mano.
