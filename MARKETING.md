# Marketing

Marketing no vende noches ni eventos: consigue que llegue gente. Lo que mide es otra cosa
—cuánto costó traerla y qué trajo—, así que tiene su propio departamento, sus pestañas y su
gente.

> **Van dos de cinco entregas.** Hoy hay Campañas, el armador de ligas con UTMs y la liga
> pública de registro con su atribución. Faltan el tablero, el lead scoring, la biblioteca de
> activos y las automatizaciones.

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
- **Presupuesto y gasto**: el gasto se captura **mes por mes**, como lo cobra la plataforma. La
  pantalla va sumando y **avisa en rojo cuando se pasa del presupuesto**.
- **Leads**: la columna dice cuántos prospectos trajo. Hoy se llena cuando el prospecto se
  amarra a la campaña; en la entrega 2 lo hará solo la liga pública.

El gasto se captura a mano. Conectarse solo a Meta o a Google necesita permisos de
desarrollador y tiene costo; por ahora no compensa.

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

## Lo que falta, y en qué orden

| | Qué entra |
|---|---|
| ~~1~~ | ~~Departamento, accesos, Campañas, armador de UTMs~~ ✅ |
| ~~2~~ | ~~Liga pública de registro y atribución de punta a punta~~ ✅ |
| 3 | Dashboard con costo por lead, conversión y retorno |
| 4 | Lead Scoring |
| 5 | Biblioteca de Activos y Automatizaciones |

**Las OTAs no se atribuyen igual.** Booking y Expedia no entregan el contacto hasta que hay
reserva, y no pasan por una liga con UTMs. Para esos canales no hay atribución de lead: entran
como campaña con su costo de comisión, para poder compararlas en costo por reserva.
