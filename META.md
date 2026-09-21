# Meta Ads

Conectar Meta sirve para una cosa: que el **gasto de los anuncios deje de teclearse a mano**.
Con la conexión puesta, el CRM baja todos los días cuánto se gastó, cuántas impresiones y
cuántos clics hubo, **por campaña y por día**, y los enseña al lado de lo que se capturó a
mano.

> **Lo capturado a mano manda siempre.** La cifra de Meta no la pisa nunca. Cuando las dos no
> cuadran por más de un 10%, el CRM lo marca con un **≠** en vez de escoger una. Casi siempre
> es que falta capturar un mes, o que la campaña del CRM está enlazada a menos campañas de Meta
> de las que en realidad corrieron.

**Esto no cuesta.** La API de Meta es gratuita. Lo que cuesta es el trámite de permisos, y el
hotel ya lo tiene andando desde que la conexión estuvo en Odoo.

---

## Lo que hace y lo que no

| | |
|---|---|
| **Lee** | gasto, impresiones, alcance, clics y los leads que Meta contó, por campaña y por día |
| **No escribe nada en Meta** | ni crea campañas, ni las pausa, ni cambia un presupuesto |
| **No trae los leads** | los formularios de Meta todavía no entran solos al CRM: eso es la entrega que sigue |
| **No trae nombres de personas** | de Meta sólo bajan cifras y el nombre de la campaña |

El acceso se pide con permiso **`ads_read`**, que es de sólo lectura, y **no** con
`ads_management`. La diferencia importa: con permiso de escritura, un acceso que se filtre
puede **crear campañas y gastar el dinero del hotel**. Con `ads_read`, lo peor que puede pasar
es que alguien lea cuánto se gastó.

---

## Los cuatro pasos, una sola vez

### 1. Correr `meta.sql` en Supabase

Igual que los demás: **SQL Editor → New query**, se pega el archivo completo (Ctrl+A, Ctrl+C
del archivo; Ctrl+A otra vez en el editor antes de pegar) y **Run**. Debe decir *Success*.

Eso crea las tres tablas donde viven las cifras. Son de **sólo lectura** para todo el mundo: ni
marketing ni el administrador pueden escribirlas desde el navegador, a propósito. La única que
escribe es la función del paso 3, que corre del lado del servidor.

### 2. Sacar el acceso de Meta

Esto se hace en **business.facebook.com**, con la cuenta que administra el Business Manager del
hotel. Si la conexión de Odoo sigue existiendo, buena parte ya está hecha.

1. **Configuración del negocio** (*Business settings*) → **Usuarios** → **Usuarios del
   sistema**.
2. Si ya hay uno de cuando se conectó Odoo, sirve. Si no: **Agregar**, con un nombre que se
   entienda —por ejemplo `CRM CORE`— y rol **Empleado**.
3. Con el usuario del sistema seleccionado: **Agregar activos** → **Cuentas publicitarias** →
   la del hotel → permiso de **ver rendimiento**. Sin este paso el acceso entra pero no ve
   nada, y Meta contesta un error de permisos que el CRM traduce a «revise que traiga
   `ads_read`».
4. **Generar token** (*Generate token*) → se escoge la app de desarrollador del hotel (la misma
   de Odoo sirve) → se palomea **únicamente `ads_read`** → Generar.
5. **Cópielo en ese momento.** Meta no lo vuelve a enseñar. Si se pierde, se genera otro y ya.

También hace falta el **identificador de la cuenta publicitaria**: en el Administrador de
anuncios, arriba, junto al nombre de la cuenta. Se ve así: `act_1234567890`.

> **El acceso no se manda por WhatsApp, ni por correo, ni por este chat, ni se pega en una
> captura de pantalla.** Se copia y se pega directo en Supabase, en el paso siguiente. Quien lo
> tenga puede leer todo lo que el hotel gasta en anuncios.

Los accesos de *usuario del sistema* **no caducan solos**. Dejan de servir si alguien los
revoca, si le cambian la contraseña a la cuenta que los generó o si sacan a esa persona del
Business Manager. Cuando pasa, el CRM lo dice con todas sus letras.

### 3. Guardar el acceso y subir la función

En **supabase.com**, proyecto del hotel:

1. **Edge Functions → Secrets** (o *Settings → Edge Functions*), y se agregan:

   | Nombre | Qué va |
   |---|---|
   | `META_TOKEN` | el acceso que se acaba de generar |
   | `META_CUENTA` | `act_1234567890` |
   | `META_API_VERSION` | *opcional*, sólo si algún día hay que mover la versión |

2. **Edge Functions → Deploy a new function → Via Editor**, con el nombre **exacto**
   `meta-sync`, y se pega completo el archivo `supabase/functions/meta-sync/index.ts`.

Es el mismo procedimiento con el que se subió la función de la IA; si aquélla ya está, ésta se
hace igual.

### 4. Enlazar las campañas en el CRM

En **Campañas** aparece una tira arriba que dice cómo va la conexión. Se aprieta
**Sincronizar** una vez para traer los últimos siete días.

Después, en cada campaña: **Enlace con Meta → Escoger de Meta**, y se palomean las campañas de
Meta que le corresponden. **Una campaña del hotel suele ser dos o tres de Meta** —prospección y
remarketing—: se pueden escoger varias y el gasto se suma.

Los números no se teclean. Se escogen de la lista que manda Meta, porque un dígito de más
amarra la campaña equivocada y nadie lo nota hasta que los números no cuadran.

---

## Cómo saber si sigue viva

La tira de arriba en **Campañas** lo dice sin tecnicismos:

| Lo que dice | Qué significa |
|---|---|
| ● **Al día · hace 3 horas** | todo bien; las cifras son de hace rato |
| ○ **Nunca se ha traído nada** | falta apretar *Sincronizar* la primera vez |
| ▲ **La última vez falló** | abajo sale por qué, en español |

**Si algo falla, las cifras no se ponen en cero: se quedan como estaban.** Es a propósito. Un
cero se lee como «no gastamos»; una cifra de antier se lee como lo que es. El CRM nunca inventa
un número para llenar un hueco.

### Las dos maneras de morir en silencio

1. **El proyecto gratuito de Supabase se pausa** si nadie lo usa por un tiempo. Si eso pasa, la
   sincronización deja de contestar. Se despierta solo en cuanto alguien entra al CRM.
2. **El acceso de Meta se revoca** —cambio de contraseña, o sacaron del Business Manager a
   quien lo generó—. Entonces la tira se pone en ▲ y dice que hay que generar otro.

Las dos se ven en la misma tira. Por eso está ahí y no escondida en un menú.

---

## Cuando Meta contesta un error

El CRM los traduce. Los que se ven de verdad:

| Lo que dice el CRM | Qué hacer |
|---|---|
| «El acceso de Meta caducó» | generar otro (paso 2) y volver a guardarlo en `META_TOKEN` |
| «No tiene permiso de leer los anuncios de esta cuenta» | falta asignarle la cuenta publicitaria al usuario del sistema, o el acceso se generó sin `ads_read` |
| «Meta está limitando las consultas» | no es nada del CRM; se arregla solo en un rato |
| «Meta no encontró la cuenta publicitaria» | revisar `META_CUENTA`; empieza con `act_` |
| «Ya no reconoce la versión de su API» | poner la nueva en `META_API_VERSION` (ver abajo) |
| «La función meta-sync todavía no está subida» | el paso 3 |

---

## Dos decisiones que conviene entender

### Se releen siempre los últimos siete días

No se baja «lo nuevo desde la última vez». **Meta corrige sus cifras días después** —hay
atribución que entra tarde y cargos que se acomodan al rato—, así que bajar sólo lo nuevo
dejaría al hotel para siempre con la primera versión de cada número, que casi nunca es la
buena.

Releer no cuesta nada ni duplica: cada renglón se identifica por campaña y día, así que volver
a bajar el mismo día lo pisa. Sincronizar diez veces seguidas deja la tabla igual que
sincronizar una.

### La versión de la API va fija

El CRM pide la versión **v26.0** (la que Meta publicó el 29 de julio de 2026). Va fija a
propósito: si no se dice cuál, Meta contesta con la más vieja que siga viva, y ésa cambia sola
de un día para otro.

Cada versión vive unos dos años. Cuando salga una nueva **no hay que tocar ningún archivo**: se
agrega el secreto `META_API_VERSION` con el nombre de la nueva —`v27.0`, por ejemplo— y listo.

---

## Lo que sigue

Los **leads de Meta todavía no entran solos**. Hoy el tablero enseña cuántos contó Meta y
cuántos llegaron al CRM, y la diferencia es la que alguien captura a mano. Que entren en el
momento en que alguien llena el formulario de un anuncio es la entrega que sigue, y depende de
un permiso más que Meta puede tardar en autorizar.

---

## Para deshacerlo

Se borran los secretos, se borra la función desde Supabase y, si se quiere, se corre lo que
viene al final de `meta.sql`. El CRM vuelve solo a contar únicamente con el gasto capturado a
mano, y lo dice en la pantalla. **No se pierde un solo dato del hotel**: aquí no vive nada
propio, todo es copia de lo que Meta ya tiene.
