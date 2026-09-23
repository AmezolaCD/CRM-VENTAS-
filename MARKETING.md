# Marketing

Marketing no vende noches ni eventos: consigue que llegue gente. Lo que mide es otra cosa
—cuánto costó traerla y qué trajo—, así que tiene su propio departamento, sus pestañas y su
gente.

> **Van cuatro de seis entregas.** Hoy hay Campañas, el armador de ligas con UTMs, la liga
> pública de registro con su atribución, el **tablero** y la **conexión con Meta**, que baja
> sola el gasto de los anuncios. Faltan los Lead Ads —que el lead de Meta entre al CRM en el
> momento—, el lead scoring, la biblioteca de activos y las automatizaciones.

---

## Quién entra

| Persona | Correo | Papel |
|---|---|---|
| Paola García · Coordinadora de Marketing | `paolag@quartzhotel.mx` | Coordinación de marketing |
| Pedro Arias · Fotógrafo / Editor | `parias@quartzhotel.mx` | Marketing |
| Sidney Santana · Editora / Diseñadora | `diseno@quartzhotel.mx` | Marketing |
| Marco Ramírez | `sistemas@quartzhotel.mx` | Administrador |
| Dirección | `direccion@quartzhotel.mx` | Dirección |

**Marketing no alcanza la cartera.** Se decidió así: ven sus campañas, sus ligas y los
prospectos, y nada más. Ni clientes, ni convenios, ni contratos, ni eventos de banquetes, ni
Ajustes. Del otro lado, a ventas y a banquetes no les aparecen las pestañas de marketing.

Los **prospectos los ven todos**, no sólo los que capturó cada quien: son el resultado del
trabajo del área. Un fotógrafo que sólo viera los suyos no vería ninguno.

La diferencia entre los dos papeles es la misma que en las otras áreas: la **coordinación** ve
el trabajo de todo su equipo; un **ejecutivo**, lo suyo. Como las campañas son del área y no de
una persona, en la práctica hoy las ven los tres.

### Para darlos de alta

Los dos pasos de siempre (ver `ROLES.md`): primero la cuenta en **Supabase → Authentication →
Users**, con *Auto Confirm User* marcado; después la persona en **Ajustes → Usuarios y
permisos**, con el mismo correo, su nombre y su papel.

---

## Campañas

Una campaña es lo que el hotel sale a hacer para que llegue gente: un anuncio en redes, una
búsqueda pagada, una feria.

- **Canal**: Meta, Google, OTA, expo, referido, orgánico u otro. No es texto libre a propósito.
  Si cada quien escribe «face», «Facebook» y «FB», ningún reporte cuadra nunca.
- **Las de Meta se traen solas.** Al apretar *Sincronizar*, los **conjuntos de anuncios** que
  **estuvieron corriendo** —los que gastaron en el periodo, no los que Meta marca como activos—
  entran al CRM ya enlazados, cada uno como su propia campaña. No se duplican, y si uno ya
  estaba capturado a mano con el mismo nombre se le pone el enlace en vez de crear otro.

  Se traen los **conjuntos** y no las campañas de Meta porque es el nivel con el que se
  trabaja: una campaña de Meta llamada *Eventos* puede traer un conjunto de bodas y otro de
  catering, y aquí ésas son dos cosas con su propio presupuesto y sus propios prospectos. Bajo
  el nombre de cada una dice de qué campaña de Meta cuelga.

  **La inversión no se duplica.** El gasto de un conjunto ya viene dentro del de su campaña
  —Meta no los suma, los desglosa—, así que el CRM le resta a la campaña, día por día, lo que
  ya está enseñando en sus conjuntos; donde diga **· desglosada**, ahí sale sólo lo que sobró.
  La campaña padre **no se desenlaza**, para no borrar de la pantalla los meses de historia que
  sólo existen a ese nivel. Está explicado con detalle en **[META.md](META.md)**.
- **Presupuesto y gasto**: el gasto se captura **mes por mes**, como lo cobra la plataforma. La
  pantalla va sumando y **avisa en rojo cuando se pasa del presupuesto**.
- **Leads**: la columna dice cuántos prospectos trajo. Hoy se llena cuando el prospecto se
  amarra a la campaña; en la entrega 2 lo hará solo la liga pública.

El gasto **se captura a mano**, y con Meta conectado **baja solo al lado**. Los dos se
enseñan: lo capturado manda siempre, porque es lo que de verdad se pagó, y cuando no cuadran
por más de un 10% el CRM lo marca con un **≠** en vez de escoger uno.

Conectar Meta **no cuesta**: su API es gratuita —antes escribí aquí lo contrario y lo
corrijo—. Lo que cuesta es el trámite de permisos, y el hotel ya lo tiene andando desde que la
conexión estuvo en Odoo. Todo el procedimiento está en **[META.md](META.md)**.

Al **eliminar** una campaña, los prospectos que trajo **se quedan** —pierden nada más de qué
campaña vinieron—, y el aviso lo dice con el número antes de borrar.

---

## Atribución & UTMs

Una UTM es una etiqueta que viaja pegada a la liga de un anuncio. Quien la abre llega a la
página del hotel, y la campaña viaja con él.

Aquí **no se escriben a mano: se arman**. Se escoge la campaña, se ajusta a dónde llega y sale
la liga lista para copiar:

```
https://www.quartzhotel.mx/bodas?utm_source=facebook&utm_medium=paid_social&utm_campaign=bodas-verano-2026
```

- `utm_source` — de dónde viene (facebook, google…)
- `utm_medium` — cómo (paid_social, cpc…)
- `utm_campaign` — cuál campaña
- `utm_content` — **qué pieza**, opcional. Cuando la misma campaña corre con dos creativos —un
  video y un carrusel—, se les pone contenido distinto y después se ve cuál trajo más.

La etiqueta de campaña sale del nombre: minúsculas, sin acentos y con guiones. Una UTM con
espacios o acentos llega partida y no hay reporte que la junte después.

La dirección del hotel se guarda una vez en **Ajustes → Datos del hotel → Página del hotel**,
para no volver a escribirla. Si la dirección ya traía un `?`, la liga se pega con `&` y no se
rompe.

---

## La liga pública de registro

Es lo que hace que la medición sea real. Quien ve un anuncio abre la liga, deja sus datos y
**cae en el CRM sabiendo de qué campaña vino** — sin cuenta, sin contraseña y sin que nadie
teclee nada.

Se corre **`prospectos.sql`** una vez en Supabase y ya. Sin correrlo, el armador de ligas
avisa y el resto del CRM funciona igual.

### Los dos destinos

En *Atribución & UTMs* se escoge a dónde manda el anuncio:

- **La liga de registro** (por omisión). El anuncio lleva directo al formulario del hotel.
  **Funciona desde el día uno** y la campaña se amarra sola: nadie tiene que tocar la página.
- **La página del hotel.** El anuncio lleva al sitio. Para que la campaña se amarre, la página
  tiene que mandar a la gente a la liga de registro **conservando las etiquetas**; quien lleve
  el sitio sabrá hacerlo.

### Qué ve y qué no ve el visitante

La pantalla es **la misma del modo tableta**: ya está probada en teléfono, respeta el membrete
del hotel y reclama en el idioma de quien la llena, no en el del sistema. Lo único que cambia
es a dónde va lo que escribe.

El visitante **no lee nada**. Ni la cartera, ni el buzón, ni siquiera lo que él mismo acaba de
escribir. Lo único que puede hacer es depositar. Está comprobado contra un PostgreSQL de
verdad, no de vista.

La clave de la liga es del hotel y va en la dirección, porque es una liga pública que se pega
en un anuncio. Lo único que abre es el derecho a **depositar**: si alguien la copia, lo peor
que puede hacer es mandar registros de mentira, que se borran de un clic. Cambiarla invalida
las ligas viejas.

**La crea el administrador, no marketing.** Es una sola para todo el hotel y vive en los
ajustes, que con `roles.sql` corrido sólo escribe el administrador. Si la inventara marketing se
quedaría en esa computadora: el servidor nunca la conocería y **rebotaría a todo el que abriera
el anuncio** —después de haberlo pagado—. Y el día que el administrador abriera la pantalla se
inventaría otra, dejando muerta la del anuncio sin que nadie supiera por qué.

Así que la primera vez, el administrador entra al CRM y abre *Atribución & UTMs*: con eso la
clave se crea y se publica. A partir de ahí marketing arma todas las ligas que quiera. Mientras
no esté publicada, la pantalla **no entrega una liga que no sirve**: dice qué falta y a quién
pedírselo.

### La cadena completa

```
anuncio → liga con UTMs → formulario → buzón → prospecto → cliente → convenio / evento → dinero
```

El CRM recoge del buzón en cada sincronización y crea el prospecto con **su canal, su campaña
y sus etiquetas completas**. Si la etiqueta de campaña no se reconoce, el prospecto entra de
todos modos: más vale un lead sin campaña que un lead perdido.

Al pasarlo a la cartera, **el cliente se queda con la campaña**, y la nota lo dice con todas
sus letras. Ése es el eslabón que permitirá, en la entrega 3, decir cuánto dinero trajo cada
anuncio.

Un registro **no se recoge dos veces**: el buzón se marca después de crear el prospecto, nunca
antes. Si se cortara la luz entre una cosa y la otra, más vale recoger dos veces al mismo que
perderlo.

---

## El tablero

Es la primera pestaña del departamento y contesta tres preguntas en el mismo lugar: cuánta
gente llegó, cuánto costó traerla y qué dejó.

### El embudo

```
Leads → Contactados → En cartera → Cerrados
```

- **Leads** · dejaron sus datos en el periodo.
- **Contactados** · ya tienen al menos una actividad registrada. **A marketing este escalón no
  le aparece**, porque la bitácora de ventas no la alcanza; en vez de enseñarle un cero que
  sería mentira, el tablero omite el escalón y dice por qué.
- **En cartera** · alguien los pasó a cliente.
- **Cerrados** · ese cliente firmó convenio, contrato o evento.

### Por campaña

Un renglón por campaña: inversión, leads, costo por lead, cierres, ingreso y retorno.

Donde una cuenta no se puede hacer, **sale una raya, nunca un cero**. Una campaña con gasto y
sin un solo lead no tiene costo por lead —dividir entre cero no da infinito, da que todavía no
se sabe—, y un cero ahí se leería como «salió gratis».

### De dónde sale el dinero

Marketing no alcanza la cartera, y el retorno necesita saber qué se cerró. La salida es que
**marketing vea números, no renglones**: el servidor suma del lado de allá —es el único que ve
los documentos de todas las áreas— y devuelve por campaña y mes las cuentas y un total. Ni el
nombre del cliente, ni el folio, ni la tarifa, ni el ejecutivo.

Se monta corriendo **`marketing.sql`** una vez en Supabase. **Sin correrlo el tablero sirve
igual**: los leads, la conversión y el costo por lead funcionan desde el primer día, y donde
iría el dinero aparece un aviso que dice qué falta.

El importe **no se calcula en el servidor**. Cada evento y cada contrato guarda su propio total
al momento de guardarlo, con el mismo cálculo que ve el cliente en su carta —IVA, cargo por
servicio, impuestos de hospedaje—, y el servidor nada más suma. Escribir esa cuenta otra vez en
SQL sería tener la misma regla en dos idiomas, y el día que cambie una tasa el tablero se
separaría de la carta sin que nadie se entere.

### Por qué a veces el ingreso sale con una raya

**Un total no es automáticamente anónimo.** Marketing sí ve los prospectos, con nombre y
correo. Si una campaña trajo un prospecto y ése fue el único que cerró, «el ingreso de la
campaña» **es el monto del contrato de esa persona**: el número no dice el nombre, pero lo
señala con el dedo.

Por eso, a quien no alcanza la cartera se le **reserva el monto mientras la campaña tenga menos
de tres cierres**. Las cuentas —leads, conversión, costo por lead— no se ocultan nunca; lo
único que espera es el peso. Dirección, gerencia y administración lo ven siempre, porque de
todos modos pueden abrir el contrato.

El servidor cuenta **por campaña y por mes**, así que puede reservar un mes y no otro: un
agosto recién empezado, con un solo cierre, no borra el dinero de julio. Cuando eso pasa, la
cifra sale con la palabra **parcial** al lado —es de verdad, pero le falta un pedazo—. Sólo
cuando **todos** los meses están reservados el renglón queda en raya.

El umbral es **una sola línea** en `marketing.sql` (`CIERRES_MINIMOS`). Moverlo es una decisión
del hotel, no del programa.

---

## Lo que falta, y en qué orden

| | Qué entra |
|---|---|
| ~~1~~ | ~~Departamento, accesos, Campañas, armador de UTMs~~ ✅ |
| ~~2~~ | ~~Liga pública de registro y atribución de punta a punta~~ ✅ |
| ~~3~~ | ~~Tablero: embudo, costo por lead y retorno~~ ✅ |
| ~~4~~ | ~~Meta Ads: gasto, impresiones y costo por lead, bajados solos~~ ✅ |
| 5 | Lead Ads: el lead de Meta entra al CRM en el momento |
| 6 | Lead Scoring, Biblioteca de Activos y Automatizaciones |

**Las OTAs no se atribuyen igual.** Booking y Expedia no entregan el contacto hasta que hay
reserva, y no pasan por una liga con UTMs. Para esos canales no hay atribución de lead: entran
como campaña con su costo de comisión, para poder compararlas en costo por reserva.
