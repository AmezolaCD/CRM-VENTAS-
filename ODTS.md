# ODTs · las órdenes de trabajo de marketing

Hoy los encargos a marketing van en papel: dos hojas —**Solicitud Audiovisual** y **Solicitud
Diseño Gráfico**— que el jefe del área que pide llena a mano, firma, y luego persigue por el
hotel hasta juntar las demás firmas. No hay cómo saber cuántas hay abiertas, quién las está
trabajando, ni dónde quedó el archivo terminado.

Con esto, la misma hoja se llena desde un enlace, se firma con el dedo, y la orden vive en el
CRM hasta que el producto está entregado y se puede ver ahí mismo.

---

## Cómo queda el camino de una orden

| | |
|---|---|
| **1. La pide** | El jefe del área abre el enlace, escoge la hoja, la llena, **adjunta hasta 3 archivos** de referencia y **firma** ahí mismo. |
| **2. Entra sola** | Aparece en la pestaña **ODTS** con su folio —`AV-2026-001` o `DG-2026-001`—, marcada *Falta la firma del director*. |
| **3. La autoriza** | La coordinadora le manda al director un enlace. Él firma desde su teléfono, sin cuenta ni contraseña. La orden pasa a **Abierta**. |
| **4. Se reparte** | La coordinadora se la asigna a Pedro o a Sidney. A ella misma no se la puede asignar, pero las ve todas. |
| **5. Se entrega** | Quien la trabaja sube el producto. Se ve la vista previa en la misma orden. |

**Dos firmas, no cuatro.** El papel trae cuatro recuadros —Solicitante, Jefe Depto, MKT y
Director—, pero usted escogió las dos que de verdad detienen el trabajo: la del jefe que pide
(que firma al llenar) y la del director.

---

## Lo que hay que hacer una vez en Supabase

### 1. Correr `odts.sql`

Menú de la izquierda → **SQL Editor** (el icono de la hoja con `>_`). **New query** → pegar el
archivo completo (Ctrl+A en el archivo, no un pedazo) → **Run**.

Van a salir renglones azules que dicen **NOTICE: … skipping**. Eso está bien: es el archivo
diciendo «esto ya existía». Lo que importa es que termine en **Success**. Se puede repetir.

### 2. Volver a correr `firmas.sql`

**Éste es el que más fácil se salta, y sin él el director no puede firmar.**

El enlace de firma tenía una lista cerrada de qué se puede abrir desde fuera: convenios y
contratos. Ahora también las órdenes de trabajo. La lista sigue cerrada a propósito —una clave
que se filtre no puede servir para leer un cliente ni una campaña—, nada más creció en uno.

Mismo lugar, mismo procedimiento: pegar el archivo completo y **Run**.

### 3. Volver a correr `roles.sql`

Es el que decide quién ve qué. Sin él, **ventas y banquetes recibirían las órdenes de
marketing**, que no es asunto suyo.

Mismo lugar, pegar completo, **Run**.

> Los tres se corren en el orden que sea y se pueden repetir cuantas veces haga falta.

### 4. Subir el tope de archivo en Storage

Sólo hace falta si quiere que los **videos** se suban al CRM. El proyecto tiene un tope global
que viene del plan gratuito en 50 MB, y ningún almacén puede pasarlo:

> **Storage → Settings → Global file size limit** → súbalo a **200 MB**.

Sin eso, el CRM deja escoger el video y Supabase lo rechaza al subirlo.

### 5. Repartir la liga a los jefes de área

En el CRM, en **Ajustes**, sale la liga de las órdenes de trabajo con un botón para copiarla.
Ésa es la que se les manda a los jefes de departamento: recepción, ama de llaves, alimentos y
bebidas, ventas, banquetes, mantenimiento.

Es **una sola liga fija** para todos, como la del lobby. Se pega en un correo, se manda por
WhatsApp, o se deja en el escritorio de quien la use seguido.

---

## Lo que conviene que sepa antes de repartirla

**Cualquiera que tenga la liga puede levantar una orden, y firmarla con el nombre que quiera.**
Es el mismo trato que la liga del lobby: no hay contraseña, porque pedirle una cuenta a cada
jefe de área sería garantizar que nadie la use.

La defensa no es técnica, es de proceso: la coordinadora ve de qué departamento y de quién viene
cada orden antes de moverla, y puede cancelar la que no cuadre. Y nada empieza a trabajarse
hasta que el director firma.

Si algún día se llena de basura, se cambia la clave desde Ajustes y las ligas viejas dejan de
servir de golpe.

---

## El producto terminado

Con la cuenta de Supabase en **Pro**, esto cambió a mejor: en el plan gratuito ningún archivo
podía pasar de 50 MB y un video no cabía; ahora el tope sube a cientos de GB.

**Las imágenes, los PDF y los videos de hasta 200 MB se suben al CRM** y se ven completos ahí
mismo. 200 MB alcanza de sobra para un spot de un minuto en buena calidad.

**Para lo que pese más** —un master de edición, un 4K sin comprimir— sigue estando el botón del
enlace: se pega la dirección de donde vive —Drive, YouTube, Vimeo— y se sube una **imagen de
portada**, que es la que se ve en la lista. Si es de YouTube o de Vimeo, se ve sin salir del CRM.

### Lo que cuesta

El plan Pro incluye **100 GB de almacenamiento** y **250 GB de tráfico** al mes. Para poner eso
en perspectiva: 100 GB son unos 500 videos de 200 MB, y el tráfico sólo se gasta cuando alguien
abre un archivo. Un equipo del tamaño del hotel no se acerca. Pasado el límite se cobra por uso
—centavos por GB guardado, alrededor de dos dólares por cada 20 GB de tráfico extra—, así que no
hay sorpresas de miles de pesos, pero conviene saber que el contador existe.

---

## Cuando algo no cuadra

**«Este enlace todavía no está habilitado»** al abrir el formulario → falta el paso 1.

**El director abre su enlace y dice «este enlace ya no sirve»** → casi siempre falta el paso 2.
También pasa si la orden todavía no ha subido a la nube desde el equipo de la coordinadora: el
CRM lo avisa antes de dejar mandar el enlace.

**A alguien de ventas o de banquetes le aparecen las órdenes** → falta el paso 3.

**Entró la orden pero sin los archivos adjuntos** → pesaban de más. El formulario acepta hasta
**3 archivos de 5 MB cada uno**, y lo dice al escogerlos, antes de que llenen nada.

Ese tope es distinto del de los productos y no cambia con el plan Pro: esos adjuntos viajan
**dentro de la solicitud**, no por el almacén, porque quien llena el formulario no tiene permiso
para escribir en el almacén —y dárselo para ahorrarse el paso sería abrirle una puerta—.

**No deja subir un archivo grande aunque estemos en Pro** → falta subir el tope global en
Storage → Settings (arriba se explica).

---

## Por qué está hecho así

**El que llena el formulario tiene un solo permiso en todo el servidor: dejar su orden.** No
puede leer nada —ni siquiera lo que él mismo acaba de mandar—, ni corregir, ni borrar. Por eso
los archivos adjuntos viajan dentro de la orden y es el CRM quien los guarda en el almacén al
recogerla: darle permiso de escribir en el almacén para ahorrarse ese paso sería abrirle una
puerta que hoy no tiene.

**La clave de las órdenes es propia, no la de la liga del lobby.** Esa va pegada en los anuncios
de Facebook y la ve cualquiera; no tiene por qué servir para levantar órdenes de trabajo. Son
dos públicos distintos y dos claves distintas, y así revocar una no tumba la otra.

**Recoger dos veces no duplica.** Si se corta la luz entre que el CRM crea la orden y que marca
el renglón como atendido, la orden se vuelve a recoger. Cada una recuerda de qué renglón salió,
y los archivos se guardan siempre en la misma ruta: el segundo intento pisa el mismo archivo en
vez de dejar basura.

**Las órdenes no tienen dueño, aunque tengan asignado.** Si el dueño fuera el asignado, el
servidor dejaría que sólo él la reescribiera, y el día que Pedro tocara una de Sidney le
rebotaría la subida entera —el CRM manda todos sus cambios en un solo envío, así que un renglón
rechazado se lleva a los demás—. A quién le toca trabajarla se guarda como un dato, no como un
permiso.

---

## Para deshacerlo

Al final de `odts.sql` están las líneas para tirar la tabla y las funciones. Las órdenes que ya
se recogieron **no se pierden**: viven en el CRM, no en el buzón. Lo que se pierde es la
posibilidad de levantarlas desde fuera, y la liga deja de funcionar —el CRM lo dice en la
pantalla en vez de fallar callado—.

Los archivos son aparte: viven en el almacén `odts` de Supabase y hay que vaciarlo desde
Storage antes de poder borrarlo. Eso **sí** se lleva los productos entregados.
