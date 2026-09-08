# Entrar al CRM desde cualquier equipo

> **La dirección del CRM es <https://corequartz.netlify.app>.**
> Los datos viven en el proyecto de Supabase `coorawopepdwswblantb`.
> Cada quien entra con su propio correo y contraseña.

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

### Opción recomendada · Netlify Drop (dos minutos, gratis)

1. Entra a <https://app.netlify.com/drop>.
2. Arrastra la **carpeta** que contiene `index.html`.
3. Te da una dirección tipo `https://algo-al-azar.netlify.app`. En
   *Site configuration → Change site name* puedes dejarla como
   `quartz-crm.netlify.app`.
4. Esa dirección se comparte con el equipo y se guarda en favoritos.

Para actualizar el CRM más adelante: vuelves a arrastrar la carpeta al mismo sitio.
Si Netlify dice *"All files already uploaded by a previous deploy"*, no recibió nada nuevo:
arrastraste la misma carpeta de antes. Y si el sitio se publicó bien pero sigues viendo lo
viejo, es el navegador: recarga con **Ctrl + F5**. Hasta abajo de Ajustes está el número de
versión, para comparar entre equipos.

### Otras opciones

- **Cloudflare Pages** o **Vercel**: igual de gratis, mismo procedimiento.
- **GitHub Pages**: sirve, pero **este repositorio es privado** y GitHub Pages
  sobre repositorios privados requiere plan de paga. Con el repositorio público
  no hay problema — sólo que entonces cualquiera puede leer el código (los datos
  siguen protegidos, están en Supabase).
- **Sin internet**, dentro del hotel: el archivo puede vivir en una carpeta
  compartida de la red. Funciona, pero cada quien tendría que abrirlo desde ahí
  y no serviría desde el celular ni desde fuera.

### Si algún día cambia la dirección

El navegador guarda la configuración **por dirección**, así que al cambiarla el CRM arranca
en blanco en todos lados: sin los datos de Supabase, sin sesión y con los clientes de
ejemplo. **No se pierde nada** —todo está en la nube—, pero hay que reconectar una vez por
equipo, con los pasos de la Parte 3. Al entrar, avisa que ese equipo *adoptará* los datos de
la nube: es justo lo que se busca.

Por eso conviene dejar el nombre definitivo **antes** de repartir la liga al equipo.

### En el celular

Abre la dirección en Chrome o Safari y usa *Agregar a pantalla de inicio*.
Queda con su ícono, como cualquier otra aplicación.

---

## Parte 3 · Conectar la aplicación

1. Abre el CRM en la dirección nueva.
2. Ve a **Ajustes**: **Nube y equipo** es lo primero de la página.
3. Pega la **dirección del proyecto** y la **llave pública**.
4. **Guardar y conectar**.
5. Entra con tu correo y contraseña.

**La primera vez** te va a preguntar qué hacer con lo que ya tenías capturado:

- Si la nube está vacía, te ofrece **subir** los datos de ese equipo. Hazlo
  desde la computadora que tiene la información buena.
- Si la nube ya tiene datos, te avisa que ese equipo va a **adoptar** los de la
  nube y que lo local se reemplaza. Si tenías capturas sin subir, expórtalas
  antes con el botón **Exportar** de la barra de arriba (*Respaldo completo (JSON)*).

En las demás computadoras se repite el paso 3, se entra, y adoptan lo que ya
está en la nube. Los dos datos de conexión se pegan **una vez por equipo**.

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

### Dar de baja a alguien

**Authentication** → **Users** → los tres puntos → *Delete user*. Deja de poder
entrar; lo que ya había capturado se queda.

### Si dice "Sin conexión"

Pasa el cursor por el semáforo: dice el error.

| Dice | Es que |
|---|---|
| `401` o `JWT` | La sesión caducó. Vuelve a entrar. |
| `relation "crm_datos" does not exist` | Falta correr `nube.sql`. |
| `permission denied` o `row-level security` | El `nube.sql` se corrió a medias. Vuelve a correrlo completo. |
| `Failed to fetch` | No hay internet, o la dirección del proyecto está mal escrita. |

### Si no te deja entrar

El mensaje de la pantalla de entrada dice qué hacer en cada caso. Los dos más comunes:

- **«La cuenta existe pero está sin confirmar»** — se creó el usuario sin marcar *Auto Confirm
  User*. En **Authentication → Users**, bórralo y vuelve a crearlo con la casilla marcada.
- **«Correo o contraseña incorrectos»** — si estás seguro de la contraseña, cámbiala:
  **Authentication → Users** → los tres puntos del usuario → **Reset password**. Es más rápido
  que averiguar dónde se coló el error.

Ojo con dos cosas que engañan: el correo **no distingue mayúsculas**, pero la contraseña
**sí**; y si la copiaste y pegaste, revisa que no se haya colado un espacio al final.

---

## Lo que queda pendiente

- **Permisos por persona.** Hoy todos pueden todo. Si más adelante se quiere que
  sólo la gerencia edite tarifas o cierre convenios, se hace con una tabla de
  roles y ajustando las políticas de `nube.sql`.
- **Aviso instantáneo.** Hoy se revisa cada 15 segundos. Supabase permite avisar
  al instante (Realtime); se puede cambiar cuando estorbe la espera.
