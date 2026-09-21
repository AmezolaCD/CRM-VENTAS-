# CORE · CRM de Ventas

CRM para el equipo de ventas del hotel: cartera de clientes, bitácora de actividad y
generación de cartas-convenio con firma digital. Es **un solo archivo HTML**: no hay que
instalar nada ni levantar un servidor — se abre con doble clic en cualquier navegador.

> **El código es público; los datos no.** Este repositorio se abrió para poder publicar la
> aplicación automáticamente. La cartera —clientes, actividades, convenios firmados, huéspedes
> y tarifas pactadas— vive en Supabase, detrás de cuentas con contraseña, y nunca toca este
> repositorio. Aquí no hay llaves ni contraseñas, y todos los datos de ejemplo son inventados.
> Está hecho a la medida de **Quartz Hotel & Spa**, así que a otro hotel le servirá de punto de
> partida, no de producto terminado.

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

En operación, el CRM vive en **<https://core-quartz.vercel.app>** y los datos en Supabase.
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

### Actividad de los ejecutivos

Las actividades viven en la ficha de cada cliente, pero para saber qué hizo alguien en la
semana había que abrir cliente por cliente. La pestaña **Actividades** las junta todas y las
mira desde el otro lado: por **quien las hizo**.

Arriba, un resumen con una fila por ejecutivo: cuántas llamadas, reuniones, correos y
WhatsApp lleva en el periodo, el total, y cuándo fue la última. Debajo, el detalle renglón por
renglón, de lo más reciente a lo más viejo.

Se filtra por **periodo** (hoy, 7 días, 30 días, este mes, todo, o entre dos fechas),
por **ejecutivo** y por **tipo**; los filtros se acumulan. El buscador de arriba también
alcanza aquí, y busca dentro del asunto y de las notas.

Un detalle a propósito: el filtro de ejecutivo de la barra superior **se esconde** en esta
vista. Ese filtra por el ejecutivo **asignado al cliente**, y aquí lo que importa es **quién
hizo** la actividad — que no siempre son la misma persona. Mezclarlos daría números que
parecen correctos y no lo son.

Al hacer clic en un renglón se abre la actividad para editarla. **+ Registrar actividad** deja
capturar sin entrar a la ficha del cliente: primero pregunta con cuál es. Y **Exportar CSV**
saca exactamente lo que esté filtrado a la vista, no toda la bitácora.

### Convenios

Un convenio se arma eligiendo el cliente y marcando las habitaciones que entran:

- Cada habitación tiene una **casilla**. Sin marcar, su tarifa ni se puede capturar; al
  marcarla se habilita y toma el foco. Si la desmarcas, se limpia.
- La **tarifa pública** (rack) sale del catálogo y **se muestra pero no se puede editar**.
  Admite **N/A** para las habitaciones sin tarifa pública, como el Recovery *Care*.
- La **tarifa convenio** se captura a mano. Al lado se calcula el descuento contra la pública.
- Un interruptor decide si el convenio **incluye también las habitaciones Recovery**, con su
  propia tarifa pública fija y su tarifa convenio capturable.
- El **ejecutivo de ventas** se escoge de una lista desplegable con el equipo dado de alta.
  Toma por omisión al del cliente y lo sigue si se cambia de cliente, pero se puede cambiar:
  a veces alguien levanta un convenio para un cliente que atiende otra persona. Es quien firma
  por el hotel y a quien se le avisa cuando el cliente firma.
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
   → El convenio queda bloqueado, **el cliente pasa a "Cotización enviada"** y se genera la
   clave del enlace de firma.
   La primera vez se ofrece **guardar la firma**; después basta con confirmarla, y se puede
   reemplazar o borrar desde ahí mismo o desde el menú de la sesión. Con nube la firma va en la
   ficha del usuario y lo acompaña a cualquier computadora; sin nube se queda en esa máquina y
   se borra al cerrar sesión.
3. **Se envía al cliente**, por correo o WhatsApp. La columna **Enviado** de la tabla dice
   cuándo salió y por dónde, igual que en las confirmaciones.
4. **Firma el cliente** → **pasa automáticamente a "Ganado"** y su tarifa se actualiza con la
   habitación más económica del convenio.

Cada paso deja constancia en la bitácora del cliente.

##### El paso 4 tiene tres caminos, y los tres cierran igual

- **En su pantalla.** El cliente abre el enlace, lee su convenio y firma con el dedo o el
  ratón. No instala nada ni crea ninguna cuenta. Requiere haber corrido `firmas.sql`.
- **En papel.** Se le manda el PDF, lo firma a mano y lo devuelve escaneado; el ejecutivo lo
  sube con **Subir convenio firmado**. Queda tan cerrado como el anterior, y con el escaneado
  guardado como constancia.
- **Capturada por el ejecutivo**, con *Registrar firma del cliente*, para cuando el cliente
  firma delante de él.

Los tres pasan por la misma función a propósito: si cada camino cerrara el convenio a su
manera, el tablero acabaría diciendo una cosa y la carta otra.

##### Cómo está pensado el enlace del cliente

El cliente no tiene cuenta ni tiene por qué tenerla. El enlace lleva una clave larga y al
azar, y esa clave es **lo único que abre ese convenio y ningún otro**. Al abrirlo, la
aplicación se convierte en su documento: no enseña tablero, ni cartera, ni pestañas.

El convenio se le enseña **como papel: tinta oscura sobre blanco**, traiga su teléfono el tema
que traiga. Y el destinatario va **congelado dentro del propio convenio**, junto con las
tarifas y los textos: la carta que ve el cliente no depende de que nadie ande editando su
ficha mientras tanto.

La firma **no se escribe encima del convenio**. El visitante la deja en un buzón aparte donde
puede depositar pero no leer ni corregir, y de ahí la levanta el CRM en la siguiente
sincronización. Así, aunque alguien anduviera de mirón, no podría leer convenios ajenos ni
alterar el suyo. La clave deja de servir en cuanto se firma.

Todo esto lo habilita `firmas.sql`. **Sin correrlo, el CRM funciona igual**: el enlace no se
ofrece y quedan los otros dos caminos.

##### El folio

Se arma solo: `CV-2027-003`. El año sale de la **vigencia**, no de la fecha de hoy —un convenio
que se captura en diciembre para el año que entra lleva el año que entra—, así que al cambiar
*Vigencia desde* a otro año el folio se acomoda mientras nadie lo haya escrito a mano.

El consecutivo se cuenta **por año**, y sale del folio más alto que ya exista para ese año, no
de cuántos convenios haya en total: contar el total repetía folios en cuanto se borraba uno, y
hacía que enero arrancara donde se quedó diciembre. Un año sin convenios empieza en `001`.

Se decide **al guardar, no al abrir** el editor: entre que alguien lo abre y le da guardar
pueden pasar minutos, y en ese rato otro pudo haber tomado el número.

**Dos ejecutivos capturando a la vez, cada uno en su equipo, pueden tomar el mismo folio**:
cada quien cuenta con lo que tiene bajado y ninguno ve todavía el convenio del otro. Se
detecta al sincronizar, segundos después, y se resuelve solo: **el que se creó primero
conserva su folio** y el otro toma el siguiente libre, con constancia en la bitácora del
cliente.

Con una excepción deliberada: **un convenio ya firmado o ya enviado no se renumera por
detrás**. Su folio va impreso en un PDF que anda en el correo de un cliente, y cambiárselo a
escondidas sería peor que el problema. Esos se marcan como *repetido* en la lista, con un
aviso arriba, para que una persona decida qué folio lleva cada uno.

##### Lo que se ve en la tabla

La columna **Habitaciones** enseña las claves del convenio —`STKN`, `GDDO`, `CARE`— y no
cuántas son: un número no dice nada de un vistazo, y la clave es la que usa el equipo a
diario. Las de Recovery van en dorado, que es lo que antes decía el "+R". Al pasar el cursor
salen los nombres completos, para quien no se las sepa de memoria.

##### El aviso al ejecutivo

Cuando un cliente firma, aparece un aviso en el encabezado del CRM: *«Grupo Marín firmó el
convenio CV-2026-002»*. Se apaga al abrir la carta — ya la está viendo. Sólo le sale a quien
le toca: el ejecutivo dueño del cliente, la gerencia y el administrador.

**Por correo no.** Una página web no puede mandar correos por sí sola; hace falta un servicio
de envío. Queda pendiente y está anotado al final.

> **Límite que conviene tener claro:** el CRM no manda el correo ni el mensaje por sí solo:
> abre el tuyo con todo redactado y tú le das enviar. Y el aviso de que el cliente firmó sale
> dentro del CRM, no por correo.

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

### Contratos

Pestaña **Contratos**. Cotiza una **estancia concreta**: estas fechas, estas habitaciones y, si
lo hay, el salón del evento. No hay que confundirla con *Convenios*, que fija las tarifas de
empresa de todo el año; son dos documentos distintos y cada uno vive en su pestaña.

El machote sale del que ventas traía en Word, sección por sección y en el mismo orden:
membrete, fecha, título, destinatario, saludo, **servicios cotizados**, **propuesta económica ·
hospedaje**, **salones y eventos**, **costos adicionales no incluidos**, vigencia, forma de
pago y el bloque de firmas.

- **Hospedaje**: una línea por tipo de habitación, con noches y precio unitario. El subtotal y
  el total con impuestos se calculan solos, con el **13%** por omisión (8% de IVA más 5% sobre
  hospedaje), editable por documento.
- **Salones y eventos** es opcional: fecha, horario, evento, pax, montaje, salón y renta.
- **Costos adicionales** arranca con el estacionamiento ya puesto, como en el machote.
- Folio propio: `CT-2026-001`, que sigue al año de la fecha del documento.
- **Tipo de documento**: *Cotización* o *Contrato*. Cambia el título y el párrafo legal del
  cierre — la cotización dice que no compromete al hotel; el contrato, que los servicios quedan
  confirmados al firmar.
- Se firma igual que el convenio: el ejecutivo primero —con su firma guardada, si ya la tiene—
  y luego la **firma de aceptación** del cliente, que lo deja en *Aceptado*. Cada paso queda en
  la bitácora del cliente.
- Se imprime, se descarga en PDF y se manda por correo o WhatsApp, con la columna **Enviado**
  como en todo lo demás.

### Documentos que no se hicieron aquí

En *Convenios* y en *Contratos* hay un botón **Subir uno firmado**: registra un convenio, una
cotización o un contrato que **ya andaba firmado** antes de usar el CRM, o que se hizo en Word
como siempre.

Se pide el cliente, el ejecutivo —que sigue al del cliente—, el folio que traiga el papel, la
fecha y el **archivo escaneado** (PDF o foto). No se vuelve a armar el documento: lo que vale
es el escaneado, y por eso la ficha queda marcada como **externa** y al abrirla enseña el
archivo en vez de una carta en blanco. En la lista lleva su etiqueta, para que nadie se
pregunte por qué no tiene carta.

Un convenio externo cierra igual que uno firmado en pantalla: el cliente pasa a **Ganado** y
queda su línea en la bitácora. Una cotización o un contrato externo caen en *Contratos* como
**Aceptados**.

#### Dónde se guardan los escaneados

Con el **almacén del proyecto** montado —se corre `archivos.sql` una vez— el archivo va a un
depósito aparte de Supabase y del documento cuelga nada más la ruta. Caben hasta **20 MB por
archivo** y 1 GB en total en el plan gratuito, y el navegador deja de cargar con ellos.

Sin montar, el escaneado se guarda **dentro del propio documento**. Así empezó, y funciona,
pero el navegador corta cerca de los **5 MB**: con tres o cuatro escaneados se llena y la
aplicación avisa que ya no cabe. El límite por archivo baja entonces a 2 MB.

Si ya había escaneados guardados así, **no hay que volver a subirlos**: *Ajustes → Nube y
equipo → Mover los escaneados al almacén* los muda de uno en uno y libera el navegador de todo
el equipo. Si se corta a la mitad, lo que ya subió quedó bien y volver a darle continúa donde
se quedó.

### Banquetes: eventos, contratos, calendario y reportes

Banquetes no vende noches: vende eventos. Tiene sus propias pestañas —**Eventos** para las
cotizaciones, **Contratos banquetes** para el legal— con su estructura y sus cuentas: IVA del
8% para todo y cargo por servicio del 15% sólo en los renglones de alimentos y bebidas, que se
marcan uno por uno.

El **Calendario** muestra el mes con los eventos y las actividades agendadas del equipo, y los
**Reportes** dan el ingreso cerrado y el que sigue en la mesa, por área, por ejecutivo y por
mes, contando cada documento en el mes en que ocurre el evento.

Todo eso lo ven **las cuatro cuentas del departamento y la del administrador, y nadie más**:
ventas —gerencia incluida— no ve las pestañas de banquetes, ni sus eventos en el calendario, ni
su dinero en los reportes. Del otro lado, banquetes comparte la cartera de clientes con ventas
pero no ve los convenios ni los contratos de hospedaje. Hay dos papeles: **gerencia de
banquetes**, que alcanza lo de todo su equipo, y **ejecutivo de banquetes**, que alcanza lo
suyo. Quién es quién, y los datos legales que hay que capturar antes del primer contrato, en
**[BANQUETES.md](BANQUETES.md)**.

### Formulario de prospección

Pestaña **Formulario**. Para levantar contactos en una expo, una feria o un evento del hotel,
de pie y con prisa.

- Pide **nombre**, **apellido**, **correo electrónico** y **número de teléfono**. La
  **compañía** es opcional, y hay un campo de **evento** —también opcional— que se queda
  puesto entre un registro y el siguiente, porque en un stand se capturan decenas seguidos
  del mismo.
- El correo y el teléfono se validan de verdad: un registro de evento sin manera de volver a
  contactar a la persona no sirve de nada. Si el correo ya estaba capturado, avisa antes de
  guardar por segunda vez.
- Lo capturado **no entra a la cartera**. Vive en su propia lista, se busca, se edita y se
  exporta a CSV. Cuando alguno vale la pena, **Pasar a la cartera** pregunta la empresa y el
  ejecutivo que lo va a trabajar, y ahí sí crea el cliente en *Contactado*, con su nota
  diciendo de qué evento salió y su línea en la bitácora.
- Cada registro es de quien lo capturó. Un ejecutivo ve los suyos; gerencia y administración
  los ven todos, con una columna extra que dice quién capturó cada uno.

Existe un papel de usuario, **Sólo prospección**, que no ve más que esta pestaña: es el de la
cuenta de la tableta del lobby. Ver **[ROLES.md](ROLES.md)**.

#### Modo tableta

El botón **Abrir modo tableta** deja la pantalla completa con nada más el formulario, para
entregarle el aparato al cliente y que se registre él mismo.

- Antes de entregarla se fija **de qué evento es** y **a nombre de quién** quedan los
  registros. Eso ya no se le pregunta al cliente.
- La pantalla se llena de blanco con el membrete del hotel y **cinco campos**. El CRM no se
  tapa: se quita de la página, así que no se alcanza ni con el teclado ni con el lector de
  pantalla. No hay pestañas, ni cartera, ni un solo dato de otra persona.
- Al enviar da las gracias por su nombre y **se limpia sola** —a los nueve segundos o en
  cuanto alguien toque *Registrar a otra persona*—, de modo que el siguiente no se encuentra
  los datos del anterior.
- Si el correo ya estaba capturado **no pregunta nada**: la pregunta diría el nombre de quien
  lo dejó antes, y eso es un dato ajeno en una pantalla que cualquiera está viendo. Se guarda
  y se depura después.
- **Aguanta una recarga.** Si el cliente jala la pantalla hacia abajo y el navegador recarga,
  la tableta vuelve al modo cliente sola; si no, quedaría el CRM a la vista de quien pasara.
- Pide **pantalla completa** al navegador y, donde se puede, evita que la tableta se apague.
- **Para salir** hay que mantener pulsada la esquina de arriba a la derecha dos segundos. Un
  toque no basta: así nadie se sale de curioso y no hay otra contraseña que recordar.

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
archivo sale como `Convenio-CV-2026-001-CLINICA-DEL-VALLE.pdf` y el envío queda anotado en la
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

## Preguntarle a la IA

Abajo a la derecha hay un botón redondo. Abre un recuadro donde se le puede preguntar en
español sobre la cartera —*a quién le hablo primero hoy*, *qué convenios están a medio
firmar*, *escríbeme un correo de seguimiento*— y contesta sobre **lo que esa persona ya ve**:
a un ejecutivo, con su cartera; a gerencia, con la de todo el equipo.

Usa **Google Gemini**, que tiene capa gratuita. Hace falta montarlo una vez: la llave de
Google **no puede vivir en `index.html`**, que es una página pública, así que se queda en
Supabase y ahí corre la función `supabase/functions/ia`, la única que habla con Google.
Mientras no esté montada, el botón lo explica en vez de fallar. Los pasos, lo que se manda y
lo que no, y cómo apagarlo están en **[IA.md](IA.md)**.

## Quién ve qué

Siete papeles: **administrador** (todo, y el único con Ajustes), **dirección** (todo el hotel,
de todo el equipo, sin Ajustes), **gerencia de ventas** (la
cartera y la actividad de todo el equipo, sin Ajustes), **ejecutivo de ventas** (sólo lo suyo,
más las actividades que él mismo hizo), **gerencia de banquetes** (los eventos y contratos de
todo su equipo), **ejecutivo de banquetes** (nada más los suyos) y **sólo prospección** (nada
más la pestaña *Formulario* y lo que esa cuenta capturó). Se administran en *Ajustes → Usuarios
y permisos*.

Ventas y banquetes no se ven los papeles del otro: ventas no alcanza los eventos ni los
contratos de banquetes —ni en el calendario ni en los reportes—, y banquetes no alcanza los
convenios ni los contratos de hospedaje. La cartera de clientes sí es una sola.

Quien alcanza los dos departamentos —la dirección y la administración— **escoge en cuál entra**
en una pantalla que sale al abrir, y se cambia de uno a otro con el botón del encabezado, sin
volver a entrar. Agregar un departamento más adelante son dos renglones de configuración; el
detalle está en **[ROLES.md](ROLES.md)**.

Lo que amarra a una persona con su cartera es el **nombre**, no el correo: se compara contra
el campo *Ejecutivo* de cada cliente. Escribirlos distinto es el error más fácil de cometer y
el más difícil de ver.

Los permisos van en dos niveles y conviene no confundirlos: lo configurado en Ajustes acomoda
**lo que cada quien ve en pantalla**, pero los datos siguen bajando completos a cada equipo.
Para que el servidor mismo niegue la cartera ajena hay que correr `roles.sql`. Todo el
detalle, los pasos y cómo deshacerlo están en **[ROLES.md](ROLES.md)**.

Si alguien deja de ver algo que le tocaba, el chip con su nombre —arriba a la derecha— abre
**¿Por qué no veo algo?**: dice cuántos registros de cada tipo le está entregando el servidor,
nombra la causa cuando la hay y trae un *Volver a bajar todo*. Lo alcanza cualquiera, no sólo
el administrador.

Ese mismo chip dice siempre en qué estado está el aparato. Cuando marca **Sólo este equipo**
es que ese navegador **no está conectado a la nube**: lo que muestra es nada más lo capturado
ahí, y nada de lo que se capture le llega al resto. Pasa sin querer, porque la conexión se
guarda **por navegador y por dirección** —otro navegador del mismo aparato, o el modo privado,
empiezan de cero—, y antes se veía igual que un equipo conectado pero vacío.

## Entrar desde Core Quartz

El CRM puede abrirse desde **Core Quartz**, el portal del hotel: una sola
contraseña para el CRM y el CDH, y un solo lugar para dar de alta y de baja al
personal. El portal manda un **pase de un solo uso** en la dirección y el CRM
lo canjea para abrir su propia sesión, la misma de siempre.

No sustituye nada: la pantalla de acceso con correo y contraseña sigue
funcionando igual, y sin el portal el CRM se comporta como hoy. El enlace de
firma que se le manda al cliente (`#firmar=…`) tampoco cambia.

El paso a paso y lo que conviene saber para una computadora compartida están en
**NUBE.md → Entrar desde Core Quartz**.

## La misma cartera en todos los equipos

Sin configurar nada, cada computadora guarda lo suyo. En **Ajustes → Nube y equipo** se pega
la dirección y la llave pública de un proyecto de [Supabase](https://supabase.com) y a partir
de ahí todos trabajan sobre los mismos datos, cada quien con su correo y contraseña. El paso
a paso —crear el proyecto, correr `nube.sql`, dar de alta al equipo y dejar la aplicación en
una dirección de internet— está en **[NUBE.md](NUBE.md)**.

Cómo se comporta, en corto:

- **La base de datos es una sola y vive en la nube.** Lo que hay en cada navegador es una
  copia de trabajo de esos mismos datos, no una segunda base: sirve para que la aplicación
  abra al instante y aguante si se cae la señal un rato.
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
- En el encabezado, un botón con el **nombre de quien está usando el CRM**. Al apretarlo dice
  su papel y su correo, y ofrece **cerrar sesión** — a la mano para cualquiera, porque en la
  oficina se comparte la computadora y esconderlo en unos Ajustes que sólo ve el administrador
  no serviría de nada.
- **Al cerrar sesión se borra la copia de este equipo.** No basta con olvidar la contraseña:
  la cartera de quien se va seguiría en el navegador y la vería el siguiente, aunque el
  servidor no le entregara ni una fila. Antes de borrar se sube lo que quede pendiente, y si
  no se logra, se pregunta: perder capturas por cerrar sesión sería el peor final posible.
- Un equipo nuevo se da de alta con **Copiar liga para otro equipo**: la liga lleva dentro la
  dirección y la llave, así que quien la abre sólo pone su correo y contraseña. La
  configuración viaja después del `#` —esa parte no llega al servidor— y se borra de la barra
  de direcciones al abrirla.

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

## Sobre los datos de ejemplo

**Todas las empresas, personas, teléfonos y correos que trae el código son inventados**, y los
dominios usan `.example`, que está reservado justo para esto y nunca va a existir. El
repositorio es público: ningún cliente real puede aparecer aquí. La cartera de verdad vive en
Supabase, y ni la dirección del proyecto ni las llaves están en el código — se capturan una
vez por equipo en *Ajustes → Nube y equipo*.

Las tarifas rack del catálogo sí son las del hotel, pero son públicas por definición: es lo
que paga quien llega sin convenio. Las tarifas convenio, que sí son confidenciales, se pactan
por cliente y viven en Supabase.

## Pendientes

- Las tarifas y los textos por omisión salen de una carta-convenio real de **Quartz Hotel &
  Spa** de agosto de 2026. Revisa en Ajustes que sigan vigentes.
- **Suite King aparece con la misma tarifa pública que las Standard (5,300).** Viene así del
  catálogo que nos pasaron; conviene confirmarlo antes de emitir convenios con ese tipo.
- **Permisos por persona.** Con la nube, hoy todos pueden todo. Si se quiere que sólo la
  gerencia edite tarifas o cierre convenios, se hace con una tabla de roles y ajustando las
  políticas de `nube.sql`.
- **Aviso instantáneo** en lugar del sondeo de 15 segundos: Supabase lo permite (Realtime).
- **Avisar por correo al ejecutivo** cuando el cliente firma. Hoy el aviso sale dentro del
  CRM. Para que además llegue un correo hace falta un servicio de envío (Resend, SendGrid o
  similar) y una función en el servidor de Supabase que lo dispare: una página web no manda
  correos por sí sola.
