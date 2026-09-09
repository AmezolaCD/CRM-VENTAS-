# Quién ve qué

El CRM tiene tres papeles:

| Papel | Ve | Ajustes |
|---|---|---|
| **Administrador** | Todo | Sí — es el único |
| **Gerencia de ventas** | La cartera, los convenios y la actividad de todo el equipo | No |
| **Ejecutivo de ventas** | Sólo sus propios clientes, convenios y actividades | No |

Un ejecutivo ve además **las actividades que él mismo registró**, aunque sean de un cliente de
otro: a veces se cubre a un compañero y esa llamada es suya de todos modos.

Los **huéspedes** de las cartas de confirmación los ve todo el equipo. No son de nadie en
particular: son trabajo de recepción, no cartera de ventas.

---

## Lo que amarra a una persona con su cartera es el nombre

No el correo. Lo que decide de quién es un cliente es el campo **Ejecutivo** de ese cliente, y
eso se compara contra el **nombre** que tiene el usuario dado de alta.

Si en *Usuarios y permisos* dice `Carmen Sotelo` y en los clientes dice `C. Sotelo`, esa
ejecutiva **no verá su propia cartera**. Es el error más fácil de cometer y el más difícil de
ver, porque todo lo demás parece bien. El campo del nombre ofrece los que ya existen en la
cartera; conviene elegir de ahí.

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

**Antes de correrlo:**

1. Saca un respaldo: **Exportar → Respaldo completo (JSON)**.
2. Da de alta a **todo el equipo** en *Ajustes → Usuarios y permisos*. Las reglas leen esa
   misma lista, así que si está incompleta alguien se quedará sin ver nada.
3. Desde un equipo conectado, dale a **Volver a subir todo**. Eso marca cada registro con su
   dueño; las filas que se queden sin marcar las sigue viendo todo el mundo.

Si algo sale mal, al final de `roles.sql` están las cuatro líneas para volver a como estaba.

---

## Lo que no hace

- **No impide editar.** Quien puede ver un registro puede corregirlo, que es lo que se espera
  de un equipo de ventas. Lo único reservado al administrador son los ajustes, el catálogo de
  tarifas y la lista de usuarios.
- **No hay ejecutivo sin cartera.** Un correo que entra sin estar dado de alta en la lista se
  trata como ejecutivo sin clientes: no ve nada. Es a propósito — más vale que alguien se
  queje de que no ve nada, a que vea lo que no debía.
- **Sin nube no hay papeles.** Quien abre el archivo en su equipo, sin conectar, es dueño de
  sus propios datos y ve todo. No hay nadie de quien protegerlo.
