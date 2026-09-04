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

## Cómo usarlo

1. Descarga o clona este repositorio.
2. Abre `index.html` en Chrome, Edge, Firefox o Safari.

Los datos se guardan en el **almacenamiento local del navegador** (`localStorage`), en el
equipo donde lo abres. Trae clientes de ejemplo para que se entienda el funcionamiento;
para empezar limpio usa *Exportar → Borrar todos los datos*, o marca **"Reemplazar la
cartera actual"** al importar tu archivo.

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
3. **Se envía al cliente** — el botón prepara el PDF y abre el correo o WhatsApp con el
   mensaje ya redactado.
4. **Firma el cliente** → **el cliente pasa automáticamente a "Ganado"** y su tarifa se
   actualiza con la habitación más económica del convenio.

Cada paso deja constancia en la bitácora del cliente.

> **Límite que conviene tener claro:** al no haber servidor, la aplicación **no puede enviar
> el documento por sí sola ni recibir la firma del cliente a distancia**. Lo que hace es
> generar el PDF y abrir tu correo o WhatsApp para que lo adjuntes; cuando el cliente lo
> devuelva firmado, capturas su firma con *Registrar firma del cliente*. Si necesitan firma
> remota real (el cliente abre un enlace y firma desde su dispositivo), eso requiere backend.

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

*Imprimir / Guardar PDF* saca la carta sola, sin la interfaz, en **tamaño carta**
(216 × 279 mm) con márgenes de 16 × 18 mm. El tamaño se fija con una regla `@page`: sin ella
lo decidía la impresora de cada quien y el mismo documento podía salir en A4. Para cambiarlo,
es una palabra en el CSS (`size: letter` → `size: A4`).

La carta-convenio ocupa tres hojas, con los dos bloques de firma juntos en la última. Cada
confirmación de hospedaje cabe en una.

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
- Cada carta tiene botón de **correo** y de **WhatsApp**, con el mensaje ya redactado.

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

## Respaldos

Los datos viven en el navegador: **se pierden si borras el historial y la caché del sitio**,
y no se comparten entre computadoras. Usa *Exportar* seguido:

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
