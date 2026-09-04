# CRM de Ventas · Kanban

Tablero Kanban para dar seguimiento al pipeline de ventas. Es **un solo archivo HTML**:
no hay que instalar nada ni levantar un servidor — se abre con doble clic en cualquier navegador.

## Cómo usarlo

1. Descarga o clona este repositorio.
2. Abre `index.html` en Chrome, Edge, Firefox o Safari.

Los datos se guardan en el **almacenamiento local del navegador** (`localStorage`), en el equipo
donde lo abres. Al abrirlo por primera vez verás 6 negocios de ejemplo para que se entienda el
funcionamiento: bórralos con *Exportar → Borrar todos los datos*, o simplemente marca
**"Reemplazar todos los negocios actuales"** al importar tu archivo.

## Qué trae

- **7 etapas del pipeline**: Prospecto → Contactado → Calificado → Propuesta → Negociación → Ganado / Perdido.
- **Arrastrar y soltar** entre columnas. En celular, los botones `‹ ›` de cada tarjeta hacen lo mismo.
- **Indicadores en la parte superior**: pipeline abierto, valor ponderado por probabilidad, total ganado y tasa de cierre. Respetan el buscador y el filtro activos.
- **Total por columna** (cantidad de negocios e importe).
- **Buscador** por negocio, empresa, contacto, correo, teléfono, notas o etiquetas, y **filtro por responsable**.
- **Alerta de fechas**: las tarjetas marcan en ámbar las que cierran en 7 días o menos, y en rojo las vencidas.
- **Importar CSV** con mapeo de columnas asistido.
- **Exportar** a CSV (se abre en Excel), respaldo en JSON y plantilla vacía.
- **Tema claro y oscuro** (sigue al sistema; el botón `◐` lo cambia a mano).

## Importar tus datos

Botón **Importar**. Acepta un archivo `.csv` / `.tsv` o texto pegado directamente.

Si tus datos están en Excel o Google Sheets, primero guárdalos como CSV
(*Archivo → Descargar → CSV* / *Guardar como → CSV UTF-8*).

La primera fila debe ser la de encabezados. El importador:

- Detecta solo el separador (`,`, `;` o tabulador) y respeta las comillas.
- **Adivina el mapeo** comparando tus encabezados con nombres habituales en español e inglés
  — "Cliente" o "Cuenta" caen en *Empresa*, "Importe" o "Valor" en *Monto*, "Vendedor" o "Asesor"
  en *Responsable*, etc. Igual puedes corregir cada columna a mano antes de importar.
- **Lee montos escritos de cualquier forma**: `$120,000.50`, `1.250.000`, `89500,75`, `(1,200)`.
  La regla es que el último separador es decimal solo si deja uno o dos dígitos detrás.
- **Lee fechas** en `2026-09-04`, `04/09/2026`, `4-9-26` y también los números de serie de Excel.
  Los formatos con diagonales se interpretan como día/mes salvo que sea imposible.
- **Traduce la etapa** desde el texto que traigas: "Cotización" → Propuesta, "Cerrado ganado" → Ganado,
  "Cancelado" → Perdido, y así. Lo que no reconoce se va a Prospecto.
- Descarta filas vacías y usa la empresa como nombre del negocio cuando falta el título.

Puedes elegir entre **agregar** los registros a lo que ya existe o **reemplazar** todo.

### Columnas que reconoce

| Campo del CRM | Ejemplos de encabezado que detecta |
|---|---|
| Negocio | Negocio, Oportunidad, Título, Concepto, Proyecto, Deal |
| Empresa | Empresa, Cliente, Cuenta, Razón social, Compañía |
| Contacto | Contacto, Persona, Nombre contacto |
| Email | Email, Correo, Correo electrónico |
| Teléfono | Teléfono, Celular, Móvil, WhatsApp |
| Monto | Monto, Importe, Valor, Precio, Total, Cotización |
| Probabilidad % | Probabilidad, Porcentaje |
| Cierre estimado | Fecha de cierre, Cierre estimado, Vencimiento |
| Responsable | Responsable, Vendedor, Asesor, Ejecutivo, Agente |
| Origen | Origen, Fuente, Canal, Medio |
| Etiquetas | Etiquetas, Tags, Categoría (separadas por coma) |
| Notas | Notas, Comentarios, Observaciones |
| Etapa | Etapa, Estatus, Estado, Fase, Pipeline |

En `plantilla.csv` está el formato exacto con dos filas de ejemplo.

## Respaldos

Como los datos viven en el navegador, **se pierden si borras el historial y la caché del sitio**,
y no se comparten entre computadoras. Usa *Exportar* seguido para guardar una copia:

- **CSV** para abrirlo en Excel o volver a importarlo aquí (la ida y vuelta conserva montos, fechas, etapas y etiquetas).
- **JSON** como respaldo fiel de todo.

## Personalizar

Todo está en `index.html`, en el bloque `Configuración` al inicio del `<script>`:

- `STAGES` — las etapas del tablero: nombre, color y cuáles cuentan como ganado o perdido.
- `FIELDS` — los campos de cada negocio. Los `aliases` de cada campo son los que usa el
  auto-mapeo al importar; agregar ahí los encabezados propios de tu equipo hace que se
  detecten solos la próxima vez.

La moneda se formatea como MXN; para cambiarla, busca `currency:"MXN"`.
