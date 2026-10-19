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

El número del hotel está **directo en la Cloud API de Meta**, sin proveedor de por medio. Eso es
lo difícil y ya está hecho: la app de Meta existe y el número ya está dado de alta en ella.

**Una advertencia que hay que leer completa:** la app de Meta entrega los mensajes a **una sola
dirección**, y hoy esa dirección **apunta a Odoo**. Al apuntarla al CRM, **Odoo deja de
recibir**. Nadie está trabajando ahí los WhatsApp, así que está bien —pero antes de borrarla,
**cópiala a un lado**, por si alguna vez hay que devolverla.

Si algún día el número se mueve a un proveedor —360dialog, Twilio, el que sea—, la puerta ya
sabe recibirlo: acepta la firma de Meta **y** la cabecera secreta que usan los proveedores, y el
formato del aviso es el mismo. No habría que reescribir nada de esto.

---

## Los seis pasos, una sola vez

### 1. Correr `whatsapp.sql` en Supabase

En Supabase, menú de la izquierda → **SQL Editor** (el icono de la hoja con `>_`). **No** es el
de *Edge Functions*: si sale una pantalla con `import`, es el equivocado.

**New query** → pegar el archivo completo (Ctrl+A en el archivo, no un pedazo) → **Run**.

Van a salir renglones azules que dicen **NOTICE: … skipping**. Eso está bien: es el archivo
diciendo «esto ya existía». Lo que importa es que termine en **Success**. Se puede repetir.

### 2. Los tres secretos

Uno se inventa, uno se copia de Meta y uno se escribe.

**El que inventas** es la palabra con la que Meta da de alta la dirección. Una cadena larga, que
no signifique nada. Por ejemplo:

```
qz-wa-7f3a9c2e5b1d8460a7e2c9f4b6d013a8
```

**Cámbiale algunos caracteres**: ésta ya está escrita aquí, en un archivo público.

**El que copias** es la *clave secreta de la app* de Meta: en
[developers.facebook.com](https://developers.facebook.com) → la app del hotel →
**Configuración → Básica** → *Clave secreta de la app* → **Mostrar**. Con ella la función
comprueba que cada aviso lo firmó Meta de verdad y no alguien que adivinó la dirección.

En Supabase → **Edge Functions** → **Secrets**, se agregan los tres:

| Nombre | Valor |
|---|---|
| `WA_SECRET` | la cadena que acabas de inventar |
| `WA_APP_SECRET` | la clave secreta de la app de Meta |
| `WA_NUMERO` | el número del hotel, sólo dígitos, con lada de país: `526641234567` |

`WA_NUMERO` sirve para que los mensajes que **manda** el hotel no se cuenten como leads: son la
respuesta, no un prospecto.

> Ninguno de los dos secretos se manda por correo, ni por chat, ni se escribe en un archivo del
> repositorio. Viven en los secretos de Supabase y en ningún otro lado. La clave de la app es
> la que firma por Meta; si alguna vez se escribe en algún lugar, se regenera desde ahí mismo
> —y entonces hay que volver a guardarla en Supabase—.

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

Meta no trae una sesión de Supabase, así que con eso prendido el portón rechaza todo antes
de llegar a la función. La función comprueba por su cuenta quién toca —con la firma del paso
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
mensajes, y eso es un POST. Abrir la dirección con el navegador es un GET pelón, y lo único que
recibe es esa palabra. El GET con el que Meta da de alta la dirección es otro —trae el acertijo
y la palabra del paso 2—, y ése sí se comprueba antes de contestar.

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

### 5. Apuntar el webhook en Meta

Es lo único que se hace fuera de Supabase. La dirección es:

```
https://TU-PROYECTO.supabase.co/functions/v1/wa-hook
```

Que esa dirección conteste `ok` en el navegador —la comprobación del paso 3— **antes** de tocar
nada aquí. Si no contesta `ok`, lo que se configure no va a entregar un solo mensaje.

**Antes de escribir nada: copia a un lado la dirección que ya está puesta.** Es la de Odoo. Al
guardar la nueva, Odoo deja de recibir, y si algún día hay que devolvérsela, esa dirección es
la única forma de hacerlo sin adivinar.

En [developers.facebook.com](https://developers.facebook.com) → la app del hotel →
**WhatsApp → Configuración**, en el recuadro de *Webhook*, **Editar**:

| Campo | Qué va |
|---|---|
| URL de devolución de llamada | la dirección de arriba |
| Token de verificación | **la misma cadena del paso 2** (`WA_SECRET`) |

→ **Verificar y guardar**.

En ese momento Meta le pega a la dirección y le pide un acertijo. Si la cadena coincide, la
función se lo devuelve y la pantalla acepta el cambio. Si no coincide, Meta dice que no pudo
verificar la dirección —y entonces es que la cadena no es idéntica a la que quedó en Supabase,
o que el secreto no se guardó—.

**Y falta la mitad que todos olvidan.** Guardar la dirección no hace que lleguen mensajes:
además hay que decirle a Meta **qué** mandar. En el mismo recuadro, **Administrar**, y se
palomea el campo:

| Campo | |
|---|---|
| `messages` | ← **éste**. Es el único que hace falta |

Sin esa palomita la dirección queda verificada y perfecta, y no entra nada nunca. Si más
adelante parece que «todo está bien pero no llega», es casi siempre esto.

Dos cosas más:

- **La clave secreta de la app no se manda por chat ni se escribe en ningún archivo.** Es con
  la que Meta firma. Si alguna vez se regenera, hay que volver a guardarla en Supabase o los
  avisos dejan de pasar.
- La dirección no admite guiones bajos en el dominio ni un puerto escrito. La de Supabase no
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

**No entra nada.** Revisa, en este orden:

1. Que el campo **`messages`** esté palomeado en la app de Meta. Es la causa número uno: la
   dirección queda verificada, todo se ve bien, y Meta no manda nada porque nadie se lo pidió.
2. Que *«Verify JWT with legacy secret»* esté apagado **y no se haya vuelto a prender solo** al
   subir la última versión de la función.
3. Que `WA_APP_SECRET` en Supabase sea la clave secreta de **esa** app de Meta, sin espacios. Si
   la clave se regeneró alguna vez y no se volvió a guardar aquí, los avisos llegan y rebotan.

En Supabase → Edge Functions → **wa-hook → Logs** se ve cuál de los tres es: si no aparece
ninguna llamada, es el 1 o el 2; si aparece y dice *«tocaron sin la llave buena»*, es el 3.

**Entran mensajes que no son leads.** Los acuses de «entregado» y «leído» se tiran solos, y lo
que manda el hotel también, si `WA_NUMERO` está bien puesto. Si aparecen respuestas del propio
hotel como si fueran prospectos, ese secreto está mal.

---

## Por qué está hecho así

**La cerradura no es opcional.** Con *Verify JWT* apagado, esa dirección la puede tocar
cualquiera. Lo único que distingue un aviso de Meta de uno inventado es **la firma**:
`X-Hub-Signature-256`, que es el cuerpo entero pasado por la clave secreta de la app. Por eso la
función lee el cuerpo pero **no lo interpreta** hasta que la firma cuadra —un texto sin parsear
es un montón de bytes; es al volverse un objeto y guardarse cuando puede hacer daño—.

Firmar es mejor que una cabecera secreta, y por una razón concreta: la cabecera sólo dice quién
toca, la firma dice **además que el cuerpo no viene cambiado**. Sin nada de esto, cualquiera que
adivine la dirección puede inventar leads, y un CRM con leads inventados es peor que uno vacío:
se les asigna gente y se reporta que la campaña funcionó.

**El mensaje repetido no duplica.** Meta reintenta cuando no recibe respuesta a tiempo. El buzón tiene un índice único por `mensaje_id`: el reintento choca y se ignora.

**La campaña se resuelve en el servidor, no en el navegador.** El catálogo de Meta sólo lo puede
leer marketing, y las campañas no le bajan a ventas. Si lo resolviera quien sincroniza, bastaría
con que la primera cuenta en sincronizar fuera de ventas para que el lead quedara sin campaña —y
sin remedio, porque el mensaje ya se marcó como atendido—. La función tiene la llave de servicio
y lo ve todo: resuelve una vez, bien, y a cualquiera que recoja le llega ya amarrado.

**Quien escribe tres veces es una persona, no tres.** Si ya hay un lead con ese teléfono sin
pasar a la cartera, el mensaje nuevo se le anexa a las notas.

---

## Para deshacerlo

Quitar la dirección en la app de Meta —o los mensajes seguirán tocando una puerta que ya no
abre nadie—, borrar la función, y al final de `whatsapp.sql` están las líneas para tirar las
tablas.

**Los leads que ya se crearon no se pierden**: viven en la cartera, no en el buzón. Y el botón
**+ Lead de WhatsApp** de la pestaña Leads sigue ahí para capturarlos a mano.
