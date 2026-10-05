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

- Arriba, junto al nombre, aparece un semáforo: **En línea**, **Sincronizando…**,
  **Falta subir N** o **Sin conexión**.
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

### Qué tan rápido llega un cambio

- **Lo que tú guardas sube en menos de un segundo.** Si cambias una tarifa en Ajustes, al
  servidor llega enseguida.
- **Lo que cambian los demás baja cada 15 segundos.**
- **Con un formulario abierto no se aplica nada**, a propósito: si el CRM cambiara los datos
  mientras capturas, lo que tienes en pantalla se quedaría huérfano y al guardar se perdería.
  Pero **sí se pregunta**: si mientras armas un convenio cambia una tarifa pública, sale un
  aviso dentro del editor diciendo qué cambió, con un botón para **actualizar los precios**.
  Ese botón **no borra las tarifas convenio que ya tecleaste**; sólo cambia la pública y el
  descuento.
- **Nada se cambia solo.** Moverle los números a alguien que está negociando es otra manera de
  provocar el error que se quiere evitar. Se avisa y decide la persona.
- **Al cerrar el formulario se sincroniza de inmediato**, sin esperar los 15 segundos.
- **El orden del catálogo de habitaciones también viaja.** Desde octubre el lugar de cada tipo
  se guarda dentro del renglón; antes era nada más la posición dentro de cada computadora, así
  que el nombre y la tarifa llegaban a todos pero el orden no salía nunca del equipo del
  administrador.
- **La ficha de un cliente viaja entera.** Si ventas y banquetes lo editan en los mismos
  segundos, gana el último que llegue —para todo el renglón—. En la práctica no estorba: cada
  área escribe sus propias columnas y la subida sale en menos de un segundo.
- **Las tarifas, los Ajustes y la lista del equipo bajan siempre, sin preguntar.** Esas tres
  cosas las escribe nada más el administrador, así que en el equipo de un ejecutivo no hay nada
  que proteger: lo que diga el servidor es lo bueno y entra tal cual.

> **Si a alguien se le quedó una tarifa vieja**, con la versión de octubre ya no vuelve a pasar,
> y se arregla solo: en cuanto esa persona recargue la página, el catálogo del servidor le entra
> completo. Antes se podía quedar congelado en su equipo —el CRM confundía «lo que tengo aquí es
> distinto» con «lo que tengo aquí lo capturé yo», y como el catálogo nunca lo sube un ejecutivo,
> esa diferencia no se resolvía nunca—. Lo mismo le pasaba al alta de un compañero nuevo.

> **Si guardas sin actualizar**, el convenio se guarda con la tarifa pública **del catálogo**, no
> con la que veías. Es legítimo —el precio pudo pactarse antes— pero queda una línea en la
> bitácora del cliente diciendo qué decía la pantalla y qué se guardó, para que nadie lo
> descubra leyendo el PDF.

### Cuando se borra algo

Un borrado **no viaja como «bórralo»**: viaja como una **lápida**, un renglón marcado como
muerto. Si la fila desapareciera sin más, los demás equipos nunca se enterarían de que ya no
existe — y en la siguiente bajada te la devolverían.

El CRM apunta lo que borras **en este navegador**, y lo tacha de la lista sólo cuando el
servidor confirma que recibió la lápida. Por eso:

- Si borras sin señal, el borrado **no se pierde**: se sube cuando vuelva.
- Si el servidor **rechaza** la lápida —porque ese registro no es tuyo—, sale en el semáforo
  como *«Falta subir»*, con su nombre y su motivo. Lo demás sí se borra.
- **Borrar un cliente se lleva lo que cuelga de él** —actividades, convenios, contratos y
  eventos—, y cada uno viaja con su propia lápida. La confirmación te dice cuántos son antes de
  que le piques.

> **Vaciar la pantalla no es borrar.** Cerrar sesión, o enlazar el equipo a la nube por primera
> vez, reemplazan lo que hay en pantalla de golpe. Eso **no** manda ninguna lápida. Es a
> propósito: sin ese candado, cerrar sesión borraría la cartera de todo el hotel.

### Los folios: se asignan al firmar, no al abrir el borrador

**Un borrador no tiene folio.** Se captura, se guarda, se corrige y se vuelve a guardar sin
número. El folio aparece **en el momento en que el ejecutivo firma**, y sale de un contador que
lleva el servidor para todo el hotel.

Esto vale igual para los tres: **convenios** (CV), **contratos de hospedaje** (CT) y **eventos de
banquetes** (EV y CB). Cada serie lleva su propia cuenta y no se estorban.

Por qué así, que es lo que arregla los dos problemas que salieron:

- **No se repiten.** El contador reparte de uno en uno con un candado: dos personas firmando al
  mismo segundo reciben números distintos. Antes cada computadora calculaba el suyo contando lo
  que alcanzaba a ver, y con los papeles puestos un ejecutivo **no ve** los convenios de los
  demás. Por eso Carmen y Eduardo firmaron los dos el CV-2026-018.
- **No hay huecos.** Antes, cada borrador que se guardaba ya gastaba un número, así que el que se
  abandonaba dejaba un hueco para siempre. Ahora un número sólo se gasta cuando hay un documento
  firmado de verdad.
- **Nadie teclea nada.** El campo del folio no se escribe. Se escribe sólo en *«Subir uno
  firmado»*, que es el documento que llegó en papel con su propio número — y ése se le avisa al
  contador para que no lo vuelva a repartir. Si esa aviso no queda registrado, el CRM lo dice
  antes de registrarlo, porque entonces el contador podría repartir ese número otra vez.
- **Un documento de papel sin folio también pide su número al contador.** Antes lo inventaba
  contando lo que ese equipo alcanzaba a ver, y ahí estuvo el segundo choque: cuatro convenios
  subidos como *externos* se llevaron números que ya estaban usados.

**Si el contador no contesta, no se firma.** Sale un aviso diciendo que falta correr
`folios.sql`. Es a propósito: más vale no firmar que firmar con un número que se puede repetir.
Y como no se apartó nada, tampoco se gastó: al volver el contador, el siguiente que firme se
lleva el que tocaba.

> **Un equipo suelto —«Sólo este equipo»— sí puede firmar.** Ahí no hay con quién chocar: esa
> computadora es la única que reparte, y cuenta sola. La regla estricta es para cuando hay
> servidor y no contesta.

**En Ajustes** sale un renglón que dice si el contador está montado y cuál fue el último folio
del hotel. Es para poder comprobarlo en vez de suponerlo.

**Si dos quedaron repetidos de antes**, el convenio marcado *repetido* trae un botón **«Darle un
folio nuevo»**: pide el siguiente al contador, lo cambia y lo anota en la bitácora. Avisa que el
PDF que ya tiene el cliente dice el folio anterior y hay que reenviárselo.

### Cuando el semáforo dice «Falta subir»

No es falta de internet: es que **el servidor no aceptó uno o varios registros**
y el resto sí subió. Casi siempre es un registro que allá está **a nombre de
otra persona** —un convenio de otro ejecutivo que quedó bajado en tu equipo—.
Las reglas de `roles.sql` no dejan que lo reescriba quien no es su dueño, y eso
está bien.

**Pícale al semáforo** y sale la lista: cada registro por su folio o su nombre,
de quién es, y qué hacer. Nada se pierde: lo rechazado sigue guardado en tu
equipo y se vuelve a intentar solo en cada sincronización, así que el día que te
lo reasignen entra sin que hagas nada.

> **Por qué importa.** Antes esto tumbaba la subida **entera**: un solo registro
> ajeno bastaba para que ese equipo dejara de subir todo lo demás —y de recibir
> los cambios de los demás— sin decir nada más que «Sin conexión». Fue lo que
> pasó con el convenio CV-2026-011. Ahora lo bueno sube, lo rechazado se nombra,
> y el semáforo dice la verdad.

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

Y si lo que sospechas es que ese equipo trae una versión vieja del CRM, **pícale al logo CORE**
de arriba a la izquierda: te lleva al tablero y **recarga la página**, que es lo que trae la
versión recién publicada y vuelve a bajar todo de la nube. Es el atajo para no tener que
explicarle a nadie lo del Ctrl+Shift+R. Lo capturado no se pierde —se guarda conforme se
escribe—; si hay un formulario abierto a medio llenar, pregunta antes.

### El renglón que tumbaba la subida entera

Vale la pena saber por qué esto pasaba, porque el síntoma no se parecía a la causa.

Todo lo que cambia en un equipo sube **en un solo envío**. Eso es lo normal y lo rápido, pero
tiene un filo: si el servidor rechaza **un** renglón, rechaza el envío **completo**. No la mitad
—todo—.

Y hay tres cosas que `roles.sql` deja escribir sólo al administrador: los **ajustes**, el
**catálogo de habitaciones** y la **lista de usuarios**. Como la firma guardada de cada quien
vivía dentro de su ficha de usuario, bastaba con que un ejecutivo palomeara *guardar mi firma*
una vez para que, a partir de ese momento, **ya no le subiera nada**: ni el contrato que acababa
de firmar, ni un cliente nuevo, ni una actividad. En su pantalla todo se veía normal; el resto
del equipo simplemente dejaba de recibirle.

Ya no pasa: el CRM **no manda lo que sabe que le van a rebotar**, así que un renglón que no le
toca no se lleva por delante a los demás. Y cuando algo de eso hace falta de verdad —la clave de
la liga de registro, por ejemplo— la pantalla lo dice y le pide al administrador que lo publique
él, en vez de dejarlo a medias en silencio.

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

## El CRM le trae el .sql, para que no haya dónde cortarse

En *Ajustes → Nube y equipo → Probar conexión*, cada renglón que diga que falta algo trae su
botón —**Arreglar esto** para las firmas, **Montarlo ahora** para el contador de folios—. Abre un
panel con tres pasos y dos maneras de llevarse el SQL:

- **Copiar el SQL**: el CRM pide el archivo a su propio servidor y lo deja en el portapapeles,
  sin comentarios. **No pasa por ninguna vista previa, así que el largo deja de importar.**
- **Descargar el archivo**: se abre con el Bloc de notas, Ctrl+A, Ctrl+C. Un archivo en disco
  no lo recorta nada.

Y al final, **Ya lo corrí · Verificar**, que le pregunta al servidor y contesta en el momento.

### Los .sql que crean tablas van en DOS pegados

Éste es el que costó tres intentos. El editor de Supabase, al ver que se **crea una tabla
nueva**, le agrega SQL suyo —un `alter table … enable row level security`— al final de lo que
recibió. Para saber dónde ponerlo parte el texto en instrucciones **cortando en cada `;` sin
respetar los `$$`**. Si en el mismo pegado hay funciones, los cortes y el agregado caen **dentro
del cuerpo de una** y la parten por la mitad. De ahí:

- *«unterminated dollar-quoted string»*, y
- errores sobre renglones sueltos como `return v_folio;`, que es el **interior** de una función.

Se nota en qué archivo pega y en cuál no: `firmas.sql` entró a la primera porque `crm_firmas` ya
existía —sin tabla nueva no hay nada que agregar— y `folios.sql` reventó tres veces porque
`crm_folios` no.

**La salida es separarlos**, y el CRM ya lo hace solo: el botón **Copiar el SQL** entrega
**primero las tablas** —donde el agregado es inofensivo, de hecho es justo lo que queremos— y
después **todo lo demás**, que ya no trae ninguna tabla nueva y por lo tanto no dispara nada.
Cada pegado avisa con su propio **LISTO**, y el botón va diciendo cuál toca.

Cada `.sql` trae sus tablas marcadas con `-- @tabla` para que el corte sea mecánico. **El archivo
sigue valiendo entero**: en una consola de verdad se corre de un jalón, como siempre. La
separación es sólo para el editor de Supabase.

### Y una cosa que hace el editor de Supabase

Cuando detecta que se crea una tabla nueva, **le agrega al final** un
`ALTER TABLE … ENABLE ROW LEVEL SECURITY`. Si lo que recibió venía cortado, ese renglón cae
dentro del cuerpo de una función, parte el `$$` y revienta con *«unterminated dollar-quoted
string»* — o con un error raro sobre una línea que es el interior de una función. **Las dos cosas
significan lo mismo: el pegado llegó incompleto.** Con el pegado entero, ese renglón cae al final
y es inofensivo.

## El pegado se corta a los 100 renglones

Pasó **dos veces**, con dos archivos distintos, y las dos a los **100 renglones exactos**: el de
las ODTs y el de las firmas. No es descuido de quien pega: algo en el camino —la vista previa
desde la que se copia— recorta a 100 renglones, y el editor de Supabase acepta el pedazo sin
chistar y contesta **«Success. No rows returned»**, que parece un éxito.

Por eso ahora:

- **Cada `.sql` termina con un renglón que lo dice.** Al correrlo tiene que aparecer abajo un
  resultado que diga **LISTO**, con el nombre del archivo. Si dice *«Success. No rows
  returned»*, **se cortó y no se aplicó nada** — vuelva a pegarlo.
- **El botón «Copiar el SQL» del CRM manda el mismo SQL sin comentarios**: 90 renglones en vez
  de 260, para que quepa entero aunque algo lo vuelva a cortar ahí. Es el mismo SQL, probado
  contra PostgreSQL igual que el archivo largo.
- **Y hay un botón para descargarlo**, por si el portapapeles también recorta: el archivo en
  disco no lo puede cortar nada. Se abre con el Bloc de notas, Ctrl+A, Ctrl+C.

## Si se repite un folio

El número lo reparte el **contador del servidor** (`folios.sql`), que entrega `max + 1` sobre su
propia tabla. Por eso, al montarlo, el archivo la **rellena con los folios que ya existen en la
cartera**: sin ese relleno arrancaría en 001 y repetiría el año entero.

Si el contador **no** está montado, cada equipo cuenta con lo que tiene bajado, y dos que no ven
lo mismo toman el mismo número. Se revisa en *Ajustes → Nube y equipo → Probar conexión*, y se
arregla corriendo `folios.sql` completo —al final tiene que salir el renglón de **LISTO**—.

Cuando aun así se cuela uno repetido, **la lista lo enseña**: arriba sale un aviso con cuáles
son y un botón **«Darles un folio nuevo»**, que le pide números al contador. El más antiguo de
cada folio conserva el suyo —su número lleva más tiempo circulando— y al otro se le da uno
nuevo, con nota en la bitácora del cliente. Hay que reenviarle el PDF: el que tiene dice el
folio anterior. Esto vale para **convenios y para contratos**; antes existía sólo en convenios,
y por eso en contratos los repetidos estuvieron ahí sin que nadie los viera.

Los eventos de banquetes llevan **dos series en la misma colección** —EV para la cotización y CB
para el contrato—, y el relleno del contador las guardaba a las dos como `eventos`. Resultado:
esas dos series arrancaban en 001 aunque ya hubiera folios, y se pisaban entre ellas. Ya quedó
corregido en `folios.sql`; para aplicarlo hay que volver a correrlo.

## Un borrado le llega a todos, y no vuelve

Un borrado no viaja como «bórralo»: viaja como una **lápida**, un renglón que se queda en el
servidor marcado `borrado`. Si la fila desapareciera sin más, los demás equipos no tendrían cómo
enterarse.

Al bajarla, el CRM la trataba como un conflicto más —*«si aquí hay una edición sin subir, no la
pises»*— y eso la mataba, porque esa supuesta edición sin subir casi nunca existía: la lista de
lo ya sincronizado vive en memoria y **arranca vacía en cada recarga**, así que todo lo que ya
estaba parecía recién editado. Pasaban las dos cosas a la vez:

- la lápida **se saltaba siempre**, así que el borrado no le llegaba a nadie;
- y el renglón, al verse como edición pendiente, **se volvía a subir sin la marca de borrado** —
  lo que resucitaba al cliente en el servidor y se lo devolvía hasta a quien lo había borrado.

Ahora una lápida se atiende **antes** que cualquier protección de conflicto: no es un conflicto,
es una instrucción. Si de verdad hubiera una edición local sin subir sobre algo que otro borró,
**gana el borrado** — es lo deliberado de los dos, y nada se pierde: el renglón sigue en el
servidor marcado como borrado y la bitácora guarda lo que decía.

Lo comprueba `pruebas/navegador/borrar-se-propaga.mjs` con dos equipos de verdad.

## Los .sql se pegan COMPLETOS, y ahora el archivo se defiende

Cada archivo `.sql` va entero en **una sola transacción**. Si el pegado se corta a la mitad
—pasa, y ya pasó aquí— la base de datos se queda **exactamente como estaba**, en vez de a medio
camino. Antes no era así, y tuvo consecuencias: un archivo cortado dejó tirada la regla que
permite a un cliente depositar su firma y nunca la volvió a crear. El resultado fue que un
cliente leyó su convenio, lo firmó con el dedo, y al mandarlo le salió un error de base de datos
en la pantalla.

**Cómo saber que se aplicó:** al final de la ejecución tiene que aparecer **COMMIT**. Si no
aparece, no se aplicó nada: copie el archivo completo (Ctrl+A dentro del archivo, sin dejar
texto seleccionado) y vuelva a correrlo.

### Si los clientes no pueden firmar

En **Ajustes → Nube y equipo → Probar conexión**, el renglón del **buzón de firmas** ahora dice
la verdad. Antes se asomaba a la tabla con una consulta de lectura, y eso mentía: el buzón no
tiene lectura para nadie de fuera a propósito, así que una tabla con las reglas tiradas contesta
igual que una sana. Decía *«los clientes pueden firmar desde su enlace»* justo cuando no podían.

**Y ya no hace falta acordarse de mirarlo.** Antes de ponerle a un ejecutivo un enlace de
firma en la mano, el CRM le pregunta al servidor si el buzón está montado. Si no lo está, **el
enlace no se ofrece**: en su lugar sale un aviso que dice que el cliente leería el documento, lo
firmaría y su firma no se podría registrar, y que hay que correr `firmas.sql` completo. Se le
sigue ofreciendo el PDF, que sí funciona. Lo mismo con los contratos y con el enlace del
director en las órdenes de trabajo.

Se pregunta una vez por sesión, y si se cae la red **no estorba**: un ejecutivo sin señal no se
queda sin poder mandar su enlace.

Ese renglón es ahora **la única forma de enterarse a tiempo**, y por eso conviene mirarlo. Al
cliente ya no se le enseña letra de técnico: si el servidor le rechaza la firma, ve que no es
culpa suya y que al hotel le falta habilitarlas, y nada más. No se le pide que avise a nadie
—cargarle un recado al cliente por una falla del hotel no es su trabajo—, así que el hotel **no
se entera por él**.

### Arreglarlo sin salir del CRM

Donde quiera que salga el aviso —en *Probar conexión* o al mandarle un convenio al cliente— hay
un botón **Arreglar esto**. Abre un panel con tres pasos y dos botones:

- **Copiar el archivo.** Trae `firmas.sql` del propio servidor del CRM —se publica junto al
  `index.html`, así que siempre es la versión que corresponde— y lo deja en el portapapeles
  **completo**. Ya no hay que encontrar el archivo, abrirlo ni seleccionarlo: por ahí fue por
  donde se rompió la vez pasada.
- **Ya lo corrí · Verificar.** Vuelve a preguntarle al servidor y contesta en el momento.

Y el aviso **ya no se queda pegado**: la respuesta negativa no se guarda, así que en cuanto el
archivo esté corrido el enlace de firma reaparece solo, sin recargar la página.

Si después de correrlo con **COMMIT** a la vista el panel sigue diciendo que no, entonces no es
el pegado y hay otra vía: una función `firma` en *Edge Functions*, como `wa-hook`, que guarda la
firma con permisos de servidor sin depender de ninguna regla.

Si dice **LOS CLIENTES NO PUEDEN FIRMAR**, vuelva a correr `firmas.sql` completo. Para
confirmarlo a mano, en el SQL Editor:

```sql
select polname from pg_policy where polrelid = 'public.crm_firmas'::regclass;
```

Tiene que aparecer `cliente deja su firma`.

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

## La liga pública de registro

`prospectos.sql` monta el buzón donde cae quien llena la liga de un anuncio. Se corre una vez,
después de `nube.sql`, y se puede repetir.

Lo importante de cómo está hecho: **el visitante no lee nada**. No tiene permiso de leer
ninguna tabla —ni la cartera, ni el buzón, ni siquiera lo que él mismo acaba de escribir—, y lo
único que puede hacer es depositar con la clave buena. El equipo recoge del buzón, y quien no
está en *Ajustes → Usuarios y permisos* tampoco lo alcanza.

Sin correrlo, el CRM funciona igual: el formulario de adentro sigue trabajando y las ligas con
UTMs se pueden armar apuntando a la página del hotel. Lo único que falta es el registro desde
fuera, y el propio CRM lo avisa donde se nota.

## El teléfono de los clientes americanos

Tijuana está pegada a San Diego, y buena parte de la cartera del hotel es de Estados Unidos. Un
número de **diez dígitos se ve igual en los dos países** —664 de Tijuana, 619 de San Diego—,
así que el CRM no puede adivinar de dónde es.

Por eso cada cliente trae **su propio país**, en la ficha, junto al teléfono. Por omisión es el
del hotel (*Ajustes → Lada por omisión*), y se cambia una vez por cliente.

Tres cosas que conviene saber:

- Un teléfono capturado **con su `+` adelante** —`+1 619 555 1234`— manda siempre, sin
  importar lo que diga la ficha.
- **`1` más diez dígitos es ambiguo**: es a la vez el formato viejo de los celulares mexicanos
  (`+52 1 664…`) y el de Estados Unidos (`+1 619…`). Con el país del cliente en *México* se
  toma como el formato viejo y se corrige; con cualquier otro, se deja tal cual.
- Los **huéspedes** de las confirmaciones vienen de un `.xlsx` y no tienen ficha: ahí manda el
  `+` y, si no lo traen, la lada por omisión.

## El ingreso por campaña

`marketing.sql` monta la cuenta que le dice al tablero de marketing cuánto dejó cada campaña.
Se corre una vez, después de `nube.sql`, y se puede repetir.

Hace falta porque **marketing no alcanza la cartera** y el retorno necesita saber qué se
cerró. La salida es que sume el servidor —el único que ve los documentos de todas las áreas—
y devuelva **cuentas, no renglones**: por campaña y mes, cuántos clientes, cuántos cierres y
un total. Ni el nombre del cliente, ni el folio, ni la tarifa.

A quien no alcanza la cartera se le **reserva el monto mientras la campaña tenga menos de tres
cierres**, porque con uno solo la cifra deja de ser un total y pasa a decir cuánto pagó una
persona en concreto. Dirección, gerencia y administración lo ven siempre.

**Sin correrlo el tablero sirve igual**: los leads, la conversión y el costo por lead salen
desde el primer día, y donde iría el dinero aparece un aviso que dice qué falta.

## Las cifras de los anuncios

`meta.sql` monta las tres tablas donde caen el gasto, las impresiones y los clics que baja el
CRM de Meta. Se corre una vez y se puede repetir.

Lo importante de cómo está hecho: **nadie las escribe desde el navegador**. No hay una sola
regla de escritura, a propósito. La única que escribe es la función `meta-sync`, que corre del
lado del servidor con la llave de servicio. Si alguien pudiera escribirlas desde el CRM,
también podría inventarse el gasto de una campaña —y el retorno con él—.

Las leen marketing, dirección y administración. Un ejecutivo de ventas no recibe ni un
renglón.

Sin correrlo, el CRM funciona igual y el gasto se captura a mano, como hasta hoy. El paso a
paso completo —incluido cómo sacar el acceso de Meta— está en **META.md**.

## Los mensajes de WhatsApp de los anuncios

`whatsapp.sql` monta el buzón donde cae cada mensaje que entra por un anuncio de
clic-a-WhatsApp. Se corre una vez y se puede repetir.

Está hecho igual que `meta.sql`, y por la misma razón: **nadie lo escribe desde el navegador**.
No hay una sola regla de escritura. La única que escribe es la función `wa-hook`, con la llave
de servicio. Si alguien pudiera escribirlo desde el CRM, podría inventarse leads —y un CRM con
leads inventados es peor que uno vacío, porque se les asigna gente y se reporta que la campaña
funcionó—.

`mensaje_id` es único, y eso tampoco es de adorno: Meta y el proveedor reintentan cuando no
reciben respuesta a tiempo, y sin eso un reintento levantaría un segundo lead de la misma
persona.

Sin correrlo, los mensajes de los anuncios se siguen capturando a mano con el botón de la
pestaña Leads, y el CRM lo avisa ahí mismo. El paso a paso —incluido lo que hay que hacer en
el proveedor— está en **[WHATSAPP.md](WHATSAPP.md)**.

## Las órdenes de trabajo de marketing

`odts.sql` monta el buzón donde cae cada solicitud que un jefe de área le manda a marketing, y
el almacén donde viven sus archivos. Se corre una vez y se puede repetir.

El visitante —el jefe que pide— tiene **un solo permiso en todo el servidor**: dejar su
solicitud. No lee nada, ni siquiera lo que él mismo acaba de mandar. Por eso los archivos de
referencia viajan **dentro** del renglón y es el CRM quien los pasa al almacén al recogerlos:
darle permiso de escribir en el almacén para ahorrarse ese paso sería abrirle una puerta.

La clave de esa liga es **propia**, no la de la liga del lobby. Ésa va pegada en los anuncios de
Facebook y la ve cualquiera; no tiene por qué servir para levantar órdenes de trabajo.

Hay que **volver a correr `firmas.sql`** para que el enlace de firma acepte este tercer tipo de
documento —sin eso el director no puede firmar— y **`roles.sql`**, o ventas y banquetes
recibirían las órdenes de marketing.

Sin correrlo, el CRM funciona igual: las órdenes se capturan a mano con el botón de la pestaña
ODTS, y la pantalla lo dice. El paso a paso está en **[ODTS.md](ODTS.md)**.

## Los archivos .sql se corren en el orden que sea

`nube.sql` va primero, porque crea la tabla. Los demás —`roles.sql`, `firmas.sql`,
`archivos.sql`, `folios.sql`, `prospectos.sql`, `marketing.sql`, `meta.sql`, `whatsapp.sql`,
`odts.sql`— no
dependen unos de otros: se corren en cualquier orden, cuantas veces haga falta, y cada uno se reemplaza
entero en vez de acumularse.

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
