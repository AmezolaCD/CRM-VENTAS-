# Banquetes

El departamento de banquetes vende otra cosa que ventas: no vende noches de hotel, vende
eventos. Un salón, unas horas, tantos invitados y lo que se sirve. Por eso tiene sus propias
pestañas y sus propios documentos.

---

## Qué ve el equipo de banquetes

El papel **Banquetes** (en *Ajustes → Usuarios y permisos*) da acceso a:

| Ve | No ve |
|---|---|
| Tablero, Clientes y Actividades — **la cartera es común con ventas** | Convenios de hospedaje |
| Eventos (cotizaciones) y Contratos banquetes | Contratos de hospedaje |
| Calendario y Reportes | Ajustes |
| Formulario de prospección | |

La cartera de clientes se comparte a propósito: si una empresa hace su convención en el hotel y
además renta salón para la cena, es **un solo cliente**, no dos fichas.

Ventas, del otro lado, no ve las pestañas de banquetes —le estorbarían todo el día— pero sí el
calendario y los reportes, que son de los dos.

---

## Cotización de evento

Pestaña **Eventos**. Sale del machote que trae el departamento, sección por sección.

- **Detalles del evento**: un renglón por momento —el cóctel, la cena, el after— con su fecha,
  horario, invitados, montaje y salón. Eso es lo que después aparece en el calendario, así que
  un evento que cruza la medianoche sale en los dos días.
- **Servicios cotizados**: texto libre, tal cual va en el documento, por espacio y con sus
  viñetas. Se imprime respetando los renglones.
- **Propuesta económica**: cada renglón con su cantidad y su precio. El **IVA del 8%** lo pagan
  todos; el **cargo por servicio del 15%** sólo los que lo lleven, y eso se marca con una
  palomita renglón por renglón — alimentos y bebidas sí, audiovisual, DJ, pista y mobiliario
  no. Así es como lo cobra el hotel y así cuadran las cuentas con las cotizaciones que ya
  existían.

Folio propio: `EV-2026-001`.

---

## Contrato de banquetes

Pestaña **Contratos banquetes**, folio `CB-2026-001`.

No se captura de cero: desde una cotización firmada, el botón **Pasar a contrato** lo crea con
los mismos momentos y los mismos renglones, y sólo pide lo que falta —garantía de invitados,
anticipo y fecha límite de pago—.

El documento es el **contrato de prestación de servicios de eventos sociales** completo, con
sus diecinueve cláusulas, las penas de cancelación escalonadas (10 / 25 / 50 / 100 %) y sus dos
anexos: el **A** con el desglose del servicio y el **B** con la hoja de trabajo. El monto sale
en número y en letra, como pide un contrato.

### Los datos legales se capturan una vez

> **Esto hay que hacerlo antes de emitir el primer contrato.**

El RFC del hotel, la escritura, el domicilio fiscal, la cuenta bancaria y la CLABE **no están
escritos en la aplicación**, y no es un olvido: `index.html` es un archivo público —está en
internet y el repositorio también—, así que ahí no puede ir nada de eso.

Se capturan una sola vez en **Ajustes → Datos legales del contrato de banquetes** y se quedan
en la nube del hotel, donde sólo los ve el equipo. Mientras estén vacíos, el contrato sale con
rayitas en su lugar en vez de inventar nada.

---

## Calendario

Pestaña **Calendario**. Un mes a la vista con:

- Los **eventos** de banquetes, en verde los contratados y en morado los cotizados. Cada uno
  muestra su horario, su salón y sus invitados al pasar el ratón.
- Las **actividades agendadas** del equipo, en ámbar.

Sirve para dos cosas distintas: no encimar dos eventos en el mismo salón, y ver de un vistazo
la semana de cada quien. Al tocar un evento se abre su documento; al tocar un día, la lista de
todo lo que cae ahí.

Cada quien ve lo suyo: un ejecutivo, sus eventos y sus actividades; gerencia y administración,
las de todo el equipo.

---

## Reportes de ingreso

Pestaña **Reportes**.

Cada documento se cuenta **en el mes en que ocurre el evento o la estancia**, no en el que se
firmó: es cuando el hotel de verdad cobra. Y una cotización que ya tiene contrato **no se
cuenta dos veces** — manda el contrato.

- **Cerrado** contra **en la mesa**, por separado: lo firmado y lo que sigue pendiente.
- **Por área**: banquetes y hospedaje.
- **Por ejecutivo**, con su barra para comparar.
- **Por mes**, para ver la estacionalidad.
- El **detalle** documento por documento, y todo exportable a CSV.

El rango de fechas se cambia arriba; por omisión es el año en curso.

> Esto es la primera versión, la que se pidió: ingresos generales y por ejecutivo. Falta
> definir con el equipo qué más quieren ver —ocupación de salones, ticket promedio,
> conversión de cotización a contrato— y eso es otra fase.
