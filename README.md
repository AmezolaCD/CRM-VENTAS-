# CRM de Ventas · Hotel

CRM para el equipo de ventas del hotel: cartera de clientes, bitácora de actividad y
generación de cartas-convenio con firma digital. Es **un solo archivo HTML**: no hay que
instalar nada ni levantar un servidor — se abre con doble clic en cualquier navegador.

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
  botones `‹ ›` de cada tarjeta hacen lo mismo.
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

Un convenio se arma eligiendo el cliente y capturando tarifas:

- La **tarifa pública** (rack) sale del catálogo y **se muestra pero no se puede editar**.
  Admite **N/A** para las habitaciones sin tarifa pública, como el Recovery *Care*.
- La **tarifa convenio** se captura a mano. Al lado se calcula el descuento contra la pública.
- Los tipos que dejes en blanco no entran en ese convenio.
- Un interruptor decide si el convenio **incluye también las habitaciones Recovery**, con su
  propia tarifa pública fija y su tarifa convenio capturable.
- Hay un campo de **observaciones internas** que no se imprime en la carta.

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

*Imprimir / Guardar PDF* saca la carta sola, sin la interfaz.

### Ajustes

- **Datos del hotel**: nombre, dirección, teléfono, ciudad (para la línea de fecha), teléfono
  y correo de reservaciones, moneda y lada del país.
- **Catálogo de habitaciones**: clave, tipo, bloque (Deluxe o Recovery) y tarifa pública
  —vacía = N/A—. **Es el único lugar donde se edita la tarifa pública.**
- **Bloques de la carta**: el nombre que encabeza cada tabla y el texto de lo que incluye ese
  bloque, que se imprime **una sola vez** debajo de la tabla, como en el machote.
- **Textos de la carta**: todos editables, con marcadores `{{HOTEL}}`, `{{EMPRESA}}`,
  `{{CONTACTO}}`, `{{VIGENCIA}}` y `{{ANIO}}` que se sustituyen al generar cada carta.

Un convenio guarda **su propia copia** de los textos y de las tarifas al crearse, así que
cambiar el catálogo o los textos **no altera los convenios ya emitidos**.

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
