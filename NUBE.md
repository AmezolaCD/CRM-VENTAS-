# Entrar al CRM desde cualquier equipo

> **La dirección del CRM y los datos del proyecto de Supabase los tiene sistemas**; no se
> escriben aquí porque este repositorio es público. Cada quien entra con su propio correo y
> contraseña.

Hasta ahora el CRM guardaba todo dentro del navegador de cada computadora. Eso
lo hace instantáneo y funciona sin señal, pero cada quien veía su propia copia.
Para que todo el equipo vea la misma cartera hacen falta dos cosas:

1. **Un lugar donde vivan los datos** (una base en la nube, gratuita para este tamaño).
2. **Una dirección de internet donde abrir la aplicación** (para no andar mandando el archivo).

Son unos 20 minutos, una sola vez. Después, entrar es escribir la dirección y el correo.

---

## Parte 1 · La base de datos (Supabase)

Usamos [Supabase](https://supabase.com). Es gratis hasta muy por encima de lo
que este CRM va a mover, y da de un jalón la base de datos y las cuentas de
usuario.

### 1.1 Crear el proyecto

1. Entra a <https://supabase.com> y crea una cuenta (conviene el correo del hotel,
   no el personal de alguien: si esa persona se va, la cuenta se va con ella).
2. **New project**. Ponle un nombre —por ejemplo `quartz-crm`—, elige una
   contraseña para la base y la región más cercana (**West US** o **US East**).
3. Espera un par de minutos a que termine de crearse.

### 1.2 Crear la tabla

1. En el menú de la izquierda entra a **SQL Editor** → **New query**.
2. Abre el archivo `nube.sql` de este repositorio, cópialo **completo** y pégalo.
3. Presiona **Run**. Debe decir *Success*.

Ese archivo crea la tabla, los permisos y una bitácora de quién cambió qué.
Se puede volver a correr las veces que haga falta sin borrar nada.

### 1.3 Copiar los dos datos que pide la aplicación

En **Project Settings** → **API** (o **Data API**) están:

| Lo que dice ahí | Cómo se llama en el CRM |
|---|---|
| **Project URL** — `https://xxxxxxxx.supabase.co` | Dirección del proyecto |
| **anon public** — una cadena larguísima que empieza con `eyJ...` | Llave pública |

Si la copiaste de la pantalla de la API y viene con `/rest/v1/` pegado al final, no
importa: la aplicación lo recorta sola.

> La llave **anon** es pública a propósito: viaja dentro de la página. Por sí
> sola no abre nada, porque la tabla exige haber entrado con una cuenta. La que
> **nunca** se comparte ni se pega en ningún lado es la `service_role`.

### 1.4 Dar de alta al equipo

1. **Authentication** → **Users** → **Add user** → *Create new user*.
2. Correo y contraseña de cada ejecutivo. Marca **Auto Confirm User** para que
   pueda entrar de inmediato sin correo de confirmación.
3. Repite por cada persona. Todos ven y editan lo mismo.

Conviene además apagar el registro libre para que nadie de fuera se dé de alta
solo: **Authentication** → **Sign In / Providers** → Email → apaga
**Allow new users to sign up**.

---

## Parte 2 · La dirección donde abrir el CRM

El archivo `index.html` es la aplicación entera. Sólo hay que dejarlo en un
lugar con dirección propia.

## La dirección de hoy

> El CRM vive en **<https://core-quartz.vercel.app>**. Ésa es la que se reparte al equipo
> y la única que se usa.

### Cómo está montado

El repositorio de GitHub está enlazado a **Vercel**: cada cambio que se empuja a la rama
principal se publica solo, sin tocar nada. El archivo `vercel.json` del repositorio no hace
más que dos cosas — declarar que no hay nada que compilar y pedirle al navegador que revalide
el HTML en cada visita, para que nadie se quede con una copia vieja.

Si el sitio se publicó bien pero sigues viendo lo de antes, es el navegador: recarga con
**Ctrl + F5**. Hasta abajo de Ajustes está el número de versión, para comparar entre equipos.

### Otras opciones

Ninguna hace falta hoy; se anotan por si algún día cambia el hospedaje.

- **Netlify Drop** (<https://app.netlify.com/drop>): se arrastra la carpeta que contiene
  `index.html` y da una dirección al instante. Sirve para una prueba rápida o si Vercel se
  cae, pero hay que volver a arrastrarla en cada cambio, así que no conviene como
  dirección de diario. *(Se usó al principio; ese sitio ya no se ocupa.)*
- **Cloudflare Pages**: igual de gratis, mismo procedimiento que Vercel.
- **GitHub Pages**: también sirve, ahora que el repositorio es público. Es más lento en
  publicar que Vercel, nada más.
- **Sin internet**, dentro del hotel: el archivo puede vivir en una carpeta
  compartida de la red. Funciona, pero cada quien tendría que abrirlo desde ahí
  y no serviría desde el celular ni desde fuera.

### Si algún día cambia la dirección

El navegador guarda la configuración **por dirección**, así que al cambiarla el CRM arranca
en blanco en todos lados: sin los datos de Supabase, sin sesión y con los clientes de
ejemplo. **No se pierde nada** —todo está en la nube—, pero hay que reconectar una vez por
equipo, con los pasos de la Parte 3. Al entrar, avisa que ese equipo *adoptará* los datos de
la nube: es justo lo que se busca.

Y hay una cosa más que se queda atrás: los **enlaces de firma** que ya se le mandaron a
clientes llevan dentro la dirección desde la que se generaron. Si esa dirección se apaga,
esos enlaces dejan de abrir. Los convenios no se pierden —siguen en Supabase—, pero hay que
volver a mandarle el enlace al cliente desde la dirección nueva, o pedirle la firma en papel.

Por eso conviene dejar el nombre definitivo **antes** de repartir la liga al equipo.

### En el celular

Abre la dirección en Chrome o Safari y usa *Agregar a pantalla de inicio*. Queda con su
ícono y su nombre, como cualquier otra aplicación, y abre sin la barra del navegador.

Si a alguien le quedó un ícono raro —un pedazo de la animación de entrada, por ejemplo—, es
que lo instaló antes de que existiera el ícono propio: que lo quite de la pantalla de inicio
y lo vuelva a agregar.

---

## Parte 3 · Conectar la aplicación

1. Abre el CRM en la dirección nueva.
2. Ve a **Ajustes**: **Nube y equipo** es lo primero de la página.
3. Pega la **dirección del proyecto** y la **llave pública**.
4. **Guardar y conectar**.
5. Entra con tu correo y contraseña.

**La primera vez —y sólo la primera—** te va a preguntar qué hacer con lo que ya tenías
capturado. Después de eso, ese equipo ya no vuelve a preguntar nada al abrir: entra derecho.
Las opciones son:

- Si la nube está vacía, te ofrece **subir** los datos de ese equipo. Hazlo
  desde la computadora que tiene la información buena.
- Si la nube ya tiene datos, te avisa que ese equipo va a **adoptar** los de la
  nube y que lo local se reemplaza. Si tenías capturas sin subir, expórtalas
  antes con el botón **Exportar** de la barra de arriba (*Respaldo completo (JSON)*).

### Dar de alta los demás equipos sin dictar nada

Desde un equipo ya conectado: **Ajustes → Nube y equipo → Copiar liga para otro equipo**.

Esa liga ya lleva dentro la dirección y la llave. Se manda por WhatsApp o correo, y quien la
abre queda configurado de una vez: sólo le pide su correo y su contraseña. Es una liga por
equipo nuevo, no algo que haya que repetir cada día.

Dos detalles pensados a propósito:

- La configuración viaja **después del `#`**. Esa parte de una dirección no se manda al
  servidor, así que la llave no queda escrita en los registros de quien hospeda la página.
- Al abrirla, **se borra sola de la barra de direcciones**, antes de que alcance a colarse en
  el historial o en un favorito.

Aun así, quien reciba la liga puede conectarse al servidor, así que se manda **sólo a la gente
del equipo** — igual que la dirección del CRM.

También se puede hacer a mano, repitiendo el paso 3 en cada equipo.

---

## Cómo se comporta ya conectado

- Arriba, junto al nombre, aparece un semáforo: **En línea**, **Sincronizando…**
  o **Sin conexión**.
- Se revisa si hay novedades **cada 15 segundos**, y lo que tú guardas sube al
  momento.
- Mientras tengas **un formulario abierto**, no se baja nada: no queremos que se
  te muevan los datos a media captura.
- Se sincroniza **registro por registro**, no el archivo completo. Dos personas
  pueden capturar al mismo tiempo sin pisarse, mientras no sea el mismo cliente.
- Si dos personas editan **el mismo registro** a la vez, queda el último que
  guardó. Con un equipo de este tamaño es raro; si llega a pasar seguido, se
  puede consultar la bitácora en Supabase (`crm_bitacora`) para ver qué había antes.
- **Sin internet** la aplicación sigue abriendo y dejándote trabajar con lo
  último que bajó; cuando vuelve la señal, sube lo que hiciste.

### Entrar desde Core Quartz

Core Quartz es el portal del hotel: una sola contraseña para el CRM y para el
CDH, y un solo lugar donde dar de alta y de baja al personal. **Esto no
sustituye nada**: el CRM sigue teniendo su pantalla de acceso de siempre y
funciona igual sin el portal.

Cuando alguien abre el CRM desde ahí, el portal manda una dirección con un
**pase de un solo uso** dentro (`#cq=…`). El CRM lo canjea con Supabase y abre
**su propia** sesión, la misma que abriría escribiendo correo y contraseña. No
se comparten contraseñas ni sesiones entre las dos aplicaciones.

Detalles que conviene conocer:

- El pase **sirve una sola vez y dura poco**. Si se abre el mismo enlace dos
  veces, la segunda pide entrar normal: *«El enlace ya se usó; entra desde Core
  Quartz otra vez.»* No es un error, es lo esperado.
- La dirección se limpia sola: ni el pase ni la llave quedan en el historial ni
  en un favorito.
- En una **computadora compartida**, si llega el pase de otra persona mientras
  hay una sesión abierta, primero se sube lo que esa persona tuviera pendiente
  y luego se borra su copia local, igual que con *Cerrar sesión*. Si no se
  puede subir, pregunta antes de borrar nada. Si es **la misma persona**, no se
  toca nada suyo.
- Para que funcione, este equipo tiene que estar ya conectado a la nube. Un
  pase que llega a un equipo sin configurar lo dice en lugar de fallar callado.

Y una condición que no está en la aplicación sino en la lista: **el correo debe
estar dado de alta en Ajustes → Usuarios y permisos**. El portal lo revisa antes
de dejar pasar; si falta, avisa que primero hay que darlo de alta aquí.

### Dar de baja a alguien

**Authentication** → **Users** → los tres puntos → *Delete user*. Deja de poder
entrar; lo que ya había capturado se queda.

Si la persona se administra desde **Core Quartz**, la baja se hace allá: además
de cerrar su paso al portal, bloquea su cuenta de Supabase, así que tampoco
puede entrar al CRM por su cuenta.

### Si algo capturado aquí no aparece en los demás equipos

**Ajustes → Nube y equipo → Volver a subir todo.** Vuelve a mandar los registros de este
equipo sin dar de baja nada de la nube. Sirve cuando algo se capturó mientras el equipo
estaba desconectado —o en otra dirección— y se quedó nada más aquí.

Antes de eso, revisa el semáforo del encabezado: si no dice **En línea**, lo que captures no
está saliendo de esa computadora.

### Si dice "Sin conexión"

Pasa el cursor por el semáforo: dice el error.

| Dice | Es que |
|---|---|
| `401` o `JWT` | La sesión caducó. Vuelve a entrar. |
| `relation "crm_datos" does not exist` | Falta correr `nube.sql`. |
| `permission denied` o `row-level security` | El `nube.sql` se corrió a medias. Vuelve a correrlo completo. |
| `Failed to fetch` | No hay internet, o la dirección del proyecto está mal escrita. |

### Si no te deja entrar

Lo primero, siempre: **Ajustes → Nube y equipo → Probar conexión**. Revisa por separado la
llave, la dirección, el servicio de cuentas y la tabla, y dice cuál de los cuatro falla. Eso
evita andar reescribiendo una contraseña que estaba bien.

El error que más cuesta ver a ojo es **mezclar dos proyectos**: la dirección de uno con la
llave del otro. Ambos datos se ven correctos por separado y nunca van a funcionar juntos; la
prueba lo detecta al instante porque la llave lleva escrito adentro a qué proyecto pertenece.
Por eso conviene copiar los dos datos de la **misma** pantalla.


El mensaje de la pantalla de entrada dice qué hacer en cada caso. Los dos más comunes:

- **«La cuenta existe pero está sin confirmar»** — se creó el usuario sin marcar *Auto Confirm
  User*. En **Authentication → Users**, bórralo y vuelve a crearlo con la casilla marcada.
- **«Correo o contraseña incorrectos»** — si estás seguro de la contraseña, cámbiala:
  **Authentication → Users** → los tres puntos del usuario → **Reset password**. Es más rápido
  que averiguar dónde se coló el error.

Ojo con dos cosas que engañan: el correo **no distingue mayúsculas**, pero la contraseña
**sí**; y si la copiaste y pegaste, revisa que no se haya colado un espacio al final.

---

## El almacén de escaneados

Los documentos que se suben ya firmados —convenios, contratos, cotizaciones de
banquetes— se guardaban **dentro del propio registro**. Eso llega bien a la nube,
pero también se queda en el navegador de cada equipo, y ahí el tope son unos
**5 MB**: con tres escaneados ya no cabe nada más.

La solución es `archivos.sql`, que se corre **una vez** en el SQL Editor igual que
los demás. Crea un depósito privado llamado `escaneados` y sus reglas. A partir de
ahí:

- Los archivos nuevos van al depósito y del registro cuelga nada más la ruta.
- El límite por archivo sube de 2 MB a **20 MB**, y el total a 1 GB en el plan
  gratuito.
- El depósito es **privado**: el escaneado se baja con la sesión de quien pregunta,
  no con una liga suelta que cualquiera pudiera abrir.

Después de correrlo, en el CRM: **Ajustes → Nube y equipo → Mover los escaneados al
almacén**. Ese botón sale sólo si queda alguno por mudar, y dice cuántos son. Sube
uno por uno guardando después de cada uno, así que si se corta, lo que ya subió
quedó bien.

**Sin correrlo el CRM funciona igual**: los escaneados se siguen guardando como
hasta ahora, con su aviso de que ya casi no cabe.

## Si un .sql dice que no encuentra `crm_datos`

Esa tabla la crea **`nube.sql`**, y es la primera de todas. Que falte quiere decir una de
dos cosas, y conviene descartarlas en este orden:

1. **Estás en otro proyecto.** Arriba a la izquierda del tablero de Supabase se cambia de
   proyecto y es fácil acabar en el que no es. Si el CRM está sincronizando datos, la tabla
   existe en algún lado: el que falla es el proyecto, no el archivo.
2. **Nunca se corrió `nube.sql`** en ese proyecto. Córrelo y luego los demás.

`archivos.sql` no la necesita. `folios.sql` sí, pero sólo para ponerse al día con los folios
que ya existan: sin ella se monta igual, arranca en 001 y avisa; al correrlo otra vez después
de `nube.sql` se pone al corriente solo. `roles.sql` no puede trabajar sin ella y lo dice con
todas sus letras en vez de soltar un error de base de datos.

## Un error de "syntax error at end of input"

Casi siempre es un **pegado incompleto**: se copió nada más una parte del archivo y la última
instrucción quedó cortada. Estos archivos llevan bloques largos entre `$$`, y copiar "lo que
se ve en pantalla" deja fuera el resto.

Abre el archivo, **selecciona todo** (Ctrl+A / Cmd+A), cópialo, y en el SQL Editor **selecciona
todo otra vez antes de pegar**, para no dejar pedazos de la corrida anterior.

## Los archivos .sql se corren en el orden que sea

`nube.sql` va primero, porque crea la tabla. Los demás —`roles.sql`, `firmas.sql`,
`archivos.sql`, `folios.sql`— no dependen unos de otros: se corren en cualquier
orden, cuantas veces haga falta, y cada uno se reemplaza entero en vez de
acumularse.

Eso incluye correr `archivos.sql` o `folios.sql` **antes** que `roles.sql`. Los dos
preguntan por el papel de quien entra, pero lo hacen de una manera que no exige que
`roles.sql` ya esté: mientras no lo esté, le abren a cualquiera que haya entrado con
su cuenta, que es como trabajaba el CRM antes de que existieran los papeles.

## La liga del hotel, dentro de la aplicación

Arriba de todo en `index.html` hay dos líneas:

```html
<script>
window.CORE_NUBE = { url:"", anon:"" };
</script>
```

Llenarlas hace que **cualquier equipo que abra la liga caiga directo en la pantalla
de contraseña**, sin configurar nada y sin ver un solo dato. Vacías, cada equipo se
configura con su liga de alta, como hasta ahora.

La llave `anon` está hecha para ser pública —viaja al navegador de cualquiera que
abra la página— y por sí sola no alcanza ni una fila: quien manda es la sesión y
las reglas de `roles.sql`. Aun así, esto se llena **únicamente con el repositorio en
privado**, porque la dirección del proyecto no tiene por qué andar publicada.

Nunca, en ningún caso, la llave `service_role`.

## Lo que queda pendiente

- **Permisos por persona.** Hoy todos pueden todo. Si más adelante se quiere que
  sólo la gerencia edite tarifas o cierre convenios, se hace con una tabla de
  roles y ajustando las políticas de `nube.sql`.
- **Aviso instantáneo.** Hoy se revisa cada 15 segundos. Supabase permite avisar
  al instante (Realtime); se puede cambiar cuando estorbe la espera.
