# CORE · CRM de Ventas

CRM para el equipo de ventas del hotel: cartera de clientes, bitácora de actividad y
generación de cartas-convenio con firma digital. Es **un solo archivo HTML**: no hay que
instalar nada ni levantar un servidor — se abre con doble clic en cualquier navegador.

## Identidad

Morado `#39104e`, oro `#b2aa6d` y blanco. El logotipo —hexágono con seis flechas que
convergen en el núcleo— va **dibujado como SVG en línea**, no como imagen incrustada: se ve
nítido a cualquier tamaño, cambia de tono con el tema y pesa unos cientos de bytes. El
favicon usa la misma geometría sin las puntas de flecha, que a 16 px no se resuelven.

Los tres estados que cargan significado se derivan de esa paleta para no perder la lectura:
**Ganado** en oro, **pendiente** en bronce y **perdido/error** en un rojo apagado. El embudo
es una rampa de morado que se cierra hacia la venta. Los chips de estatus van sólidos con su
propia tinta, para que se lean igual en tema claro y oscuro.

El verde de WhatsApp se respeta: es marca de un tercero y funciona como señal. Sus botones
llevan el glifo de WhatsApp en vez de la palabra —identifica el destino mejor y ocupa la
mitad— con `title` y `aria-label` para que sigan teniendo nombre accesible.

La carta-convenio toma los colores (membrete con regla dorada, encabezados de tabla en
morado, viñetas con filete de oro) pero **no lleva el logotipo de CORE**: es un documento
del hotel, no del CRM.

## Animación de entrada

Al abrir el CRM se muestra durante **dos segundos** una animación del logotipo: el hexágono se
traza, las seis flechas convergen en el núcleo, aparece la palabra CORE y al final **el propio
logo vuela hasta el botón de inicio del encabezado**, que es el mismo logo, tiñéndose de sus
colores en el camino. El del encabezado se esconde mientras tanto, así que el relevo entre uno
y otro no se nota: la entrada termina siendo una transición y no una interrupción.

Está hecha con **CSS y SVG**, no con video: pesa unos cientos de bytes en vez de varios
megabytes, se ve nítida en cualquier pantalla y no reproduce sonido.

Tres detalles pensados para que nunca estorbe:

- Va con `pointer-events:none`, así que **no bloquea nada** aunque coincida con un clic.
- **Cualquier clic o tecla la salta**, y se retira sola del DOM al terminar.
- Con **"reducir movimiento"** activado en el sistema, ni se muestra.

## Cómo usarlo

1. Descarga o clona este repositorio.
2. Abre `index.html` en Chrome, Edge, Firefox o Safari.

Los datos se guardan en el **almacenamiento local del navegador** (`localStorage`), en el
equipo donde lo abres. Trae clientes de ejemplo para que se entienda el funcionamiento;
para empezar limpio usa *Exportar → Borrar todos los datos*, o marca **"Reemplazar la
cartera actual"** al importar tu archivo.

En operación, el CRM vive en **<https://corequartz.netlify.app>** y los datos en Supabase.
Para montarlo desde cero —o para entender cómo está armado— sigue **[NUBE.md](NUBE.md)**: son unos 20 minutos, una sola vez, y no cuesta nada para
este tamaño de equipo.

## Estructura

Son tres cosas encadenadas: **un cliente** tiene **muchas actividades** y **muchos convenios**.

### Clientes

Cada cliente guarda empresa, contacto, teléfono, correo, ubicación, tarifa, ejecutivo de
venta, estatus y notas. Se ven de dos formas:

- **Tablero** — kanban por estatus, con arrastrar y soltar entre columnas. En celular los
  botones `‹ ›` de cada tarjeta hacen lo mismo. El logotipo CORE del encabezado funciona
  como botón de inicio: desde cualquier pestaña regresa aquí.
- **Clientes** — tabla con todos los campos a la vista.

El embudo tiene seis estatus: Contactado → Propuesta → Negociación → **Cotización enviada**
→ Ganado / Perdido. Los dos últimos pasos los mueve el convenio solo (ver abajo).

Hay un **acceso directo a WhatsApp** en la tarjeta, en la tabla y en la ficha, que abre el
chat con el número registrado y un saludo ya redactado. A los números de 10 dígitos les
antepone la lada del país (configurable, México por omisión).

### Actividades

Dentro de cada cliente, la pestaña **Actividad** lleva la bitácora. **No hay límite de
registros por cliente.** Cada uno lleva:

- **Tipo**: Llamada 📞, Reunión 🤝, Correo ✉️ o WhatsApp 💬
- **Asunto**
- **Fecha y hora**
- **Responsable** (ejecutivo de venta)
- **Notas**

La tarjeta del tablero muestra el conteo y la última actividad. Los hitos del convenio se
registran solos en esta bitácora.

### Convenios

Un convenio se arma eligiendo el cliente y marcando las habitaciones que entran:

- Cada habitación tiene una **casilla**. Sin marcar, su tarifa ni se puede capturar; al
  marcarla se habilita y toma el foco. Si la desmarcas, se limpia.
- La **tarifa pública** (rack) sale del catálogo y **se muestra pero no se puede editar**.
  Admite **N/A** para las habitaciones sin tarifa pública, como el Recovery *Care*.
- La **tarifa convenio** se captura a mano. Al lado se calcula el descuento contra la pública.
- Un interruptor decide si el convenio **incluye también las habitaciones Recovery**, con su
  propia tarifa pública fija y su tarifa convenio capturable.
- Hay un campo de **observaciones internas** que no se imprime en la carta.

**No se puede guardar ni firmar** hasta que se cumplan las tres reglas. Lo que falte se
enumera arriba del formulario y las filas incompletas se marcan en rojo:

1. Al menos **una habitación marcada**.
2. **Toda habitación marcada lleva su tarifa convenio** (cero no cuenta).
3. Si el **bloque Recovery está activo**, al menos una habitación de ese bloque marcada y
   con tarifa — o se desactiva el bloque.

#### Flujo de firma

1. **Borrador** — se puede editar libremente.
2. **Firma el ejecutivo** (nombre, puesto, celular y firma trazada con el ratón o el dedo).
   → El convenio queda bloqueado y **el cliente pasa automáticamente a "Cotización enviada"**.
3. **Se envía al cliente** — el botón genera el PDF de la carta y lo manda junto con el
   mensaje ya redactado, por correo o WhatsApp.
4. **Firma el cliente** → **el cliente pasa automáticamente a "Ganado"** y su tarifa se
   actualiza con la habitación más económica del convenio.

Cada paso deja constancia en la bitácora del cliente.

> **Límite que conviene tener claro:** la aplicación **no recibe la firma del cliente a
> distancia**. Cuando el cliente devuelva la carta firmada, capturas su firma con *Registrar
> firma del cliente*. Si necesitan firma remota real —el cliente abre un enlace y firma desde
> su dispositivo— eso requiere backend.

#### La carta

El documento reproduce el machote del hotel: encabezado con nombre, dirección y teléfono;
línea de fecha con ciudad; domicilio del destinatario; párrafo de presentación; tablas de
tarifas por bloque (Deluxe y Recovery) con lo que incluye cada habitación; el bloque Surgery
Recovery a dos columnas; ESPECIFICACIONES DE TARIFAS; VALORES AGREGADOS y NUESTROS SERVICIOS;
CONDICIONES; RESERVACIONES; POLÍTICAS de garantía, pago y cancelación; y los dos bloques de
firma (**De conformidad Hotel** y **De conformidad Empresa**) con Nombre, Puesto, Fecha y Celular.

Lleva **membrete y marca de agua**: el logotipo (o el monograma Q, redibujado en SVG) arriba,
y la marca al fondo de la primera hoja. La marca de agua va como elemento, no como fondo CSS,
para que también salga al imprimir.

El logotipo **no se congela** en los convenios firmados, a diferencia de las tarifas y los
textos: es identidad del hotel, no una condición pactada, así que si cambia, las cartas
viejas se reimprimen con el logotipo vigente.

*Imprimir* saca la carta sola, sin la interfaz, en **tamaño carta** (216 × 279 mm) con
márgenes de 16 × 18 mm. El tamaño se fija con una regla `@page`: sin ella lo decidía la
impresora de cada quien y el mismo documento podía salir en A4. Para cambiarlo, es una
palabra en el CSS (`size: letter` → `size: A4`).

*Descargar PDF* arma el archivo aquí mismo, sin pasar por el diálogo de impresión, y es el
mismo que sale adjunto al enviarlo. La carta-convenio ocupa tres hojas y el navegador sólo
sabe partirla al imprimir —no al dibujarla—, así que la paginación se hace a mano: se mide
dónde termina cada bloque, se elige en cuál cortar sin partirlo a la mitad (y sin dejar un
título solo al pie de una hoja), se dibuja el documento entero de una vez y esa tira se
reparte en hojas. Los dos bloques de firma quedan juntos en la última. Cada confirmación de
hospedaje cabe en una hoja y no necesita nada de esto.

### El encabezado y el pie del navegador

Chrome imprime por su cuenta la URL del archivo, la fecha y el número de página. No es parte
del documento: aparece siempre que la hoja tenga margen.

En las **confirmaciones** ya no sale: la hoja se manda con margen cero y los márgenes los
pone el contenido, así que el navegador no encuentra sitio donde escribirlos.

En el **convenio** no se puede hacer lo mismo, porque fluye en varias páginas y la segunda
arrancaría pegada al borde del papel. Ahí se apaga desde el diálogo de impresión:
*Más ajustes → Encabezados y pies de página*. Chrome recuerda la casilla.

### Ajustes

- **Datos del hotel**: nombre, dirección, teléfono, ciudad (para la línea de fecha), teléfono
  y correo de reservaciones, moneda y lada del país.
- **Logotipo del membrete**: se sube una imagen (PNG, JPG o SVG, máximo 400 KB) y encabeza la
  carta. Sin logotipo, se dibuja una **reconstrucción en SVG** del logotipo QUARTZ; se le
  parece mucho, pero su subtítulo "HOTEL & SPA" se compone con la tipografía instalada en cada
  computadora, así que puede variar. **Para fidelidad exacta, sube el archivo oficial.**
  Si el hotel se llama de otra forma, la carta usa el monograma Q más el nombre en texto.
- **Marca de agua**: monograma Q, el mismo logotipo, o ninguna. Se imprime al fondo de la
  primera hoja, como papel membretado.
- **Catálogo de habitaciones**: clave, tipo, bloque (Deluxe o Recovery) y tarifa pública
  —vacía = N/A—. **Es el único lugar donde se edita la tarifa pública.**
- **Bloques de la carta**: el nombre que encabeza cada tabla y el texto de lo que incluye ese
  bloque, que se imprime **una sola vez** debajo de la tabla, como en el machote.
- **Textos de la carta**: todos editables, con marcadores `{{HOTEL}}`, `{{EMPRESA}}`,
  `{{CONTACTO}}`, `{{VIGENCIA}}` y `{{ANIO}}` que se sustituyen al generar cada carta.

Un convenio guarda **su propia copia** de los textos y de las tarifas al crearse, así que
cambiar el catálogo o los textos **no altera los convenios ya emitidos**.

### Confirmaciones de hospedaje

Pestaña **Confirmaciones**. Genera la carta que acredita la reservación de un huésped ante
terceros (visas, empresas, aseguradoras).

- **Importa un `.xlsx`** —el archivo tal cual, sin convertir— o un CSV. El lector de Excel
  está escrito a mano sobre `DecompressionStream`, que traen los navegadores modernos: un
  `.xlsx` es un ZIP con XML dentro, así que **no hace falta ninguna librería externa** y el
  archivo sigue siendo uno solo. Si el navegador no lo soporta, avisa y pide un CSV.
- **Una fila = un huésped = una carta.** Dos huéspedes que comparten el mismo número de
  reservación siguen siendo dos registros con dos cartas.
- **Nombre y apellidos vienen en columnas separadas** y la carta los une. Si el archivo trae
  una sola columna con el nombre completo, también funciona.
- **No se pide número de habitación**: no se asigna hasta la llegada del huésped.
- Las **fechas en formato de Excel** (números de serie) se convierten solas, igual que
  `04/09/2026` o `2026-09-04`.
- Si dejas **Noches** en blanco, se calcula con las fechas.
- Las filas sin nombre de huésped se omiten y se reporta cuántas fueron.
- El mapeo de columnas se adivina con los mismos alias que el importador de clientes y se
  puede corregir. Hay un botón para **descargar la plantilla** con las columnas esperadas:
  Numero de reservación · Fecha de llegada · Fecha de salida · Numero de noches · Nombre ·
  Apellidos · Teléfono · Correo electrónico.
- **Imprimir todas** saca las cartas en lote, una hoja por huésped.
- Cada carta tiene botón de **correo** y de **WhatsApp**, con el mensaje ya redactado y
  **el PDF adjunto** donde el equipo lo permite (ver abajo).
- **Descargar PDF** genera el archivo directamente, una hoja por huésped, sin pasar por el
  diálogo de impresión.

#### Qué carta ya salió

Cada renglón trae una columna **Envío**: *Sin enviar*, o un sello verde con **por dónde salió
y cuándo** (`✓ correo · 08 sep 2026`). Al pasar el cursor dice la hora exacta y desde qué
cuenta se mandó. Arriba va la cuenta —*2 de 4 enviadas*— y un botón **Sólo pendientes**, que
es lo que se usa cuando llegan cuarenta huéspedes de golpe: filtra la lista y *Imprimir todas*
pasa a imprimir nada más las que faltan.

Con las casillas de la izquierda se marcan **varias de un jalón**: útil al estrenar el
indicador, cuando todo lo mandado antes aparece como pendiente y corregirlo uno por uno es
media tarde. Pregunta **qué día se enviaron** en vez de poner la de hoy: el envío fue otro
día y una constancia con fecha falsa no sirve de nada.

La marca se pone sola al mandar la carta desde la aplicación. **Descargar el PDF no cuenta
como enviar**, a propósito: bajar el archivo para revisarlo no es lo mismo que mandárselo al
huésped.

Conviene tener claro qué significa el sello. La aplicación abre tu correo o WhatsApp, pero
**no alcanza a ver si de verdad le diste enviar** — nada en el navegador se lo permite. Así
que el sello dice *"de aquí salió la carta"*, no *"el huésped ya la tiene"*. Por eso se puede
corregir a mano: abre la ficha del huésped y ahí está el botón para marcarla o desmarcarla.
Con la nube conectada, la marca la ven todos, así que dos ejecutivos no le mandan la misma
carta al mismo huésped.

#### Cómo se adjunta el PDF

Ni `mailto:` ni el enlace de WhatsApp admiten adjuntos: esos protocolos sólo transportan
texto, y ninguna página web puede saltárselo. Para poder mandar el archivo hay que tener un
PDF de verdad hecho en el navegador, así que el CRM lo genera solo: rasteriza la hoja tal como
se ve —vía un `foreignObject` de SVG, sin librerías— y envuelve esa imagen en un PDF mínimo
escrito a mano. Es fiel al documento impreso porque es el mismo render; a cambio, su texto no
es seleccionable.

Con el archivo en mano hay dos caminos, y el botón de envío elige el que corresponda:

- **Equipos que saben compartir archivos** (celulares y Windows reciente): un solo toque abre
  la hoja de compartir del sistema con **el PDF y el mensaje juntos**; se elige WhatsApp o el
  correo ahí mismo.
- **Los demás**: se descarga el PDF con un nombre que identifica al huésped
  (`Confirmacion-R-1201-Ana-Lopez-Ramirez.pdf`) y se abre la app con el mensaje listo, para
  adjuntarlo a mano.

**La carta-convenio usa exactamente la misma ruta**, con la paginación descrita arriba: el
archivo sale como `Convenio-CV-2026-001-SAMAHA-CLINIK.pdf` y el envío queda anotado en la
bitácora del cliente.

También se puede capturar un huésped a mano.

## Importar clientes

Botón **Importar**. Acepta un `.csv` / `.tsv` o texto pegado. Si tus datos están en Excel o
Google Sheets, guárdalos como CSV (*Archivo → Descargar → CSV*).

- Detecta solo el separador (`,`, `;` o tabulador) y respeta las comillas.
- **Adivina el mapeo** comparando tus encabezados con nombres habituales: "Cliente" o
  "Cuenta" → *Empresa*, "Celular" → *Teléfono*, "Dirección" → *Ubicación*, "Ejecutiva" o
  "Vendedor" → *Ejecutivo*. Puedes corregir cada columna antes de importar.
- **Lee montos escritos de cualquier forma**: `$2,950.00`, `3.100`, `89500,75`, `(1,200)`.
- **Traduce el estatus** desde tu texto: "Cotización enviada", "Cerrado ganado", "Cancelado"…
- Descarta filas vacías y usa el contacto como nombre si falta la empresa.

En `plantilla.csv` está el formato exacto.

## La misma cartera en todos los equipos

Sin configurar nada, cada computadora guarda lo suyo. En **Ajustes → Nube y equipo** se pega
la dirección y la llave pública de un proyecto de [Supabase](https://supabase.com) y a partir
de ahí todos trabajan sobre los mismos datos, cada quien con su correo y contraseña. El paso
a paso —crear el proyecto, correr `nube.sql`, dar de alta al equipo y dejar la aplicación en
una dirección de internet— está en **[NUBE.md](NUBE.md)**.

Cómo se comporta, en corto:

- El navegador **sigue siendo la copia de trabajo**: la aplicación abre al instante y deja
  trabajar aunque se caiga el internet. Cuando vuelve la señal, sube lo que hiciste.
- Se sincroniza **registro por registro**, no el archivo completo: cada cliente, actividad,
  convenio y huésped es una fila. Dos personas pueden capturar a la vez sin pisarse mientras
  no sea el mismo registro; si lo es, queda el último que guardó.
- Se revisa si hay novedades **cada 15 segundos** —no hay conexión viva que mantener— y lo
  que guardas sube de inmediato.
- **Con un formulario abierto no se baja nada**, para no moverle los datos a quien está
  capturando.
- Una baja **se marca**, no se borra: si la fila desapareciera sin más, los demás equipos
  nunca se enterarían.
- El semáforo del encabezado dice si está *En línea*, *Sincronizando…* o *Sin conexión*, y al
  pasarle el cursor dice con qué cuenta y cuál fue el último error.

La llave que se pega en Ajustes es la **anon**, pública por diseño: viaja dentro de la página
y por sí sola no abre nada, porque la tabla exige haber entrado con una cuenta del equipo
(*row level security*). La llave `service_role` **no se usa aquí y no debe pegarse en ningún
lado**. `nube.sql` deja además una bitácora (`crm_bitacora`) con quién cambió qué y cuándo.

## Respaldos

Sin nube, los datos viven en el navegador: **se pierden si borras el historial y la caché del
sitio**, y no se comparten entre computadoras. Con nube configurada siguen viviendo también
ahí, pero el respaldo local sigue siendo la única copia que te llevas contigo. Usa
*Exportar* seguido:

- **Respaldo completo (JSON)** — lo único que guarda las firmas y los textos de cada convenio.
  Se restaura desde la misma ventana de Exportar.
- **CSV de clientes, actividades y convenios** — para Excel. El de convenios saca una fila por
  habitación.

### Catálogo cargado

| Clave | Tipo | Bloque | Tarifa pública |
|---|---|---|---|
| STKN | Standard King | Deluxe | 5,300 |
| STQU | Standard Queen | Deluxe | 5,300 |
| STDB | Standard Double | Deluxe | 5,300 |
| GDKN | Garden King | Deluxe | 6,460 |
| GDDO | Garden Double | Deluxe | 6,460 |
| SUKN | Suite King | Deluxe | 5,300 |
| MSTR | Master Suite | Deluxe | 12,031 |
| PSDT | Presidencial | Deluxe | 14,601 |
| CARE | Care | Recovery | N/A |

## Pendientes

- Las tarifas y los textos por omisión salen de la carta-convenio de **Quartz Hotel & Spa**
  para *Samaha Clinik* (agosto 2026). Revisa en Ajustes que sigan vigentes.
- **Suite King aparece con la misma tarifa pública que las Standard (5,300).** Viene así del
  catálogo que nos pasaron; conviene confirmarlo antes de emitir convenios con ese tipo.
- **Permisos por persona.** Con la nube, hoy todos pueden todo. Si se quiere que sólo la
  gerencia edite tarifas o cierre convenios, se hace con una tabla de roles y ajustando las
  políticas de `nube.sql`.
- **Aviso instantáneo** en lugar del sondeo de 15 segundos: Supabase lo permite (Realtime).
