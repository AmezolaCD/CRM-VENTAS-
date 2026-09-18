# Quién ve qué

El CRM tiene seis papeles:

| Papel | Pestañas que ve | Qué alcanza |
|---|---|---|
| **Administrador** | Todas, Ajustes incluido | Todo |
| **Gerencia de ventas** | Las de hospedaje, menos Ajustes | La cartera, los convenios, la actividad y los prospectos de todo el equipo |
| **Ejecutivo de ventas** | Las de hospedaje, menos Ajustes | Sólo sus propios clientes, convenios, actividades y prospectos |
| **Gerencia de banquetes** | Tablero, Clientes, Actividades, Eventos, Contratos banquetes, Calendario, Reportes y Formulario | Los eventos y contratos de **todo el equipo de banquetes**; la cartera la comparte con ventas |
| **Ejecutivo de banquetes** | Las mismas que su gerencia | Sólo sus propios eventos y contratos de banquetes |
| **Sólo prospección** | Únicamente *Formulario* | Sólo los prospectos que esa cuenta capturó |

Un ejecutivo ve además **las actividades que él mismo registró**, aunque sean de un cliente de
otro: a veces se cubre a un compañero y esa llamada es suya de todos modos.

## Ventas y banquetes no se ven los papeles

Son dos negocios distintos y cada uno ve el suyo:

- Banquetes **no ve** convenios, contratos de hospedaje ni confirmaciones.
- Ventas **no ve** las pestañas *Eventos* ni *Contratos banquetes* —tampoco la gerencia de
  ventas—, ni los eventos en el calendario, ni el dinero de banquetes en los reportes.

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
el CRM. **Si esa lista no llegó a la nube, el servidor no reconoce a nadie**: trata a todos
como ejecutivos sin nombre y deja de entregar todo lo que tenga dueño marcado. Se nota porque
alguien —gerencia, típicamente— deja de ver los convenios de un día para otro, aunque la
cartera se siga viendo.

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

Si algo sale mal, al final de `roles.sql` están las cuatro líneas para volver a como estaba.

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
- **No hay ejecutivo sin cartera.** Un correo que entra sin estar dado de alta en la lista se
  trata como ejecutivo sin clientes: no ve nada. Es a propósito — más vale que alguien se
  queje de que no ve nada, a que vea lo que no debía.
- **Sin nube no hay papeles.** Quien abre el archivo en su equipo, sin conectar, es dueño de
  sus propios datos y ve todo. No hay nadie de quien protegerlo.
