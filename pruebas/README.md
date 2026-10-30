# Las pruebas

Viven **dentro del repositorio** a propósito. Antes vivían en el directorio temporal de la
sesión en la que se escribieron, y un reinicio del contenedor se las llevó completas: eran
justo lo que había atrapado cada una de las regresiones de este proyecto.

## `sql/` · PostgreSQL de verdad

```sh
sh pruebas/sql/correr.sh
```

Levanta un PostgreSQL 16, corre los diez `.sql` del proyecto y comprueba, **como `anon`**, que
un cliente puede firmar desde su enlace: que lee su documento con su clave, que deposita su
firma, que con una clave que no es la suya no entra, que con el documento borrado tampoco, y
que un `firmas.sql` pegado a medias no deja el buzón peor de como estaba.

El CRM no pega el archivo tal cual: le quita los comentarios para que quepa por debajo de los
100 renglones. Esa transformación **también se corre contra PostgreSQL**, porque un SQL
transformado no se da por bueno leyéndolo:

```sh
node pruebas/navegador/… ó sacar el texto de sqlSinComentarios() a un archivo
FIRMAS_COMPACTO=/ruta/firmas-compacto.sql sh pruebas/sql/correr.sh
```

Las reglas de fila (RLS) **no se prueban con un servidor de mentiras**. Un servidor inventado
acepta lo que uno le programe que acepte; el error que vio un cliente de verdad —*new row
violates row-level security policy*— sólo lo contesta PostgreSQL.

## `navegador/` · lo que ve el cliente

```sh
node pruebas/navegador/firma-del-cliente.mjs          # lo que ve el cliente
node pruebas/navegador/firma-del-cliente.mjs --fotos  # además deja capturas
node pruebas/navegador/enlace-que-no-sirve.mjs        # lo que ve el ejecutivo
node pruebas/navegador/borrar-se-propaga.mjs         # un borrado llega a todos
node pruebas/navegador/copiar-es-enviar.mjs          # copiar el enlace es mandarlo
node pruebas/navegador/folios-repetidos.mjs          # dos documentos con el mismo folio
node pruebas/navegador/copiar-el-sql.mjs             # el .sql llega entero
node pruebas/navegador/certificados.mjs             # el folio no se repite y quién emite
node pruebas/navegador/arranque.mjs                 # que la aplicación abra
node pruebas/navegador/no-se-pierde-lo-escrito.mjs  # guardar guarda de verdad
node pruebas/navegador/servicios-de-banquetes.mjs   # la propuesta sale del catálogo
node pruebas/navegador/firmas-que-no-llenan.mjs     # una firma no llena el navegador
node pruebas/navegador/copia-local.mjs              # la copia vive en IndexedDB
node pruebas/navegador/salones.mjs                  # el salón y su renta por rato
node pruebas/navegador/contrato-de-banquetes.mjs    # las 19 cláusulas, completas
node pruebas/navegador/contratos-en-papel.mjs       # el contrato no se firma en pantalla
node pruebas/navegador/opciones-del-contrato.mjs    # comisión y desayuno
node pruebas/navegador/la-liga-del-hotel.mjs        # un equipo nuevo no configura nada
node pruebas/navegador/editar-antes-de-la-firma.mjs # se corrige hasta que firme el cliente
node pruebas/navegador/beneficios-del-convenio.mjs  # el spa y la transportación, sin Care
node pruebas/navegador/los-departamentos-de-la-liga.mjs # lo que ve la liga de las ODTs
node pruebas/navegador/solo-las-ordenes.mjs         # el papel que sólo ve las ODTs
node pruebas/navegador/politicas-del-contrato.mjs   # el contrato de ventas, completo
node pruebas/navegador/observaciones-del-convenio.mjs # las que sí salen en la carta
node pruebas/navegador/subir-en-trozos.mjs          # la subida no truena por grande
node pruebas/navegador/la-firma-que-no-entro.mjs    # una firma de cliente no se pierde callada
node pruebas/navegador/los-folios-no-se-pierden.mjs # el folio nuevo lo da el contador
```

`firma-del-cliente.mjs` comprueba que al cliente no se le pide nada más que firmar y que, si el
servidor rechaza su firma, no ve letra de técnico ni se le encarga nada.

`los-folios-no-se-pierden.mjs` cuida el contador. Cuando dos equipos toman el mismo folio, la
renumeración automática **se inventaba** el número nuevo —contando lo que ese equipo tiene
bajado— y **no se lo avisaba al contador del servidor**, así que éste lo volvía a repartir y se
volvía a chocar: un contrato acabó con tres folios y dos huecos en la serie. Se afirma que el
número sale del contador, que **después de renumerar el contador ya no lo reparte** —la rueda—,
y que sin contador **no se inventa nada**. Sus dos grupos de control son lo que no puede
romperse: un documento ya emitido, enviado o reabierto sigue sin renumerarse solo, y dos
borradores que de verdad chocan se siguen arreglando solos.

`la-firma-que-no-entro.mjs` es la otra mitad: lo que pasa **del lado del hotel** cuando la firma
ya llegó. Hay tres casos en los que no se aplica —se firma en papel, ya estaba firmado, la clave
ya no corresponde— y los tres se rechazaban sin decirlo: el sondeo automático se comía la
explicación y marcaba la fila como recogida. Se afirma que el aviso queda, que **aguanta una
recarga**, que sale en el chip, que lo que falta subir le sigue ganando, y que *Firmas recibidas*
encuentra una firma ya marcada sin imprimir su imagen. El grupo de control es el que no se puede
romper: una firma buena se sigue aplicando sola y en silencio.

`editar-antes-de-la-firma.mjs` cuida las dos mitades de una misma regla en las **tres**
familias de documentos —convenios, contratos de hospedaje y banquetes—: que se pueda corregir
mientras el cliente no haya firmado, y que no se pueda en cuanto firmó, por pantalla o en papel.
Y lo que cuesta corregir: el documento vuelve a borrador, pierde la firma del hotel y el enlace,
pero **conserva su folio**, que ya se apartó en el contador y no se gasta otro por una coma.

`la-liga-del-hotel.mjs` sirve **dos copias del mismo `index.html`** —una con la línea de
`CORE_NUBE` llena y otra sin ella— y mira qué hace un navegador recién estrenado con cada una.
Es lo que sostiene el alta de todo el equipo: si se rompe en silencio, cada quien vuelve a pegar
la dirección y la llave a mano.

`opciones-del-contrato.mjs` cuida las opciones que se le fueron agregando al contrato de
ventas —comisión y desayuno— y en las dos mide lo mismo: que **sin tocarlas el documento diga
exactamente lo de siempre**. Quien no las use no tiene por qué notar nada, y los contratos que
ya andan por ahí tampoco pueden cambiar de texto solos. Lleva su grupo de control: la
carta-convenio, que Marco pidió dejar quieta.

`beneficios-del-convenio.mjs` nace de algo que Marco vio en un convenio ya hecho: el 20% del
spa y la transportación *Hotel - Empresa - Hotel* sólo salían si el convenio traía una
habitación **Care**, porque vivían en el bloque Recovery y ese bloque no se imprime sin
habitaciones de ahí. No son beneficios de la habitación de recuperación, así que ahora salen en
la tira de abajo de la tabla de tarifas, **junto al renglón del desayuno**, que es donde Marco
los quiere leer. Lo que la prueba cuida de verdad no es el texto: es la **migración**. Los
ajustes guardados le ganan al texto de fábrica, así que un hotel que ya trabajó no habría visto
el cambio nunca; y el contrapeso, que a quien escribió su propia versión **no se le pise**, que
sería peor que la falla que se arregla. Mide además que un convenio ya hecho no cambie solo:
cada uno guarda su copia de los textos, y un documento que ya está en manos del cliente no se
mueve debajo de él — pero un **borrador** sí se pone al día al abrirlo, igual que ya pasaba con
la tarifa pública del catálogo, que es lo que destraba el caso real: corregir un texto en Ajustes
y que el borrador en curso se entere.

`los-departamentos-de-la-liga.mjs` sale de un reporte de Marco: agregó un departamento para
las órdenes de trabajo y no le aparecía en la liga. No era un error: el formulario que abren los
jefes de área **no lee la tabla de Ajustes de esa computadora, se la pide al servidor**, así que
un departamento recién escrito no existe para la liga hasta que ese renglón sube — y el CRM no
lo decía en ninguna parte. Ahora se puede preguntar, y lo que la prueba cuida es lo que hace que
la respuesta valga: que **suba antes de preguntar** —si no, contestaría «te falta» por la única
razón que no importa—, que pregunte con **la misma función que usa el formulario** y no con una
consulta parecida escrita aparte, y que distinga «falta correr odts.sql» de «el servidor no
contestó», que se arreglan de maneras muy distintas.

`solo-las-ordenes.mjs` cuida el papel **Órdenes de trabajo**, que Marco pidió para la
asistencia de dirección: una sola pestaña y nada más. Mide que no se cuele de más —se le dio a
alguien precisamente para que no viera la cartera—, que no le pidan escoger departamento al
entrar, y que los demás papeles no se hayan movido. Pero el bloque que de verdad importa es el
último: **que `roles.sql` nombre el papel**. El servidor decide por su cuenta qué le manda a
cada quien, y un papel que no esté ahí cae en la rama de ventas, que excluye las órdenes; sería
una cuenta que entra, ve su pestaña y la encuentra vacía para siempre, sin un solo error en
pantalla. La mitad de ese cambio vive en un archivo que el hotel tiene que correr, y eso es lo
que esta prueba impide que se nos olvide.

`politicas-del-contrato.mjs` nace de un contrato de verdad que mandó Marco: «los contratos y
cotizaciones en ventas son casi iguales, sin embargo los contratos tienen muchas más políticas»,
y en seguida el recordatorio que fija el alcance: «el contrato de ventas y los de banquetes son
distintos». El contrato de hospedaje pasó de tres secciones a veinte, y la prueba cuida sobre
todo lo que NO debía moverse: que **la cotización siga igual** y no cargue ni una de las llaves
nuevas, y que **el contrato de banquetes no se haya tocado** —ése es el grupo de control—.
Además mide que lo que falta se imprima como una raya en vez de callarse, y que los datos del
hotel salgan de Ajustes y no del código, porque el repositorio es público.

`observaciones-del-convenio.mjs` cuida los **dos** campos de notas de la carta-convenio: el
interno, que nunca se imprime, y el que Marco pidió «adicional», que sí lo lee el cliente. El
bloque que importa es el grupo de control: si los dos se cruzan, una nota del equipo —«ojo,
este cliente paga tarde»— acabaría impresa delante de él. Mide además que los saltos de renglón
del textarea lleguen al papel, que vacío no imprima ni el encabezado, y que el campo nazca al
usarse.

`contratos-en-papel.mjs` cuida lo que pidió el departamento legal del hotel: que a un
**contrato** no se le pueda sacar una firma por ningún camino —ni el lienzo, ni el enlace, ni
el buzón, ni un enlace viejo que alguien haya guardado—, porque sólo un sistema certificado
puede emitir firma digital. Quitar el botón no es quitar la función, y eso es justo lo que
mide. Lleva además su grupo de control: las **cotizaciones** se siguen firmando en pantalla, y
si eso se pone rojo es que se quitó de más.

`arranque.mjs` es la que faltaba. Marco se quedó mirando el logo morado de la entrada y en
incógnito sí abría: lo que la mataba eran **los datos guardados** de ese navegador. Se le pone
al navegador un almacenamiento como el suyo —con un certificado guardado, con un renglón sin
`id`, con el almacenamiento echado a perder— y se exige que la aplicación **abra**, que el logo
se quite, que el tablero se pinte y que no se escriba encima de la cartera. El último caso es
el que más importa: se sirve el archivo con una bomba metida a propósito y se exige que **se
vea qué pasó**, porque lo que de verdad falló fue que hubo un error y nadie lo supo.

`no-se-pierde-lo-escrito.mjs` levanta un servidor de mentiras y **dos equipos de verdad**. Al
aplicar lo que baja, la sincronización reemplaza el estado entero; una pantalla abierta se queda
con las referencias de antes y al guardar escribe en un objeto que ya nadie mira —decía
«Guardado ✓» y no guardaba nada—. Se cuidaba preguntando por `.overlay`, o sea sólo por las
ventanas, y **Ajustes no es una ventana**. La prueba exige que lo tecleado sobreviva, que al
cerrar sí entre lo del otro equipo, y —para que no se pase sola— que la nube de verdad trajera
algo que aplicar.

También atrapó, poniéndose roja de vez en cuando, que el guardián estaba en `sincronizar()`
pero no en `primeraSincronizacion` —la que corre al enlazar un equipo y al volver a entrar—,
que también reemplaza el estado entero. Se vence la sesión con una cotización abierta, la
persona vuelve a entrar y lo que llevaba escrito se pierde al guardar. Una prueba que falla una
de cada seis veces no es una prueba flaky: es un defecto que aparece una de cada seis veces.

`enlace-que-no-sirve.mjs` comprueba lo de antes del enlace: que si al servidor le falta el buzón
de firmas, al ejecutivo **no se le ofrece el enlace** y se le dice por qué — y que si lo que se
cayó fue la red, no se le estorba.

Necesita `playwright` y un Chromium. Si el Chromium no está donde la prueba lo busca, se le
dice con `CHROME_PATH`. Con `APP_HTML` se le puede apuntar a **otra copia del `index.html`**,
que es como se comprueba que la prueba de verdad atrapa algo: corrida contra la versión
anterior tiene que ponerse roja.

> Esa comprobación no es ceremonia. En este proyecto ya se escribió una prueba que pasaba
> **con el error metido de vuelta a propósito**. Una prueba que nunca se ha visto fallar no
> es una prueba.

## Nada de datos de verdad

El repositorio es público. Todo lo que aparece aquí —empresas, personas, teléfonos, claves— es
inventado, y las llaves son de mentiras. Ningún dato de ningún cliente del hotel entra a este
directorio.
