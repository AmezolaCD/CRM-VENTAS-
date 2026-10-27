# Conectar otro sistema al CRM

Esta guía es para quien va a hacer que **otro programa lea y escriba** en el CRM: un PMS, un
motor de reservas, un tablero, lo que sea. No es para el equipo de ventas.

> **Lo primero, porque es lo que casi siempre se entiende al revés:** la llave `anon` **no
> alcanza**. Es pública a propósito —viaja dentro de la página del CRM— y con ella sola, sin
> una sesión iniciada, el otro sistema **no lee ni un solo renglón**. Las reglas de
> `crm_datos` son todas `to authenticated`. Lo que hace falta no es una llave: es **una
> cuenta**.

---

## Lo que la llave pública sí abre, por si con eso basta

Antes de montar una cuenta, vale la pena mirar si el otro sistema sólo necesita **dejar cosas**
en el CRM. Para eso ya hay tres puertas con cerradura propia, y son más seguras porque no dan
acceso a nada más:

| Para | Puerta | Dónde está |
|---|---|---|
| Dejar la firma de un cliente | buzón `crm_firmas`, con el token del documento | `firmas.sql` |
| Dejar una orden de trabajo | buzón `crm_odts`, con el token de la liga | `odts.sql` |
| Levantar un prospecto | buzón de altas | `prospectos.sql` |
| Dejar un mensaje de WhatsApp | función `wa-hook`, con su cabecera secreta | `whatsapp.sql` |

Si lo que se quiere es **meter** datos y nada más, el camino bueno es uno de ésos, o una
función de servidor nueva con la misma forma: una cerradura propia, que se puede cambiar sin
tocar a nadie, y cero acceso al resto.

Lo de abajo es para cuando de verdad hace falta **leer y escribir**.

---

## 1. La cuenta

**Dos pasos, y los dos hacen falta.** Uno sin el otro deja al sistema entrando y sin ver nada.

1. **En Supabase → Authentication → Users**, un usuario nuevo con su propio correo —algo como
   `integracion@…`— y su contraseña.
2. **En el CRM, Ajustes → Usuarios y permisos**, un renglón con ese mismo correo y el papel
   **Dirección**. Y **Guardar ajustes**.

El segundo paso no es un trámite: el servidor saca el papel de quien pregunta buscando el
correo del token en esa lista (`crm_rol()` → `crm_yo()`, en `roles.sql`). Un correo que no esté
ahí contesta `ninguno` y **no alcanza absolutamente nada**.

### Por qué Dirección y no Administrador

| | Dirección | Administrador |
|---|---|---|
| Leer todo el trabajo del hotel | sí | sí |
| Escribir clientes, convenios, contratos, eventos | sí | sí |
| Cambiar ajustes, catálogo de habitaciones y **papeles de los usuarios** | **no** | sí |

Una integración que puede reescribir la lista de usuarios puede, sin querer, dejar a todo el
hotel fuera. Dirección hace todo el trabajo y no alcanza esa palanca.

### Cuenta propia, no la de una persona

- Se le quita el día que se quiera sin dejar a nadie fuera.
- En la bitácora se distingue lo que hizo el sistema de lo que hizo un ejecutivo.
- Y si el otro sistema se cambia por otro, no hay que andar rotando la contraseña de alguien.

---

## 2. Cómo entra

Con la dirección del proyecto y la llave `anon`, que se copian de **Ajustes → Nube y equipo**
del propio CRM, o de Supabase → Project Settings → API.

```bash
# 1. Iniciar sesión. Devuelve access_token y refresh_token.
curl -X POST "https://TU-PROYECTO.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: LA_LLAVE_ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"CORREO_DE_LA_INTEGRACION","password":"SU_CONTRASENA"}'

# 2. Y de ahí en adelante, el token en cada llamada.
curl "https://TU-PROYECTO.supabase.co/rest/v1/crm_datos?tipo=eq.clientes&borrado=eq.false" \
  -H "apikey: LA_LLAVE_ANON" \
  -H "Authorization: Bearer EL_ACCESS_TOKEN"
```

El `access_token` caduca. Se renueva con
`POST /auth/v1/token?grant_type=refresh_token` y el `refresh_token`, que es lo mismo que hace
el CRM por su cuenta.

> **La contraseña y los tokens viven en la configuración del otro sistema.** No en este
> repositorio, que es público; no en un archivo; no en un chat. La llave `anon` sí se puede
> escribir donde sea: es pública.

---

## 3. La forma de los datos

Aquí es donde se rompen las integraciones, así que conviene leerlo entero.

**Todo el CRM vive en una sola tabla**, `crm_datos`:

| Columna | Qué es |
|---|---|
| `id` | `tipo` + `:` + el id del objeto. `clientes:c_ab12`, `convenios:v_9f`, y `ajustes:global` |
| `tipo` | la colección |
| `datos` | el objeto completo, en JSON |
| `duenio` | de quién es, **por nombre** |
| `borrado` | la lápida |
| `actualizado` | cuándo cambió |

Los tipos son: `clientes`, `actividades`, `convenios`, `contratos`, `eventos`, `prospectos`,
`campanas`, `odts`, `huespedes`, `habitaciones`, `usuarios`, `certificados`, `serviciosBq`,
`salones`, más el renglón único `ajustes:global`.

### Las cuatro reglas que hay que respetar

**1 · El `id` se arma, no se inventa.** Si el `id` no es `tipo:idDelObjeto`, el CRM lo baja y lo
vuelve a subir como otra cosa, y acaban dos renglones del mismo registro.

**2 · `duenio` manda en los permisos.** Es el **nombre** del ejecutivo, como está escrito en la
lista de usuarios —no su correo—. Sale del propio registro: de `ejecutivo` en el cliente, el
convenio, el contrato o el evento, y si no lo trae, del ejecutivo del cliente al que cuelga. Un
renglón escrito con el dueño equivocado **se le vuelve invisible** al ejecutivo al que le toca,
y no hay error que lo delate: simplemente no le aparece.

**3 · Borrar es una lápida, nunca un `DELETE`.** Se pone `borrado = true` y se mueve
`actualizado`. Un `DELETE` de verdad no deja rastro, así que los demás equipos no se enteran
—cada uno tiene su copia— y en la siguiente sincronización **lo vuelven a subir**. El registro
reaparece solo.

**4 · `actualizado` es lo que hace que el CRM se entere.** Las computadoras del equipo piden
«lo que cambió desde la última vez» (`actualizado=gt.…`). Un renglón escrito sin mover esa
fecha **no baja nunca**: queda en el servidor y en ninguna pantalla.

### Y una advertencia sobre el contenido de `datos`

El CRM normaliza cada registro al cargarlo. Un campo que no conoce se conserva, pero uno con el
nombre mal escrito o del tipo equivocado **se reemplaza por su valor por omisión, sin avisar**.
Antes de escribir un tipo de registro, conviene sacar uno de ejemplo del propio CRM —Exportar →
Respaldo completo (JSON)— y copiarle la forma.

---

## 4. Lo que no hay que hacer

- **La llave `service_role` en algo que corra en un navegador.** Salta todas las reglas y lee la
  base entera, de todos los clientes del hotel. Si el otro sistema tiene una parte en el
  navegador, ahí va la `anon` y nada más.
- **Escribir en `ajustes`, `usuarios` o `habitaciones`.** El servidor se lo va a rebotar a la
  cuenta de Dirección, y está bien que así sea.
- **Escribir encima de algo que alguien pueda tener abierto.** El CRM trabaja sin conexión y
  sincroniza después: si la integración reescribe un convenio mientras una ejecutiva lo edita,
  el último que escribe gana y el otro pierde su trabajo sin enterarse.

---

## 5. Cómo probarlo sin romper nada

1. **Exportar → Respaldo completo (JSON)** desde el CRM. Es la única copia que se lleva uno.
2. Escribir **un cliente inventado** desde el otro sistema, con un nombre que se reconozca.
3. En el CRM: que aparezca, y que le aparezca **al ejecutivo correcto** —ahí se ve si el
   `duenio` quedó bien—.
4. Marcarlo `borrado = true` desde el otro sistema y comprobar que desaparece de las pantallas
   del equipo, no sólo de una.
5. Hasta que esos cuatro pasos salgan limpios, no escribir sobre datos de verdad.

---

## Si hace falta apretar más

Hoy la integración entra con papel de **Dirección**, que es lo que había sin tocar el servidor.
Cuando ya se sepa exactamente qué tipos de registro necesita, se le puede dar un **papel
propio** en `roles.sql` —como se hizo con *Órdenes de trabajo*— que alcance esos tipos y ni uno
más. Eso obliga a volver a correr `roles.sql`, así que conviene hacerlo una sola vez, al final,
y no antes de saber qué toca de verdad.
