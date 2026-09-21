# Quién ve qué

El CRM tiene nueve papeles:

| Papel | Pestañas que ve | Qué alcanza |
|---|---|---|
| **Administrador** | Todas, Ajustes incluido | Todo. Escoge departamento al entrar |
| **Dirección** | Todas menos Ajustes | Todo el hotel, de todo el equipo. Escoge departamento al entrar |
| **Gerencia de ventas** | Las de hospedaje, menos Ajustes | La cartera, los convenios, la actividad y los prospectos de todo el equipo |
| **Ejecutivo de ventas** | Las de hospedaje, menos Ajustes | Sólo sus propios clientes, convenios, actividades y prospectos |
| **Gerencia de banquetes** | Tablero, Clientes, Actividades, Eventos, Contratos banquetes, Calendario, Reportes y Formulario | Los eventos y contratos de **todo el equipo de banquetes**; la cartera la comparte con ventas |
| **Ejecutivo de banquetes** | Las mismas que su gerencia | Sólo sus propios eventos y contratos de banquetes |
| **Coordinación de marketing** | Tablero de marketing, Campañas, Atribución & UTMs y Formulario | Las campañas del área y los prospectos de todos. **No alcanza la cartera** |
| **Marketing** | Las mismas que su coordinación | Lo mismo: las campañas son del área, no de una persona |
| **Sólo prospección** | Únicamente *Formulario* | Sólo los prospectos que esa cuenta capturó |

Un ejecutivo ve además **las actividades que él mismo registró**, aunque sean de un cliente de
otro: a veces se cubre a un compañero y esa llamada es suya de todos modos.

## La pantalla de departamento

Quien alcanza **más de un departamento** —hoy la dirección y la administración— escoge en cuál
entra, en una pantalla que sale al abrir el CRM. A partir de ahí la aplicación se comporta como
si fuera de ese departamento: las pestañas, el tablero, el calendario y los reportes. El botón
con el nombre del departamento, arriba a la derecha, cambia de uno a otro **sin volver a
entrar**.

Al resto del equipo no se le pregunta: su departamento es el único que tiene y el CRM abre
directo. Sin nube tampoco, porque sin sesión no hay papeles que separar.

El departamento **acota la pantalla, no el permiso**. La dirección alcanza los dos de todos
modos; escoger uno es para no trabajar entre pestañas que en ese momento no le tocan —y de
paso, los reportes salen del departamento en el que esté, en vez de mezclar los dos—.

### Agregar un departamento más adelante

Está previsto. En `index.html` hay una lista llamada `DEPARTAMENTOS` con un renglón por
departamento —su nombre, una línea de descripción y qué pestañas le tocan— y otra llamada
`DEPTOS_ROL` que dice qué papeles lo alcanzan. Un departamento nuevo son esos dos renglones: la
pantalla de escoger, el botón del encabezado y el filtrado salen solos.

## Ventas y banquetes no se ven los papeles

Son dos negocios distintos y cada uno ve el suyo:

- Banquetes **no ve** convenios, contratos de hospedaje ni confirmaciones. Y no sólo la
  pestaña: tampoco en el tablero, ni en la ficha del cliente, ni en los avisos, ni en lo que se
  le cuenta a la IA. No renta habitaciones, así que el hospedaje no le sale por ningún lado.
- Ventas **no ve** las pestañas *Eventos* ni *Contratos banquetes* —tampoco la gerencia de
  ventas—, ni los eventos en el calendario, ni el dinero de banquetes en los reportes.
- **Marketing no ve la cartera en absoluto**: ni clientes, ni convenios, ni contratos, ni
  eventos. Lo suyo son sus campañas y los prospectos. Y las campañas no le bajan a nadie más.
  El detalle está en `MARKETING.md`.

  Lo único que cruza esa pared es **una suma**. Con `marketing.sql` corrido, el tablero de
  marketing pide al servidor cuánto dejó cada campaña y recibe cuentas —cuántos clientes,
  cuántos cierres y un total por mes—, nunca los documentos. Y mientras una campaña tenga
  menos de tres cierres, ni siquiera el total: con uno solo, la cifra señalaría con el dedo al
  cliente de ese contrato. Ningún renglón de la cartera baja a esas computadoras.

Lo único que comparten es **la cartera de clientes, la bitácora y los prospectos**: una empresa
que hace su convención en el hotel y además renta salón para la cena es un solo cliente, no
dos fichas. Quién entra a banquetes y cómo se dan de alta esas cuentas está en `BANQUETES.md`.

**Sólo prospección** es el papel de la tableta del lobby: levanta contactos en eventos y nada
más. No ve el tablero, ni la cartera, ni los convenios, y tampoco le aparecen los botones de
*Importar* y *Exportar*, que mueven la cartera entera.

Los **huéspedes** de las cartas de confirmación los ve todo el equipo. No son de nadie en
particular: son trabajo de recepción, no cartera de ventas.

---

## Lo que amarra a una persona con su cartera es el nombre

No el correo. Lo que decide de quién es un cliente es el campo **Ejecutivo** de ese cliente, y
eso se compara contra el **nombre** que tiene el usuario dado de alta.

Si en *Usuarios y permisos* dice `Carmen Sotelo` y en los clientes dice `C. Sotelo`, esa
ejecutiva **no verá su propia cartera**. Es el error más fácil de cometer y el más difícil de
ver, porque todo lo demás parece bien.

Para que no vuelva a pasar, el ejecutivo de un cliente **ya no se escribe**: se escoge de una
lista, y esa lista es exactamente la tabla de *Usuarios y permisos*. Lo mismo el responsable de
una actividad y los filtros del tablero y de Actividades.

### Nombres que no son de nadie

Un nombre suelto todavía puede entrar por una **importación de CSV o de Excel**, donde la
columna *Ejecutivo* es texto libre. Cuando eso pasa, ese cliente no aparece en la pantalla de
ningún ejecutivo.

El CRM los junta y los enseña en **Ajustes → Nombres que no son de nadie**: cada nombre suelto,
cuántos clientes y cuántas actividades arrastra, y un botón para pasárselos de un jalón a
alguien del equipo (o dejarlos sin asignar a propósito). En los filtros esos nombres siguen
apareciendo, pero apartados bajo *Sin dar de alta*, para que se noten en vez de esconderse.

## El contrato y el convenio son cosas distintas

El **convenio** fija las tarifas de empresa de todo el año. El **contrato** —pestaña
*Contratos*— cotiza una estancia concreta: estas fechas, estas habitaciones, este salón. Los
dos se firman y los dos se reparten igual: cada uno guarda su propio ejecutivo, se le muestra a
quien lo trae asignado y al dueño del cliente, y gerencia y administración los ven todos.

## El folio no se repite

Al crear un convenio, el folio sale ya puesto con **el siguiente del año**: después del
CV-2026-015 propone el CV-2026-016. Si se mueve la vigencia a otro año, se acomoda al
consecutivo de ese año. Escrito a mano manda lo que se escriba, y si ese número ya es de otro
convenio se avisa ahí mismo, mientras se escribe, con el nombre del cliente que lo trae.

### Por qué el contador vive en el servidor

El consecutivo salía de los convenios que ese equipo tiene **bajados**, y eso deja de ser
cierto en cuanto el servidor reparte por dueño: un ejecutivo que sólo recibe los suyos cuenta
desde el suyo más alto y propone un número que en el hotel ya existe. La renumeración
automática tampoco lo agarra, porque trabaja con lo mismo que ve. Así es como se repiten dos
convenios sin que nadie se entere.

Con `folios.sql` corrido, el contador vive en el servidor, que es el único que los ve todos:

- Al **abrir** el editor se le pregunta cuál es el último del hotel y el folio se acomoda solo,
  aunque esa persona no alcance a ver los convenios de los demás.
- Al **guardar** se le pide turno. Es una sola operación indivisible, así que dos personas
  capturando al mismo segundo reciben números distintos.
- Los folios que vienen **de un papel** —los que se registran como externos— se anotan también,
  para que el contador no los vuelva a repartir.

La tabla del contador guarda **nada más el número**: ni cliente, ni tarifas, ni importes. Por
eso la puede leer todo el equipo sin que eso abra la cartera de nadie.

Si entre abrir el editor y guardar alguien más se llevó ese número, el convenio queda con el
siguiente libre y **se anota en la bitácora del cliente**, para que nadie ande buscando un folio
que nunca existió.

**Sin correr `folios.sql` el CRM funciona igual** que hasta ahora: cuenta con lo que ese equipo
tiene bajado. Es el comportamiento de siempre, con su renumeración automática al sincronizar.

## El convenio dice de quién es

Cada convenio guarda **su propio ejecutivo**, que se escoge de la misma lista al crearlo. Por
omisión toma al del cliente, y lo sigue si se cambia de cliente, pero se puede cambiar a mano:
pasa que alguien levanta un convenio para un cliente que atiende otra persona.

Ese ejecutivo es el que firma la carta por el hotel y al que se le avisa cuando el cliente
firma. Un convenio se le muestra a quien lo trae asignado **y** al dueño del cliente; gerencia y
administración los ven todos. Los convenios viejos, que no traen el dato, siguen siendo del
dueño del cliente.

## La firma se traza una vez

La primera vez que alguien firma un convenio se le ofrece **guardar su firma**. A partir de ahí
sólo tiene que confirmar; el botón *Trazar otra* sirve para reemplazarla y *Borrarla* para
quitarla. También se ve y se borra desde el menú de la sesión (el chip con su nombre, arriba a
la derecha).

La firma se guarda **en su ficha de usuario**, así que la trae consigo a cualquier computadora
en la que entre con su correo. Eso también quiere decir que viaja al servidor junto con el resto
de los datos, igual que las firmas que ya van estampadas en cada convenio. Sin nube se queda
nada más en esa máquina, y se borra al cerrar sesión para no dejársela al que se siente después.

## El formulario de prospección

La pestaña **Formulario** es para levantar contactos en una expo, una feria o un evento del
hotel: nombre, apellido, correo y teléfono obligatorios, compañía y evento opcionales.

Lo que se captura **no entra a la cartera**. Se queda en su propia lista hasta que alguien le
da *Pasar a la cartera*, y ahí se escoge el ejecutivo que lo va a trabajar; sólo entonces se
crea el cliente, con su nota diciendo de qué evento salió. Así un evento de cien registros no
llena el embudo de gente que nunca contestó.

Cada registro es de quien lo capturó: un ejecutivo ve los suyos, gerencia y administración los
ven todos. El campo *Evento* se queda puesto entre un registro y el siguiente, porque en un
stand se capturan decenas seguidos del mismo.

### Modo tableta

*Abrir modo tableta* deja la pantalla completa con nada más el formulario, para entregarle el
aparato al cliente. Primero se fija el evento y a nombre de quién quedan los registros; a
partir de ahí el cliente sólo ve el membrete del hotel, cinco campos y un botón.

Mientras está puesto, **el CRM no está tapado: está quitado de la página**, de modo que no se
alcanza ni con el teclado ni con un lector de pantalla. Tampoco aparece un solo dato de otra
persona, ni siquiera al repetirse un correo. Aguanta una recarga —si no, un tirón de pantalla
dejaría la cartera a la vista— y para salir hay que **mantener pulsada la esquina de arriba a
la derecha dos segundos**.

## La cuenta de dirección

`direccion@quartzhotel.mx` entra con el papel **Dirección**: ve la cartera, los convenios, los
contratos, los eventos y los reportes de **todo el equipo**, en los dos departamentos, y escoge
en cuál entra. Lo único que no alcanza son los **Ajustes** —tarifas, textos, usuarios y la
conexión del equipo—, que se quedan con la administración.

Viene con el nombre «Dirección» porque es el de la cuenta, no el de una persona. Si se quiere
que los documentos y la bitácora salgan a nombre propio, se cambia en *Ajustes → Usuarios y
permisos*.

## Dar de alta a alguien son dos pasos

1. **En Supabase** → *Authentication → Users → Add user*, con **Auto Confirm User** marcado.
   Eso le crea la cuenta con la que entra.
2. **En el CRM** → *Ajustes → Usuarios y permisos → + Agregar persona*: el mismo correo, su
   nombre como aparece en la cartera, y su papel.

Falta cualquiera de los dos y no funciona: sin el primero no puede entrar; sin el segundo
entra pero no ve nada.

Para darlo de baja, al revés: quítalo de la lista **y** borra su cuenta en Supabase. Con sólo
lo primero deja de ver, pero su cuenta sigue viva.

---

## Nadie entra sin contraseña

Con la nube configurada, mientras no haya sesión **el CRM no está en la página**. No es que
esté tapado por el recuadro de entrar: está quitado, igual que en el modo tableta. Así no se
alcanza ni con el teclado, ni con un lector de pantalla, ni cerrando el recuadro.

Eso cierra un hueco que existía: la pantalla de entrar traía un botón de *Trabajar sólo en
este equipo* que la quitaba **sin contraseña**, y dejaba a la vista la cartera que ese equipo
ya tenía guardada. Ese botón ya sólo aparece cuando no hay ninguna nube configurada, que es
como se trabaja el archivo suelto.

Lo único que queda abierto sin contraseña es **Configurar este equipo**, dentro de la misma
pantalla: dos campos para apuntar la aplicación a otro servidor. No enseña un solo dato, y sin
él una dirección mal escrita dejaría el equipo trabado para siempre, porque Ajustes está del
otro lado del candado.

Al **cerrar sesión** la cartera de quien se va se borra de ese navegador; el siguiente que
entre la vuelve a bajar. Un equipo que se queda con la sesión caducada sí conserva su copia
—para no perder capturas sin subir—, pero no la enseña hasta que alguien entre.

## Dos niveles de protección

Esto es lo importante de entender.

### Lo que ya está hecho: la pantalla

Configurar los usuarios en Ajustes acomoda **lo que cada quien ve**. Un ejecutivo abre el CRM
y encuentra su cartera, sin rastro de la de sus compañeros.

Pero **los datos siguen bajando completos a cada equipo**. La aplicación los recibe todos y
enseña sólo unos. Alguien con conocimientos —o con curiosidad y unas cuantas búsquedas—
podría leer el resto.

Para un equipo que se tiene confianza, esto basta y sobra: ordena el trabajo y evita que
nadie ande de mirón por accidente.

### Lo que falta correr: el servidor

Si además quieres que **el servidor mismo se niegue** a entregar la cartera ajena, corre
`roles.sql` en el SQL Editor de Supabase. A partir de ahí, un ejecutivo ya no recibe los datos
de otro ni sabiendo dónde buscar.

Con `roles.sql` corrido, el reparto del servidor es el mismo que el de la pantalla: a
banquetes no le baja un solo convenio, contrato de hospedaje ni huésped, y a ventas no le baja
un solo evento. La cartera de clientes sí le baja entera a banquetes, porque sus eventos
cuelgan de ella y sin el cliente el evento no se puede ni abrir; en pantalla le siguen
saliendo nada más los suyos.

La cuenta de **Sólo prospección** —la tableta— es la más cerrada de todas: el servidor le
entrega los ajustes, la lista de usuarios y sus propios prospectos, y nada más. Ni un cliente,
ni un convenio, ni un huésped. Y sólo puede escribir prospectos.

Escribir se deja más suelto que leer a propósito. Un renglón que el servidor no entrega es un
renglón que ese equipo nunca va a mandar, y una regla de más al escribir le tumbaría la subida
entera por una fila que ni siquiera tiene.

> Si ya corriste `roles.sql` antes —antes del formulario, o antes de que existiera
> banquetes—, **vuelve a correrlo**: el archivo se reemplaza entero cada vez y es lo que trae
> las reglas nuevas.

### Un registro sin su cliente no es un registro borrado

Con el servidor repartiendo, a alguien le puede llegar una actividad o un evento **suyo**
colgando de un cliente que no alcanza a ver. Ese renglón se aparta —sin su cliente no hay nada
que abrir—, pero el CRM **no lo confunde con un borrado**: no manda la baja, así que el
registro sigue entero para quien sí lo ve. Es la clase de error que se paga caro y en silencio,
y por eso está cubierto con pruebas.

### La lista de usuarios tiene que estar en la nube

Las reglas de `roles.sql` leen quién es quién de las mismas filas de usuarios que administra
el CRM. **Si esa lista no llegó a la nube, el servidor no reconoce a nadie**: todos caen en el
mismo saco que una cuenta ajena —ver *Cuentas que no son de ventas*, aquí abajo— y deja de
entregar absolutamente todo. Se nota de golpe: al equipo entero se le queda la pantalla vacía de
un día para otro, aunque nadie haya tocado nada.

Para saber si es eso, cualquiera puede abrir **el chip con su nombre (arriba a la derecha) →
*¿Por qué no veo algo?***. Esa pantalla dice cuántos registros de cada tipo le está entregando
el servidor y, si el problema es éste, lo nombra y le ofrece al administrador el botón para
subir la lista de una vez.

También trae **Volver a bajar todo**, por si a un equipo se le quedó algo sin llegar.

**Antes de correrlo:**

1. Saca un respaldo: **Exportar → Respaldo completo (JSON)**.
2. Da de alta a **todo el equipo** en *Ajustes → Usuarios y permisos*. Las reglas leen esa
   misma lista, así que si está incompleta alguien se quedará sin ver nada.
3. Desde un equipo conectado, dale a **Volver a subir todo**. Eso marca cada registro con su
   dueño; las filas que se queden sin marcar las sigue viendo todo el mundo.

Si algo sale mal, al final de `roles.sql` está el **Para deshacer**: unas cuantas líneas que se
copian tal cual al SQL Editor y devuelven el CRM a como estaba —todos ven todo—, incluido el
buzón de firmas. Córrelas enteras, no sólo las de arriba: las que sueltan las funciones son las
que vuelven a abrir el buzón. Después, `nube.sql` otra vez.

### Cuentas que no son de ventas

En el servidor hay cuentas que no son del equipo: recepción, operación, alguien que entra a otro
módulo con el mismo correo, una cuenta vieja que nadie dio de baja. Antes, una cuenta así abría el
CRM y el servidor la trataba como **un ejecutivo más al que todavía no le habían marcado la
cartera**: le entregaba los ajustes, el catálogo de habitaciones, la lista completa del equipo y
todos los registros que no tuvieran dueño puesto. Nadie se lo había dado; lo tenía de todos modos.

Con `roles.sql` corrido eso se acabó. Quien entra con un correo que **no está** en *Ajustes →
Usuarios y permisos* queda en un papel aparte, que no alcanza la cartera: ni un cliente, ni un
convenio, ni un prospecto, ni el catálogo, ni la lista de usuarios. Cero registros de cualquier
tipo. Y tampoco escribe: el servidor le rechaza cualquier alta y cualquier corrección, incluso
sobre lo que no tiene dueño.

Se ve como una pantalla vacía, sin aviso ni error, y es la respuesta correcta: quien no es de
ventas no tiene por qué llevarse la cartera.

**Son dos archivos, no uno.** `roles.sql` cierra la cartera; el **buzón de firmas** —la tabla
donde el cliente deja su firma al abrir su enlace— lo cierra `firmas.sql`, y no se cierra solo.
Importa porque en el buzón, junto a la firma, viaja la **clave del convenio**: quien lo leyera
podría abrir ese convenio entero desde el enlace, sustituir la firma del cliente antes de que el
CRM la recoja, o marcarla como atendida para que se pierda. Corriendo los dos, una cuenta que no
es de ventas tampoco lee ni corrige una sola firma; corriendo sólo `roles.sql`, el buzón se queda
abierto a cualquiera que haya entrado al servidor.

Así que **vuelve a correr `firmas.sql`** después de `roles.sql`. Es el orden de siempre —`nube.sql`
→ `roles.sql` → `firmas.sql`—, se puede repetir y no borra nada. Si un día se corre `firmas.sql`
antes que `roles.sql`, o sin él, no truena: el buzón se queda como estaba y la guarda empieza a
valer sola en cuanto `roles.sql` esté puesto. Lo que **no** cambia en ningún caso es el cliente:
sigue depositando su firma con la clave de su enlace, sin cuenta y sin ver nada más.

Lo que sí hay que cuidar es que **los dos archivos sean de la misma tanda**. Con un `roles.sql`
de los de antes —los que trataban a cualquier cuenta como ejecutiva— el buzón se queda abierto
igual que siempre, sin avisar, porque la guarda pregunta por un papel que ese archivo viejo nunca
reparte. Si hay duda, bajen los dos de la misma versión del CRM y córranlos en orden.

**El precio es que la lista manda.** Si alguien del equipo tiene su cuenta para entrar pero nadie
lo agregó a *Usuarios y permisos*, no es que vea poco: no ve **nada**. Y si la lista completa
todavía no ha llegado a la nube, le pasa a todo el mundo a la vez —ahí es donde se nota que el
paso 2 de *Antes de correrlo* no era opcional—.

Se arregla en un minuto y **no hay que volver a correr `roles.sql`**: las reglas leen la lista
viva.

1. Un **administrador** lo agrega en *Ajustes → Usuarios y permisos → + Agregar persona*: el mismo
   correo con el que entra y su nombre tal como aparece en la cartera.
2. Desde ese equipo, **Volver a subir todo**, para que la lista llegue a la nube.
3. La persona recarga y ya está.

Para saber si es eso, cualquiera puede abrir el chip con su nombre (arriba a la derecha) →
***¿Por qué no veo algo?***: esa pantalla dice cuántos registros de cada tipo le está entregando
el servidor. Todo en cero es esto, y no otra cosa.

No hay prisa por correrlo, y tampoco pasa nada por no hacerlo: la aplicación funciona igual
con la columna del dueño y sin ella. Si el servidor le dice que esa columna no existe, vuelve
a mandar los datos sin ella y sigue trabajando; lo intenta de nuevo en la siguiente sesión,
así que el día que se corra `roles.sql` empieza a usarla sola.

---

## El cliente que firma desde un enlace

Es otro archivo y otro asunto: `firmas.sql`. Lo que hace es dejar que alguien **sin cuenta**
—el cliente— abra el enlace que le mandó su ejecutivo, lea **su** convenio y lo firme.

Está pensado para no abrir de más:

- El visitante puede leer **un** convenio: aquel cuya clave viene en el enlace. Sin clave no
  ve nada, y con una clave no puede ver otros.
- **No escribe sobre el convenio.** Deja su firma en un buzón aparte donde puede depositar
  pero no leer ni corregir. El CRM la recoge de ahí y la aplica.
- **Del buzón recoge el equipo de ventas**, no cualquiera que haya entrado al servidor: quien
  no está en la lista de *Usuarios y permisos* no lee ni corrige una sola firma. Ver *Cuentas
  que no son de ventas*, más arriba.
- La clave deja de servir en cuanto se firma.

Se corre igual que los demás, en el SQL Editor, y se puede repetir. Al final del archivo están
las líneas para deshacerlo; los convenios ya firmados se quedan como están, porque la firma
vive dentro del convenio y no en el buzón.

### Si el cliente firmó y no aparece en el CRM

**Ajustes → Nube y equipo → Buscar firmas de clientes.** Revisa el buzón en ese momento y dice
qué encontró: si está vacío, si aplicó firmas, o por qué no pudo. Los dos motivos que se ven
en la práctica:

- **«falta correr firmas.sql»** — el buzón no existe, así que la firma nunca se guardó.
- **«llegó con una clave que ya no corresponde»** — al cliente se le mandó un enlace, luego se
  rehizo, y firmó con el viejo. Se le vuelve a mandar el enlace y listo.

Normalmente no hace falta apretar nada: el CRM revisa el buzón en cada sincronización, o sea
cada 15 segundos.

**Sin correrlo el CRM funciona igual**: simplemente no se ofrece el enlace, y quedan los otros
dos caminos —mandar el PDF para que lo firmen en papel, o capturar la firma delante del
cliente—.

## Lo que no hace

- **No impide editar.** Quien puede ver un registro puede corregirlo, que es lo que se espera
  de un equipo de ventas. Lo único reservado al administrador son los ajustes, el catálogo de
  tarifas y la lista de usuarios.
- **No hay ejecutivo sin cartera.** Un correo que entra sin estar dado de alta en la lista no
  ve nada: ni su cartera, ni la de nadie, ni el catálogo, ni el buzón de firmas —esto último,
  con `firmas.sql` vuelto a correr—. Es a propósito — más vale que alguien se queje de que no
  ve nada, a que vea lo que no debía.
- **Sin nube no hay papeles.** Quien abre el archivo en su equipo, sin conectar, es dueño de
  sus propios datos y ve todo. No hay nadie de quien protegerlo.
